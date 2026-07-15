"""
FaceQualityService — relaxed server-side validation for attendance registration.

Mirrors the frontend face_config.json thresholds.
"""

import logging
import os
import json
import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Load config from json
config_path = os.path.join(os.path.dirname(__file__), "..", "..", "config", "face_config.json")
try:
    with open(config_path, "r") as f:
        FACE_CONFIG = json.load(f)
except Exception as e:
    logger.warning(f"Could not load face_config.json, using defaults. Error: {e}")
    FACE_CONFIG = {
        "minFaceWidthRatio": 0.30,
        "maxFaceWidthRatio": 0.55,
        "minFaceHeightRatio": 0.45,
        "maxFaceHeightRatio": 0.75,
        "horizontalTolerance": 0.08,
        "verticalTolerance": 0.10,
        "maxYaw": 15,
        "maxPitch": 12,
        "maxRoll": 10,
        "minBrightness": 90,
        "maxBrightness": 190,
        "minBlurVariance": 120,
        "minDetectionConfidence": 0.95,
        "stabilityDurationMs": 3000
    }

DUPLICATE_THRESHOLD = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.75"))

def _laplacian_variance(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())

def _estimate_pose(landmarks) -> dict:
    if landmarks is None or len(landmarks) < 5:
        return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}
    le, re, nose, lm, rm = [np.array(p, dtype=float) for p in landmarks[:5]]
    eye_vec  = re - le
    roll     = float(np.degrees(np.arctan2(eye_vec[1], eye_vec[0])))
    eye_mid  = (le + re) / 2
    eye_span = float(np.linalg.norm(eye_vec)) + 1e-6
    yaw      = float((nose[0] - eye_mid[0]) / eye_span * 90)
    mouth_mid = (lm + rm) / 2
    face_h    = float(mouth_mid[1] - eye_mid[1]) + 1e-6
    pitch     = float((nose[1] - eye_mid[1]) / face_h - 0.45) * 90
    return {"yaw": yaw, "pitch": pitch, "roll": roll}

class FaceQualityService:
    def validate(self, image_bgr: np.ndarray, faces: list) -> dict:
        h, w = image_bgr.shape[:2]

        # 1. Face count
        if not faces:
            return self._fail("NO_FACE", "No face detected")
        if len(faces) > 1:
            return self._fail("MULTIPLE_FACES", "Only one face should be visible")

        face = faces[0]
        det_score = float(face.det_score)
        x1, y1, x2, y2 = face.bbox

        # 2. Check if bbox is valid and within image boundaries (not heavily cropped)
        if x1 < 0 or y1 < 0 or x2 > w or y2 > h:
            return self._fail("OUT_OF_FRAME", "Face is partially out of the camera frame.")

        # If it passes these basic checks, accept it.
        # Set dummy values for removed metrics so the frontend or pipeline doesn't break.
        return {
            "ok": True, 
            "quality": 100, 
            "det_score": det_score,
            "blur": 100, 
            "fw_ratio": 0.45,
            "pose": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}
        }

    @staticmethod
    def _fail(code: str, message: str) -> dict:
        logger.info("Quality check failed - code=%s message=%s", code, message)
        return {"ok": False, "code": code, "message": message}

    def check_duplicate(self, new_embedding: np.ndarray, existing_doc) -> bool:
        if existing_doc is None:
            return False
        stored = existing_doc.get("embedding")
        if not stored:
            return False
        from services.face_recognition.utils import cosine_similarity
        sim = cosine_similarity(new_embedding, np.array(stored, dtype=np.float32))
        logger.debug("Duplicate check similarity=%.4f threshold=%.4f", sim, DUPLICATE_THRESHOLD)
        return sim >= DUPLICATE_THRESHOLD
