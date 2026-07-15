import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from config import firebase_db
from middleware.auth import get_current_user, require_roles
from services.face_recognition.pipeline import register_face, detect_faces_in_image
from services.face_recognition.utils import decode_base64_to_bgr

logger = logging.getLogger(__name__)
router = APIRouter()

# Demo in-memory attendance storage
demo_attendance: list = []


class FaceRegisterRequest(BaseModel):
    image_data: list[str]


class FaceDetectRequest(BaseModel):
    image: str  # single base64 image


@router.post("/face-detect")
async def face_detect(body: FaceDetectRequest, current_user: dict = Depends(get_current_user)):
    """Real-time face detection for live guidance UI (~5fps polling)."""
    image_bgr = decode_base64_to_bgr(body.image)
    if image_bgr is None:
        return {"count": 0, "face": None}
    try:
        return detect_faces_in_image(image_bgr)
    except Exception as exc:
        logger.warning("face-detect error: %s", exc)
        return {"count": 0, "face": None}


@router.post("/face-register")
async def face_register(body: FaceRegisterRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("uid") or current_user.get("id")

    if not body.image_data:
        raise HTTPException(status_code=400, detail={"success": False, "code": "NO_IMAGES", "message": "No images provided"})

    try:
        result = await register_face(
            user_id=user_id,
            base64_images=body.image_data,
            firebase_db=firebase_db,
        )
        return result
    except RuntimeError as exc:
        # Structured coded failures (duplicate, etc.)
        parts = str(exc).split("|", 1)
        code = parts[0] if len(parts) == 2 else "REGISTRATION_FAILED"
        message = parts[1] if len(parts) == 2 else str(exc)
        logger.warning("Face registration coded failure - user=%s code=%s", user_id, code)
        raise HTTPException(status_code=400, detail={"success": False, "code": code, "message": message})
    except ValueError as exc:
        logger.warning("Face registration validation failed - user=%s: %s", user_id, exc)
        raise HTTPException(status_code=400, detail={"success": False, "code": "VALIDATION_FAILED", "message": str(exc)})
    except Exception as exc:
        logger.error("Face registration error - user=%s: %s", user_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail={"success": False, "code": "SERVER_ERROR", "message": "Face registration failed. Please try again."})


import os
import tempfile
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.services.face_recognition.video_service import extract_frames
from services.face_recognition.pipeline import register_face, detect_faces_in_image, get_embedding, verify_face, extract_embedding
import time

@router.post("/face-verify/video")
async def verify_faces_video(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Detect faces from a short video and verify against registered multi-embeddings"""
    user_id = current_user.get("uid") or current_user.get("id")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        frames = extract_frames(tmp_path, fps=2, max_seconds=5)
    except Exception as e:
        logger.error(f"Error reading or processing video file: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to process video file: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.error(f"Failed to delete temp file {tmp_path}: {e}")

    results = []
    frame_embeddings = {}
    frame_scores = {}

    for idx, frame in enumerate(frames):
        try:
            result = extract_embedding(frame)
            if result:
                frame_embeddings[idx] = result[0]
                frame_scores[idx] = result[1]
                results.append({"index": idx, "detected": True, "detection_score": result[1]})
            else:
                results.append({"index": idx, "detected": False, "detection_score": 0.0})
        except ValueError:
            # Multiple faces or other error
            results.append({"index": idx, "detected": False, "detection_score": 0.0})

    best_idx = max(frame_scores, key=frame_scores.get) if frame_scores else None
    verified = False
    similarity = 0.0
    
    if best_idx is not None:
        best_emb = frame_embeddings[best_idx]
        registered_doc = get_embedding(user_id, firebase_db)
        if not registered_doc:
            raise HTTPException(status_code=400, detail="Face not registered. Please register your face first.")
            
        verified, similarity = verify_face(registered_doc, best_emb)

    if not verified:
        raise HTTPException(
            status_code=401,
            detail=f"Face verification failed (similarity={similarity:.4f}). Please try again in better lighting."
        )

    return {
        "verified": verified,
        "match_status": "matched" if verified else "not_matched",
        "similarity_score": float(similarity)
    }

class MarkAttendanceRequest(BaseModel):
    courseId: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    faceDistance: Optional[float] = None
    confidence: Optional[float] = None


@router.post("/mark", status_code=201)
async def mark_attendance(body: MarkAttendanceRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("uid") or current_user.get("id")
    user_email = current_user.get("email")

    record = {
        "userId": user_id,
        "userEmail": user_email,
        "courseId": body.courseId,
        "timestamp": datetime.utcnow().isoformat(),
        "latitude": body.latitude,
        "longitude": body.longitude,
        "faceDistance": body.faceDistance,
        "confidence": body.confidence,
        "status": "present",
    }

    if firebase_db:
        try:
            firebase_db.collection("attendance").add(record)
            return {"message": "Attendance marked", "attendance": record}
        except Exception:
            pass

    # Demo mode
    demo_attendance.append(record)
    return {"message": "Attendance marked (demo)", "attendance": record}


@router.get("/my-records")
async def get_attendance(
    courseId: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("uid") or current_user.get("id")

    if firebase_db:
        try:
            query = firebase_db.collection("attendance").where("userId", "==", user_id)
            if courseId:
                query = query.where("courseId", "==", courseId)

            docs = query.stream()
            records = [{"id": doc.id, **doc.to_dict()} for doc in docs]

            if startDate or endDate:
                filtered = []
                for r in records:
                    ts = r.get("timestamp")
                    record_date = ts if isinstance(ts, datetime) else datetime.fromisoformat(str(ts))
                    if startDate and record_date < datetime.fromisoformat(startDate):
                        continue
                    if endDate and record_date > datetime.fromisoformat(endDate):
                        continue
                    filtered.append(r)
                records = filtered

            return {"total": len(records), "records": records}
        except Exception:
            pass

    # Demo mode
    records = [r for r in demo_attendance if r["userId"] == user_id]
    if courseId:
        records = [r for r in records if r["courseId"] == courseId]
    return {"total": len(records), "records": records}


@router.get("/stats")
async def get_attendance_stats(
    courseId: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("uid") or current_user.get("id")

    if firebase_db:
        try:
            query = firebase_db.collection("attendance").where("userId", "==", user_id)
            if courseId:
                query = query.where("courseId", "==", courseId)
            docs = query.stream()
            records = [doc.to_dict() for doc in docs]
            total = len(records)
            present = sum(1 for r in records if r.get("status") == "present")
            percentage = round((present / total) * 100, 2) if total > 0 else 0
            return {"total": total, "present": present, "absent": total - present, "percentage": percentage}
        except Exception:
            pass

    # Demo mode
    records = [r for r in demo_attendance if r["userId"] == user_id]
    if courseId:
        records = [r for r in records if r["courseId"] == courseId]
    total = len(records)
    present = sum(1 for r in records if r.get("status") == "present")
    percentage = round((present / total) * 100, 2) if total > 0 else 0
    return {"total": total, "present": present, "absent": total - present, "percentage": percentage}


@router.get("/course/{courseId}")
async def get_course_attendance(
    courseId: str,
    current_user: dict = Depends(require_roles("faculty", "advisor", "hod")),
):
    if firebase_db:
        try:
            docs = firebase_db.collection("attendance").where("courseId", "==", courseId).stream()
            records = [{"id": doc.id, **doc.to_dict()} for doc in docs]
            grouped: dict = {}
            for r in records:
                email = r.get("userEmail", "unknown")
                grouped.setdefault(email, []).append(r)
            return {
                "courseId": courseId,
                "totalRecords": len(records),
                "students": len(grouped),
                "attendance": grouped,
            }
        except Exception:
            pass

    # Demo mode
    records = [r for r in demo_attendance if r["courseId"] == courseId]
    grouped: dict = {}
    for r in records:
        email = r.get("userEmail", "unknown")
        grouped.setdefault(email, []).append(r)
    return {
        "courseId": courseId,
        "totalRecords": len(records),
        "students": len(grouped),
        "attendance": grouped,
    }
