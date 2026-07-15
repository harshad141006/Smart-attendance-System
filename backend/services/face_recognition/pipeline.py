"""
ArcFace registration pipeline — fully self-contained, no app.* imports.

Workflow per registration request:
  1. Decode each base64 image.
  2. SCRFD-detect faces — skip if 0, reject if >1.
  3. Run FaceQualityService on each valid image.
  4. Generate a 512-D ArcFace embedding per passing image.
  5. Fail if fewer than MIN_VALID_IMAGES pass all checks.
  6. Average all embeddings and L2-normalise the result.
  7. Duplicate check against existing stored embedding.
  8. Persist to Firestore (or in-memory demo fallback).
"""

import logging
import os
from datetime import datetime
from typing import Optional

import numpy as np

from services.face_recognition.arcface_service import get_arcface_service
from services.face_recognition.utils import decode_base64_to_bgr, l2_normalize, cosine_similarity
from services.face_recognition.quality import FaceQualityService

logger = logging.getLogger(__name__)

MIN_VALID_IMAGES = 1
FACE_SIMILARITY_THRESHOLD = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.75"))

# In-memory fallback: { user_id -> embedding_doc }
_demo_embeddings: dict = {}

_quality_service = FaceQualityService()


def _get_arcface():
    return get_arcface_service()


# ---------------------------------------------------------------------------
# Face detection helper (used by /face-detect endpoint for live guidance)
# ---------------------------------------------------------------------------

def detect_faces_in_image(image_bgr: np.ndarray) -> dict:
    """
    Run SCRFD on one image and return structured detection data for the frontend.
    Returns: { count, face: { bbox, det_score, landmarks } | None }
    """
    faces = _get_arcface().get_faces(image_bgr)
    if not faces:
        return {"count": 0, "face": None}

    # Return data for the best (largest) face
    best = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    landmarks = best.kps.tolist() if best.kps is not None else None
    return {
        "count": len(faces),
        "face": {
            "bbox": [float(x) for x in best.bbox],
            "det_score": float(best.det_score),
            "landmarks": landmarks,
        },
    }


# ---------------------------------------------------------------------------
# Embedding extraction
# ---------------------------------------------------------------------------

def extract_embedding(image_bgr: np.ndarray) -> Optional[tuple[np.ndarray, float, list]]:
    """
    Run SCRFD + ArcFace on one BGR image.

    Returns (l2_normalised_embedding, det_score, faces) or None if no face.
    Raises ValueError if more than one face is detected.
    """
    faces = _get_arcface().get_faces(image_bgr)

    if not faces:
        return None
    if len(faces) > 1:
        raise ValueError(f"Multiple faces detected ({len(faces)}). Only one face per image is allowed.")

    face = faces[0]
    embedding = l2_normalize(np.asarray(face.embedding, dtype=np.float32))
    return embedding, float(face.det_score), faces


def process_images(base64_images: list[str]) -> tuple[list[np.ndarray], list[float], list[int], int, int, list[str]]:
    """
    Decode, detect, quality-check, and extract embeddings for all images.

    Returns (embeddings, det_scores, quality_scores, skipped, rejected, quality_failures).
    Raises ValueError if fewer than MIN_VALID_IMAGES pass.
    """
    embeddings: list[np.ndarray] = []
    det_scores: list[float] = []
    quality_scores: list[int] = []
    skipped = 0
    rejected = 0
    quality_failures: list[str] = []

    for idx, b64 in enumerate(base64_images):
        image_bgr = decode_base64_to_bgr(b64)
        if image_bgr is None:
            logger.warning("Image %d: decode failed — skipping", idx)
            skipped += 1
            continue

        try:
            result = extract_embedding(image_bgr)
        except ValueError as exc:
            logger.warning("Image %d: %s — rejecting", idx, exc)
            rejected += 1
            continue

        if result is None:
            logger.debug("Image %d: no face detected — skipping", idx)
            skipped += 1
            continue

        emb, score, faces = result

        # Quality validation
        qr = _quality_service.validate(image_bgr, faces)

        if not qr["ok"]:
            logger.warning(
                "Image %d: REJECTED code=%s message=%s det=%.3f",
                idx, qr["code"], qr["message"], score,
            )
            quality_failures.append(qr["code"])
            rejected += 1
            continue

        logger.info(
            "Image %d: ACCEPTED det=%.3f quality=%d blur=%.1f fw=%.3f",
            idx, score, qr["quality"], qr.get("blur", 0), qr.get("fw_ratio", 0),
        )
        embeddings.append(emb)
        det_scores.append(score)
        quality_scores.append(qr["quality"])

    valid = len(embeddings)
    if valid < MIN_VALID_IMAGES:
        if quality_failures:
            from collections import Counter
            top_code = Counter(quality_failures).most_common(1)[0][0]
            _code_msgs = {
                "NO_FACE": "No face detected in the image.",
                "MULTIPLE_FACES": "More than one face detected.",
                "OUT_OF_FRAME": "Face is partially out of the camera frame."
            }
            msg = _code_msgs.get(top_code, "Registration failed. Please try again.")
            raise ValueError(msg)
        raise ValueError(f"Only {valid} valid face image(s) detected. Minimum required is {MIN_VALID_IMAGES}.")

    return embeddings, det_scores, quality_scores, skipped, rejected, quality_failures


def select_best_diverse_embeddings(embeddings: list[np.ndarray], det_scores: list[float], quality_scores: list[int], max_samples: int = 10) -> tuple[list[np.ndarray], list[float], list[int]]:
    """
    Select up to `max_samples` from the candidate list.
    Prioritize high quality, but avoid saving nearly identical embeddings (cosine similarity > 0.98).
    """
    if len(embeddings) <= max_samples:
        return embeddings, det_scores, quality_scores
        
    # Sort by quality score descending
    combined = sorted(zip(embeddings, det_scores, quality_scores), key=lambda x: x[2], reverse=True)
    
    selected_embeddings = []
    selected_det_scores = []
    selected_quality_scores = []
    
    for emb, det, qual in combined:
        if len(selected_embeddings) >= max_samples:
            break
            
        # Check against already selected embeddings
        is_duplicate = False
        for sel_emb in selected_embeddings:
            if cosine_similarity(emb, sel_emb) > 0.98: # Highly similar pose/expression
                is_duplicate = True
                break
                
        if not is_duplicate or len(selected_embeddings) == 0:
            selected_embeddings.append(emb)
            selected_det_scores.append(det)
            selected_quality_scores.append(qual)
            
    # Fallback if diversity check filtered out too many (we still want up to max_samples)
    if len(selected_embeddings) < max_samples and len(embeddings) > len(selected_embeddings):
        for emb, det, qual in combined:
            if len(selected_embeddings) >= max_samples:
                break
            # Find in original list using some identity/hash or just comparing arrays
            if not any(np.array_equal(emb, sel) for sel in selected_embeddings):
                selected_embeddings.append(emb)
                selected_det_scores.append(det)
                selected_quality_scores.append(qual)
                
    return selected_embeddings, selected_det_scores, selected_quality_scores

# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

def _build_doc(user_id, embeddings, quality_scores, images_received, valid_images, avg_det_score, avg_quality) -> dict:
    return {
        "user_id": user_id,
        "embeddings": [emb.tolist() for emb in embeddings], # Array of arrays
        "quality_scores": quality_scores,
        "embedding_dimension": len(embeddings[0]) if embeddings else 512,
        "embedding_version": 2, # Version 2 supports multi-embedding
        "model": "ArcFace",
        "detector": "SCRFD",
        "model_name": "buffalo_l",
        "images_used": valid_images,
        "images_saved": len(embeddings),
        "images_received": images_received,
        "avg_detection_score": round(float(avg_det_score), 6),
        "avg_quality_score": avg_quality,
        "registered_at": datetime.utcnow().isoformat(),
    }


async def store_embedding(user_id, embeddings, quality_scores, images_received, valid_images, avg_det_score, avg_quality, firebase_db) -> None:
    doc = _build_doc(user_id, embeddings, quality_scores, images_received, valid_images, avg_det_score, avg_quality)

    if firebase_db:
        try:
            firebase_db.collection("face_embeddings").document(user_id).set(doc)
            logger.info("Stored ArcFace multi-embedding for user %s in Firestore", user_id)
            return
        except Exception as exc:
            logger.error("Firestore write failed for %s: %s — using demo store", user_id, exc)

    _demo_embeddings[user_id] = doc
    logger.info("Stored ArcFace multi-embedding for user %s in demo store", user_id)


def get_embedding(user_id: str, firebase_db) -> Optional[dict]:
    if firebase_db:
        try:
            doc = firebase_db.collection("face_embeddings").document(user_id).get()
            if doc.exists:
                return doc.to_dict()
        except Exception as exc:
            logger.error("Firestore read failed for %s: %s — using demo store", user_id, exc)
    return _demo_embeddings.get(user_id)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def register_face(user_id: str, base64_images: list[str], firebase_db) -> dict:
    """
    Full ArcFace registration pipeline with quality validation.
    Returns a success response dict.
    Raises ValueError for validation failures (message is user-facing).
    Raises RuntimeError with a structured dict for coded failures (duplicate, etc.).
    """
    images_received = len(base64_images)
    logger.info("Face registration started — user=%s images=%d", user_id, images_received)

    embeddings, det_scores, quality_scores, skipped, rejected, _ = process_images(base64_images)
    valid_images = len(embeddings)

    # Multi-frame logic: Select best diverse frames (up to 10)
    best_embs, best_dets, best_quals = select_best_diverse_embeddings(embeddings, det_scores, quality_scores, max_samples=10)
    
    avg_det_score = float(np.mean(best_dets))
    avg_quality = int(np.mean(best_quals))

    # Duplicate check against existing stored embedding (using the best one)
    existing = get_embedding(user_id, firebase_db)
    if existing and "embeddings" in existing:
        # User already registered
        raise RuntimeError("DUPLICATE_FACE|Face already registered")
    elif _quality_service.check_duplicate(best_embs[0], existing):
        raise RuntimeError("DUPLICATE_FACE|Face already registered")

    await store_embedding(user_id, best_embs, best_quals, images_received, valid_images, avg_det_score, avg_quality, firebase_db)

    logger.info("Registration complete — user=%s valid=%d saved=%d skipped=%d rejected=%d avg_quality=%d",
                user_id, valid_images, len(best_embs), skipped, rejected, avg_quality)

    return {
        "success": True,
        "message": "Face registered successfully",
        "quality": avg_quality,
        "images_received": images_received,
        "valid_images": valid_images,
        "saved_embeddings": len(best_embs),
        "embedding_dimension": len(best_embs[0]),
        "model": "ArcFace",
    }


def compare_embeddings(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    return cosine_similarity(embedding1, embedding2)


def verify_face(
    registered_doc: dict,
    current_embedding: np.ndarray,
    threshold: float = FACE_SIMILARITY_THRESHOLD,
) -> tuple[bool, float]:
    """
    Compare current embedding against ALL registered embeddings for the user.
    Returns (is_match, max_similarity).
    """
    if not registered_doc:
        return False, 0.0
        
    embeddings_list = []
    
    # Handle both V2 (multiple embeddings) and V1 (single embedding) documents
    if "embeddings" in registered_doc and isinstance(registered_doc["embeddings"], list):
        embeddings_list = [np.array(e, dtype=np.float32) for e in registered_doc["embeddings"]]
    elif "embedding" in registered_doc:
        embeddings_list = [np.array(registered_doc["embedding"], dtype=np.float32)]
        
    if not embeddings_list:
        return False, 0.0
        
    max_sim = -1.0
    for reg_emb in embeddings_list:
        sim = compare_embeddings(reg_emb, current_embedding)
        if sim > max_sim:
            max_sim = sim
            
    return max_sim >= threshold, float(max_sim)
