from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from typing import Dict, Any, List
from datetime import datetime
import logging
from pydantic import BaseModel
from app.core.database import get_database
from app.api.routes.auth import get_current_user
from app.services.attendance.attendance_service import AttendanceService
from app.schemas.schemas import RoleEnum

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/faculty", tags=["Faculty"])


@router.post("/create-session", response_model=Dict[str, Any])
async def create_attendance_session(
    subject_id: str,
    session_title: str,
    duration_minutes: int,
    latitude: float,
    longitude: float,
    radius_meters: int = 500,
    allow_faculty_hotspot: bool = False,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Create new attendance session"""
    try:
        if current_user.get("role") != RoleEnum.FACULTY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only faculty can create sessions"
            )
        
        faculty = await db["faculty"].find_one({"user_id": current_user["id"]})
        if not faculty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Faculty record not found"
            )
        
        attendance_service = AttendanceService(db)
        session_id = await attendance_service.create_session(
            subject_id,
            str(faculty["_id"]),
            session_title,
            duration_minutes,
            datetime.utcnow(),
            latitude,
            longitude,
            radius_meters,
            allow_faculty_hotspot
        )
        
        return {
            "message": "Session created successfully",
            "session_id": session_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create session error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create session"
        )


class HotspotPermissionUpdate(BaseModel):
    allow_faculty_hotspot: bool


@router.put("/session/{session_id}/hotspot-permission", response_model=Dict[str, Any])
async def toggle_hotspot_permission(
    session_id: str,
    payload: HotspotPermissionUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Toggle faculty hotspot permission for an existing session"""
    try:
        if current_user.get("role") not in [RoleEnum.FACULTY, RoleEnum.ADVISOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only faculty and advisors can toggle hotspot permission"
            )
            
        # Optional: Verify ownership if faculty
        from bson import ObjectId
        session = await db["attendance_sessions"].find_one({"_id": ObjectId(session_id)})
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
            
        await db["attendance_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"allow_faculty_hotspot": payload.allow_faculty_hotspot, "updated_at": datetime.utcnow()}}
        )
        
        # Invalidate cache
        from app.cache.redis_cache import cache
        await cache.delete(f"session:info:{session_id}")
        
        return {"message": "Hotspot permission updated successfully", "allow_faculty_hotspot": payload.allow_faculty_hotspot}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Toggle hotspot permission error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update hotspot permission"
        )


@router.post("/start-session", response_model=Dict[str, Any])
async def start_attendance_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Start attendance session"""
    try:
        if current_user.get("role") != RoleEnum.FACULTY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only faculty can start sessions"
            )
        
        attendance_service = AttendanceService(db)
        success = await attendance_service.start_session(session_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to start session"
            )
        
        return {"message": "Session started successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Start session error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start session"
        )


class FacultyHotspotConfig(BaseModel):
    hotspot_ssid: str
    hotspot_bssid: str

@router.put("/user/{user_id}/hotspot-config", response_model=Dict[str, Any])
async def update_faculty_hotspot_by_user(
    user_id: str,
    payload: FacultyHotspotConfig,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Update faculty hotspot details by user ID (Admin only)"""
    try:
        # Resolve target faculty user ID
        target_user_id = user_id
        faculty = await db["faculty"].find_one({"user_id": target_user_id})
        
        if not faculty:
            # Try by faculty_id
            faculty = await db["faculty"].find_one({"faculty_id": user_id})
            if faculty:
                target_user_id = faculty["user_id"]
                
        if not faculty:
            # Try to find by email or name
            query = {"$or": [
                {"email": user_id},
                {"first_name": {"$regex": f"^{user_id}$", "$options": "i"}},
                {"last_name": {"$regex": f"^{user_id}$", "$options": "i"}}
            ]}
            user = await db["users"].find_one(query)
            if user:
                target_user_id = str(user["_id"])
                faculty = await db["faculty"].find_one({"user_id": target_user_id})

        if not faculty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Faculty not found for identifier: {user_id}"
            )
            
        role = current_user.get("role")
        if role not in [RoleEnum.ADMIN, RoleEnum.ADVISOR]:
            if role != RoleEnum.FACULTY or current_user.get("id") != target_user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this faculty hotspot config"
                )
            
        await db["faculty"].update_one(
            {"_id": faculty["_id"]},
            {
                "$set": {
                    "hotspot_ssid": payload.hotspot_ssid,
                    "hotspot_bssid": payload.hotspot_bssid,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return {"message": "Faculty hotspot details updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update faculty hotspot error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update faculty hotspot details"
        )


@router.post("/end-session", response_model=Dict[str, Any])
async def end_attendance_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """End attendance session"""
    try:
        if current_user.get("role") != RoleEnum.FACULTY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only faculty can end sessions"
            )
        
        attendance_service = AttendanceService(db)
        success = await attendance_service.end_session(session_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to end session"
            )
        
        return {"message": "Session ended successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"End session error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to end session"
        )


@router.get("/sessions", response_model=Dict[str, Any])
async def get_faculty_sessions(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Get all sessions for faculty"""
    try:
        if current_user.get("role") != RoleEnum.FACULTY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only faculty can view sessions"
            )
        
        faculty = await db["faculty"].find_one({"user_id": current_user["id"]})
        if not faculty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Faculty record not found"
            )
        
        sessions = await db["attendance_sessions"].find(
            {"faculty_id": str(faculty["_id"])}
        ).to_list(None)
        
        return {
            "sessions": sessions,
            "total_sessions": len(sessions)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get sessions error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch sessions"
        )


@router.get("/session/{session_id}/attendance", response_model=Dict[str, Any])
async def get_session_attendance(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Get attendance records for a session"""
    try:
        if current_user.get("role") != RoleEnum.FACULTY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only faculty can view session attendance"
            )
        
        records = await db["attendance_records"].find(
            {"session_id": session_id}
        ).to_list(None)
        
        present_count = len([r for r in records if r["status"] == "present"])
        
        # Format ObjectIds to strings
        for r in records:
            r["_id"] = str(r["_id"])
            
        return {
            "records": records,
            "total_present": present_count,
            "total_records": len(records)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get session attendance error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch attendance"
        )


from pydantic import BaseModel

class ManualMarkRequest(BaseModel):
    student_id: str
    status: str  # "present", "absent", "od"


@router.post("/session/{session_id}/mark", response_model=Dict[str, Any])
async def manual_mark_attendance(
    session_id: str,
    payload: ManualMarkRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Manually mark student attendance for a session"""
    try:
        if current_user.get("role") != RoleEnum.FACULTY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only faculty can manually mark attendance"
            )
            
        session = await db["attendance_sessions"].find_one({"_id": ObjectId(session_id)})
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
            
        student = await db["students"].find_one({"_id": ObjectId(payload.student_id)})
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
            
        # Upsert attendance record
        existing = await db["attendance_records"].find_one({
            "session_id": session_id,
            "student_id": payload.student_id
        })
        
        if existing:
            await db["attendance_records"].update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "status": payload.status,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            # Adjust session counts if state changed
            if existing["status"] != "present" and payload.status == "present":
                await db["attendance_sessions"].update_one(
                    {"_id": ObjectId(session_id)},
                    {"$inc": {"total_students_present": 1}}
                )
            elif existing["status"] == "present" and payload.status != "present":
                await db["attendance_sessions"].update_one(
                    {"_id": ObjectId(session_id)},
                    {"$inc": {"total_students_present": -1}}
                )
        else:
            await db["attendance_records"].insert_one({
                "session_id": session_id,
                "student_id": payload.student_id,
                "marking_time": datetime.utcnow(),
                "status": payload.status,
                "latitude": 0.0,
                "longitude": 0.0,
                "wifi_bssid": "manual",
                "face_confidence": 1.0,
                "verified": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
            if payload.status == "present":
                await db["attendance_sessions"].update_one(
                    {"_id": ObjectId(session_id)},
                    {"$inc": {"total_students_present": 1}}
                )
                
        # Invalidate session info cache
        from app.cache.redis_cache import cache
        await cache.delete(f"session:info:{session_id}")
        
        return {"message": f"Student marked {payload.status} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Manual mark error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to manually mark attendance"
        )


@router.get("/session/{session_id}/export", response_model=Dict[str, Any])
async def export_session_attendance(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Retrieve complete attendance roster with student details for Excel/PDF export"""
    try:
        if current_user.get("role") != RoleEnum.FACULTY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only faculty can export session attendance"
            )
            
        session = await db["attendance_sessions"].find_one({"_id": ObjectId(session_id)})
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
            
        subject = await db["subjects"].find_one({"_id": ObjectId(session["subject_id"])})
        if not subject:
            # Fallback to general student roster if subject details are missing
            students = await db["students"].find().to_list(None)
        else:
            # Query students enrolled in the department and semester
            students = await db["students"].find({
                "department": subject["department_id"],
                "semester": subject["semester"]
            }).to_list(None)
            
        # Get all records for this session
        records = await db["attendance_records"].find({"session_id": session_id}).to_list(None)
        records_map = {r["student_id"]: r for r in records}
        
        export_data = []
        for student in students:
            user = await db["users"].find_one({"_id": ObjectId(student["user_id"])})
            student_id_str = str(student["_id"])
            rec = records_map.get(student_id_str)
            
            export_data.append({
                "student_id": student_id_str,
                "first_name": user["first_name"] if user else "Unknown",
                "last_name": user["last_name"] if user else "Unknown",
                "enrollment_number": student["enrollment_number"],
                "department": student["department"],
                "batch": student["batch"],
                "semester": student["semester"],
                "status": rec["status"] if rec else "absent",
                "marking_time": rec["marking_time"].isoformat() if rec else None
            })
            
        return {
            "session_title": session["session_title"],
            "subject_name": subject["name"] if subject else "Unknown",
            "date": session["created_at"].isoformat(),
            "export_data": export_data,
            "total_students": len(students)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve export roster"
        )

