from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from typing import Dict, Any, List, Optional
from bson import ObjectId
from datetime import datetime
import torch
import numpy as np
from pydantic import BaseModel
from app.core.database import get_database
from app.api.routes.auth import get_current_user
from app.services.auth.auth_service import AuthService
from app.services.attendance.attendance_service import AttendanceService
from app.schemas.schemas import RoleEnum
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/students", tags=["Students"])


class FaceRegisterRequest(BaseModel):
    image_data: List[str]


class MarkAttendanceRequest(BaseModel):
    session_id: str
    image_data: str
    wifi_bssid: str


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
        
        from app.services.face_recognition.embedding_service import FaceEmbeddingService
        from app.services.face_recognition.registration_service import FaceRegistrationService
        
        embedding_service = FaceEmbeddingService()
        registration_service = FaceRegistrationService(db, embedding_service)
        
        # Preprocess each image into a tensor
        tensors = []
        for img_data in payload.image_data:
            tensor = embedding_service.preprocess_image(img_data, strict_detection=True)
            if tensor is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="One or more images failed to process or contain no face"
                )
            tensors.append(tensor)
        # Stack tensors into a batch (shape: N, C, H, W)
        batch_tensor = torch.cat(tensors, dim=0)
        # Extract batch embeddings
        batch_embeddings = embedding_service.extract_batch_embeddings(batch_tensor)
        # Average embeddings (axis 0) to get a single 512-d vector
        averaged_embedding = np.mean(batch_embeddings, axis=0)
        # Register the averaged embedding
        embedding_id = await registration_service.register_student_face(
            student_id=str(student["_id"]),
            embedding=averaged_embedding,
            confidence_score=1.0,
            image_metadata={"format": "base64_processed_batch"}
        )

        # Invalidate student embedding cache
        from app.cache.redis_cache import cache
        await cache.delete(f"student:embeddings:{student['_id']}")

        return {
            "message": "Face registered successfully (averaged)",
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
        
        # Verify face
        from app.services.face_recognition.registration_service import FaceRegistrationService
        from app.services.face_recognition.verification_service import FaceVerificationService
        from app.services.face_recognition.embedding_service import FaceEmbeddingService
        import numpy as np
        
        embedding_service = FaceEmbeddingService()
        registration_service = FaceRegistrationService(db, embedding_service)
        verification_service = FaceVerificationService()
        
        registered_emb = await registration_service.get_latest_embedding(str(student["_id"]))
        if not registered_emb:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Face not registered. Please register your face first."
            )
        
        # Preprocess and extract current embedding
        face_tensor = embedding_service.preprocess_image(payload.image_data, strict_detection=True)
        if face_tensor is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No face detected or failed to process webcam capture image"
            )
        
        current_embedding = embedding_service.extract_embedding(face_tensor)
        registered_embedding = np.array(registered_emb["embedding"])
        
        is_verified, confidence = verification_service.verify_face(registered_embedding, current_embedding)
        
        if not is_verified:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Face verification failed. Please try again in better lighting."
            )
        
        # Mark attendance
        attendance_service = AttendanceService(db)
        success, message = await attendance_service.mark_attendance(
            payload.session_id,
            str(student["_id"]),
            payload.wifi_bssid,
            confidence
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
        
        return {
            "message": message,
            "face_verified": True,
            "confidence": confidence
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
    from app.services.face_recognition.embedding_service import FaceEmbeddingService
    detection_service = FaceEmbeddingService()
    results = []
    for idx, img in enumerate(payload.images):
        try:
            tensor = detection_service.preprocess_image(img, strict_detection=True)
            detected = tensor is not None
            results.append({"index": idx, "detected": detected})
        except Exception as e:
            results.append({"index": idx, "detected": False, "error": str(e)})
    return {"results": results}

import os
import tempfile
import base64
import cv2
from app.services.face_recognition.video_service import extract_frames
from app.services.face_recognition.registration_service import FaceRegistrationService
from app.services.face_recognition.verification_service import FaceVerificationService
from app.services.face_recognition.embedding_service import FaceEmbeddingService

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

    # Run detection on frames
    detection_service = FaceEmbeddingService()
    results = []
    for idx, frame in enumerate(frames):
        # Encode frame to base64 JPEG for reuse of preprocess_image
        _, buffer = cv2.imencode('.jpg', frame)
        b64_str = base64.b64encode(buffer).decode('utf-8')
        tensor = detection_service.preprocess_image(b64_str, strict_detection=True)
        detected = tensor is not None
        results.append({"index": idx, "detected": detected})

    # Choose best frame (first detected)
    best_idx = next((r["index"] for r in results if r["detected"]), None)
    verified = False
    if best_idx is not None:
        # Get embedding for best frame
        best_frame = frames[best_idx]
        _, buffer = cv2.imencode('.jpg', best_frame)
        b64_best = base64.b64encode(buffer).decode('utf-8')
        best_tensor = detection_service.preprocess_image(b64_best, strict_detection=True)
        if best_tensor is not None:
            best_emb = detection_service.extract_embedding(best_tensor)
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
                reg_emb = np.array(registered["embedding"])
                verification_service = FaceVerificationService()
                is_verified, _ = verification_service.verify_face(reg_emb, best_emb)
                verified = is_verified

    return {"results": results, "best_frame_index": best_idx, "verified": verified}
