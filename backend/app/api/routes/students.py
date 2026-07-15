from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from typing import Dict, Any, List, Optional
from datetime import datetime
import numpy as np
from pydantic import BaseModel
from time import perf_counter
from app.core.database import get_database
from app.api.routes.auth import get_current_user
from app.services.attendance.attendance_service import AttendanceService
from app.schemas.schemas import RoleEnum, AnnouncementResponse
import logging
from app.services.face_recognition.embedding_service import FaceEmbeddingService
from app.services.face_recognition.registration_service import FaceRegistrationService
from app.services.face_recognition.verification_service import FaceVerificationService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/students", tags=["Students"])


class FaceRegisterRequest(BaseModel):
    image_data: List[str]


class MarkAttendanceRequest(BaseModel):
    session_id: str
    image_data: Optional[str] = None
    wifi_bssid: str
    wifi_rssi: Optional[int] = None
    hotspot_only: Optional[bool] = False

class ODRequestPayload(BaseModel):
    session_id: str
    reason: str
    supporting_document_url: Optional[str] = None


@router.post("/register-face", response_model=Dict[str, Any])
async def register_face(
    payload: FaceRegisterRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Register student face with base64 image data"""
    try:
        if current_user.get("role") != RoleEnum.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only students can register face"
            )
        
        # Get student record
        student = await db["students"].find_one({"user_id": current_user["id"]})
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student record not found"
            )
        
        embedding_service = FaceEmbeddingService()
        registration_service = FaceRegistrationService(db, embedding_service)
        
        # We need the FaceQualityService (which is now simplified) to check bounds and face count
        from services.face_recognition.quality import FaceQualityService
        quality_service = FaceQualityService()

        embeddings = []
        detection_scores = []
        
        for img_data in payload.image_data:
            image_bgr = embedding_service.preprocess_image(img_data)
            if image_bgr is None:
                continue
                
            faces = embedding_service.get_faces(image_bgr)
            qr = quality_service.validate(image_bgr, faces)
            if not qr["ok"]:
                # The user wants to reject if ANY of the checks fail during registration
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Registration failed: {qr['message']}"
                )
                
            face = faces[0]
            from services.face_recognition.utils import l2_normalize
            emb = l2_normalize(np.asarray(face.embedding, dtype=np.float32))
            embeddings.append(emb)
            detection_scores.append(float(face.det_score))

        if not embeddings:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No faces detected in any of the provided images"
            )

        candidate_embeddings = []
        for emb, score in zip(embeddings, detection_scores):
             candidate_embeddings.append((emb, score))
        
        # Sort by detection score descending
        candidate_embeddings.sort(key=lambda x: x[1], reverse=True)
        
        selected_embs = []
        for emb, score in candidate_embeddings:
            if len(selected_embs) >= 10:
                break
            selected_embs.append(emb)

        embedding_id = await registration_service.register_student_face(
            student_id=str(student["_id"]),
            embeddings=selected_embs,
            confidence_score=float(np.mean([score for emb, score in candidate_embeddings]) if candidate_embeddings else 0.0),
            image_metadata={
                "engine": "insightface_arcface",
                "detector": "scrfd",
                "samples_received": len(payload.image_data),
                "samples_stored": len(selected_embs),
                "format": "base64_processed_batch",
            },
        )

        # Invalidate student embedding cache
        from app.cache.redis_cache import cache
        await cache.delete(f"student:embeddings:{student['_id']}")

        return {
            "message": f"Face registered successfully ({len(selected_embs)} embeddings)",
            "embedding_id": embedding_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Face registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Face registration failed: {str(e)}"
        )


@router.get("/attendance-history", response_model=Dict[str, Any])
async def get_attendance_history(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Get student attendance history"""
    try:
        if current_user.get("role") != RoleEnum.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only students can view attendance"
            )
        
        student = await db["students"].find_one({"user_id": current_user["id"]})
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student record not found"
            )
        
        attendance_service = AttendanceService(db)
        history = await attendance_service.get_student_attendance_history(str(student["_id"]))
        
        # Format object id for JSON response
        formatted_history = []
        for r in history:
            r["_id"] = str(r["_id"])
            formatted_history.append(r)
            
        return {
            "attendance_records": formatted_history,
            "total_records": len(formatted_history)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get attendance history error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch attendance history"
        )


@router.get("/attendance-percentage", response_model=Dict[str, Any])
async def get_attendance_percentage(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Get student attendance percentage"""
    try:
        if current_user.get("role") != RoleEnum.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only students can view attendance percentage"
            )
        
        student = await db["students"].find_one({"user_id": current_user["id"]})
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student record not found"
            )
        
        attendance_service = AttendanceService(db)
        percentage = await attendance_service.calculate_attendance_percentage(str(student["_id"]))
        
        return {
            "attendance_percentage": percentage,
            "status": "good" if percentage >= 75.0 else "warning"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get attendance percentage error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate attendance percentage"
        )


@router.post("/mark-attendance", response_model=Dict[str, Any])
async def mark_attendance(
    payload: MarkAttendanceRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Mark attendance with face verification using base64 image data"""
    try:
        if current_user.get("role") != RoleEnum.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only students can mark attendance"
            )
        
        student = await db["students"].find_one({"user_id": current_user["id"]})
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student record not found"
            )
        
        # Verify face if not hotspot only
        if not payload.hotspot_only:
            embedding_service = FaceEmbeddingService()
            registration_service = FaceRegistrationService(db, embedding_service)
            verification_service = FaceVerificationService()
            recognition_started = perf_counter()
            
            registered_emb = await registration_service.get_latest_embedding(str(student["_id"]))
            if not registered_emb:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Face not registered. Please register your face first."
                )
            
            if not payload.image_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Image data is required for face verification."
                )
            
            # SCRFD detect + ArcFace extract
            current_result = embedding_service.extract_embedding_from_base64(payload.image_data)
            if current_result is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No face detected or failed to process webcam capture image"
                )
            
            current_embedding, detection_score = current_result
            
            reg_embs = registered_emb.get("embeddings")
            if not reg_embs:
                reg_embs = [registered_emb.get("embedding")]
            
            is_verified, similarity, confidence = verification_service.verify_face(reg_embs, current_embedding)
            recognition_time_ms = round((perf_counter() - recognition_started) * 1000, 2)
            
            if not is_verified:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=(
                        f"Face verification failed (similarity={similarity:.4f}). "
                        "Please try again in better lighting."
                    )
                )
        else:
            similarity = 1.0
            confidence = 1.0
            detection_score = 1.0
            recognition_time_ms = 0.0
        
        # Mark attendance
        attendance_service = AttendanceService(db)
        success, message = await attendance_service.mark_attendance(
            payload.session_id,
            str(student["_id"]),
            payload.wifi_bssid,
            confidence,
            wifi_rssi=payload.wifi_rssi,
            hotspot_only=payload.hotspot_only
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
        
        return {
            "message": message,
            "face_verified": True,
            "match_status": "matched",
            "similarity_score": float(similarity),
            "confidence": float(confidence),
            "detection_score": float(detection_score),
            "recognition_time_ms": recognition_time_ms,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Mark attendance error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark attendance: {str(e)}"
        )


@router.post("/od-request", response_model=Dict[str, Any])
async def submit_od_request(
    payload: ODRequestPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Submit On Duty (OD) request for a session"""
    try:
        if current_user.get("role") != RoleEnum.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only students can submit OD requests"
            )
        
        student = await db["students"].find_one({"user_id": current_user["id"]})
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student record not found"
            )
        
        # Check if attendance is already marked
        existing_rec = await db["attendance_records"].find_one({
            "session_id": payload.session_id,
            "student_id": str(student["_id"])
        })
        if existing_rec:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attendance already marked for this session"
            )
            
        # Create OD request
        od_doc = {
            "student_id": str(student["_id"]),
            "session_id": payload.session_id,
            "reason": payload.reason,
            "supporting_document_url": payload.supporting_document_url,
            "status": "pending",
            "requested_at": datetime.utcnow(),
            "approved_by": None,
            "approved_at": None,
            "comment": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await db["od_requests"].insert_one(od_doc)
        
        # Create Notification for Advisor (students are associated with departments/batches)
        # We find users with role advisor in same department
        advisors = await db["users"].find({"role": RoleEnum.ADVISOR}).to_list(None)
        for adv in advisors:
            notif = {
                "user_id": str(adv["_id"]),
                "title": "New OD Request",
                "message": f"Student {current_user['first_name']} {current_user['last_name']} requested OD.",
                "notification_type": "od_approval",
                "data": {"od_request_id": str(result.inserted_id)},
                "read": False,
                "created_at": datetime.utcnow()
            }
            await db["notifications"].insert_one(notif)
            
        return {
            "message": "OD Request submitted successfully",
            "od_request_id": str(result.inserted_id)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Submit OD request error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit OD request"
        )

class FaceDetectRequest(BaseModel):
    images: List[str]

@router.post("/face-detect", response_model=Dict[str, Any])
async def detect_faces(
    payload: FaceDetectRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database),
):
    """Return detection results for a batch of base64 images"""
    detection_service = FaceEmbeddingService()
    results = []
    for idx, img in enumerate(payload.images):
        try:
            result = detection_service.extract_embedding_from_base64(img)
            detected = result is not None
            det_score = float(result[1]) if result else 0.0
            results.append({"index": idx, "detected": detected, "detection_score": det_score})
        except Exception as e:
            results.append({"index": idx, "detected": False, "error": str(e)})
    return {"results": results}

import os
import tempfile
from app.services.face_recognition.video_service import extract_frames

@router.post("/face-detect/video", response_model=Dict[str, Any])
async def detect_faces_video(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database),
):
    """Detect faces from a short video (<=12 s) and verify against registered embedding"""
    # Ensure user is student
    if current_user.get("role") != RoleEnum.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can use video detection"
        )

    # Save uploaded video to a temporary file
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Extract frames (1 fps) – limit to first 12 s
        frames = extract_frames(tmp_path, fps=1, max_seconds=12)
    except Exception as e:
        logger.error(f"Error reading or processing video file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process video file: {str(e)}"
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.error(f"Failed to delete temp file {tmp_path}: {e}")

    # Run SCRFD+ArcFace on frames
    detection_service = FaceEmbeddingService()
    results = []
    frame_embeddings: Dict[int, np.ndarray] = {}
    frame_scores: Dict[int, float] = {}

    for idx, frame in enumerate(frames):
        result = detection_service.extract_embedding_with_score(frame)
        detected = result is not None
        det_score = float(result[1]) if result else 0.0
        if result is not None:
            frame_embeddings[idx] = result[0]
            frame_scores[idx] = det_score
        results.append({"index": idx, "detected": detected, "detection_score": det_score})

    # Choose best frame by detection score
    best_idx = max(frame_scores, key=frame_scores.get) if frame_scores else None
    verified = False
    similarity = 0.0
    confidence = 0.0
    recognition_time_ms = 0.0

    if best_idx is not None:
        recognition_started = perf_counter()
        best_emb = frame_embeddings[best_idx]

        # Retrieve registered embedding
        student = await db["students"].find_one({"user_id": current_user["id"]})
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student record not found"
            )

        registration_service = FaceRegistrationService(db, detection_service)
        registered = await registration_service.get_latest_embedding(str(student["_id"]))
        if registered:
            reg_embs = registered.get("embeddings")
            if not reg_embs:
                reg_embs = [registered.get("embedding")]
                
            verification_service = FaceVerificationService()
            verified, similarity, confidence = verification_service.verify_face(reg_embs, best_emb)
            recognition_time_ms = round((perf_counter() - recognition_started) * 1000, 2)

    return {
        "results": results,
        "best_frame_index": best_idx,
        "verified": verified,
        "match_status": "matched" if verified else "not_matched",
        "similarity_score": float(similarity),
        "confidence": float(confidence),
        "recognition_time_ms": recognition_time_ms,
    }


@router.get("/announcements", response_model=List[AnnouncementResponse])
async def get_student_announcements(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Get announcements for the student's batch"""
    try:
        if current_user.get("role") != RoleEnum.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only students can view these announcements"
            )

        student = await db["students"].find_one({"user_id": current_user["id"]})
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student record not found"
            )

        query = {
            "batch": student["batch"],
            "department": student["department"]
        }
        if student.get("section"):
            # If section exists, optionally match by section as well.
            # Announcements could be batch-wide without section, or section-specific.
            # But based on our schema, section is required for AnnouncementCreate. Let's exact match it.
            query["section"] = student["section"]

        announcements = await db["announcements"].find(query).sort("created_at", -1).to_list(None)
        
        for a in announcements:
            a["id"] = str(a["_id"])
            a["_id"] = str(a["_id"])
            
        return announcements
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get student announcements error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve announcements"
        )
