from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from typing import Dict, Any, List
from bson import ObjectId
import logging
from pydantic import BaseModel
from app.core.database import get_database
from app.api.routes.auth import get_current_user
from app.schemas.schemas import RoleEnum
from app.services.attendance.attendance_service import AttendanceService, WiFiValidationService
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/attendance", tags=["Attendance"])


class WiFiBSSIDPayload(BaseModel):
    bssid: str
    bssid_type: str = "college"  # "college" or "faculty"


@router.get("/active-sessions", response_model=List[Dict[str, Any]])
async def get_active_sessions_for_student(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Get active attendance sessions relevant to the logged-in Student's department/semester"""
    try:
        if current_user.get("role") != RoleEnum.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only students can query active attendance sessions"
            )
            
        student = await db["students"].find_one({"user_id": current_user["id"]})
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student record not found"
            )
            
        attendance_service = AttendanceService(db)
        sessions = await attendance_service.get_active_sessions()
        
        # Filter sessions that match the student's department/semester
        filtered_sessions = []
        for s in sessions:
            subject = await db["subjects"].find_one({"_id": ObjectId(s["subject_id"])})
            if subject and subject["department_id"] == student["department"] and subject["semester"] == student["semester"]:
                # Check if student already marked attendance
                already_marked = await db["attendance_records"].find_one({
                    "session_id": str(s["_id"]),
                    "student_id": str(student["_id"])
                })
                
                # Check if there is a pending OD request
                od_req = await db["od_requests"].find_one({
                    "session_id": str(s["_id"]),
                    "student_id": str(student["_id"])
                })
                
                s["id"] = str(s["_id"])
                s["_id"] = str(s["_id"])
                s["subject_name"] = subject["name"]
                s["subject_code"] = subject["code"]
                s["already_marked"] = already_marked is not None
                s["od_status"] = od_req["status"] if od_req else None
                s["allow_faculty_hotspot"] = s.get("allow_faculty_hotspot", False)
                
                if s["allow_faculty_hotspot"]:
                    session_faculty = await db["faculty"].find_one({"_id": ObjectId(s["faculty_id"])})
                    if session_faculty:
                        s["hotspot_ssid"] = session_faculty.get("hotspot_ssid")
                        s["hotspot_bssid"] = session_faculty.get("hotspot_bssid")
                        
                s["created_at"] = s["created_at"].isoformat()
                s["updated_at"] = s["updated_at"].isoformat()
                if s.get("scheduled_start_time"):
                    s["scheduled_start_time"] = s["scheduled_start_time"].isoformat()
                if s.get("actual_start_time"):
                    s["actual_start_time"] = s["actual_start_time"].isoformat()
                if s.get("end_time"):
                    s["end_time"] = s["end_time"].isoformat()
                    
                filtered_sessions.append(s)
                
        return filtered_sessions
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Active sessions error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve active sessions"
        )


@router.get("/wifi-config", response_model=Dict[str, Any])
async def get_wifi_config(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Retrieve approved WiFi configs (Admin/Faculty only)"""
    try:
        if current_user.get("role") not in [RoleEnum.ADMIN, RoleEnum.FACULTY]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
            
        wifi_service = WiFiValidationService(db)
        bssids = await wifi_service.get_approved_bssids()
        
        return {
            "approved_bssids": bssids,
            "default_college_bssid": settings.college_bssid,
            "default_faculty_hotspot_bssid": settings.faculty_hotspot_bssid
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get wifi config error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve WiFi configs"
        )


@router.post("/wifi-config", response_model=Dict[str, Any])
async def add_wifi_bssid(
    payload: WiFiBSSIDPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Add new approved WiFi BSSID (Admin/Faculty only)"""
    try:
        if current_user.get("role") not in [RoleEnum.ADMIN, RoleEnum.FACULTY]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
            
        wifi_service = WiFiValidationService(db)
        success = await wifi_service.add_approved_bssid(payload.bssid, payload.bssid_type)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to add WiFi BSSID"
            )
            
        return {"message": "WiFi BSSID approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add wifi error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update WiFi list"
        )


@router.get("/geofence-config", response_model=Dict[str, Any])
async def get_geofence_config():
    """Retrieve default geofencing configurations"""
    return {
        "latitude": settings.college_latitude,
        "longitude": settings.college_longitude,
        "radius_meters": settings.geofence_radius_meters
    }
