from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from typing import Dict, Any, List
from bson import ObjectId
from datetime import datetime
import logging
from pydantic import BaseModel
from app.core.database import get_database
from app.api.routes.auth import get_current_user
from app.schemas.schemas import RoleEnum, ODRequestUpdate
from app.services.attendance.attendance_service import AttendanceService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/advisors", tags=["Advisors"])


class WarningNotificationRequest(BaseModel):
    student_id: str
    message: str


async def get_advised_students_query(advisor: Dict[str, Any], db: AsyncDatabase) -> dict:
    """Helper to construct MongoDB query matching students advised by this advisor"""
    query = {}
    # Check if advisor has assignment fields
    dept = advisor.get("assigned_department")
    batch = advisor.get("assigned_batch")
    section = advisor.get("assigned_section")
    
    if dept:
        query["department"] = dept
    if batch:
        query["batch"] = batch
    if section:
        query["section"] = section
        
    return query


@router.get("/students", response_model=List[Dict[str, Any]])
async def view_students(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """View students advised by advisor"""
    try:
        if current_user.get("role") != RoleEnum.ADVISOR:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only advisors can view this data"
            )
            
        query = await get_advised_students_query(current_user, db)
        students = await db["students"].find(query).to_list(None)
        
        results = []
        attendance_service = AttendanceService(db)
        for student in students:
            user = await db["users"].find_one({"_id": ObjectId(student["user_id"])})
            pct = await attendance_service.calculate_attendance_percentage(str(student["_id"]))
            
            results.append({
                "student_id": str(student["_id"]),
                "first_name": user["first_name"] if user else "Unknown",
                "last_name": user["last_name"] if user else "Unknown",
                "email": user["email"] if user else "",
                "enrollment_number": student["enrollment_number"],
                "batch": student["batch"],
                "department": student["department"],
                "semester": student["semester"],
                "section": student["section"],
                "attendance_percentage": pct
            })
            
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Advisor view students error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve student roster"
        )


@router.get("/analytics", response_model=Dict[str, Any])
async def view_analytics(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Get batch attendance analytics"""
    try:
        if current_user.get("role") != RoleEnum.ADVISOR:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only advisors can view analytics"
            )
            
        query = await get_advised_students_query(current_user, db)
        students = await db["students"].find(query).to_list(None)
        
        if not students:
            return {
                "overall_attendance_average": 0.0,
                "total_students": 0,
                "shortage_count": 0
            }
            
        attendance_service = AttendanceService(db)
        total_pct = 0.0
        shortage_count = 0
        
        for student in students:
            pct = await attendance_service.calculate_attendance_percentage(str(student["_id"]))
            total_pct += pct
            if pct < 75.0:
                shortage_count += 1
                
        avg_attendance = total_pct / len(students)
        
        return {
            "overall_attendance_average": avg_attendance,
            "total_students": len(students),
            "shortage_count": shortage_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Advisor view analytics error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to compute analytics"
        )


@router.get("/shortage-reports", response_model=List[Dict[str, Any]])
async def get_shortage_reports(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Get students who have low attendance (< 75%)"""
    try:
        if current_user.get("role") != RoleEnum.ADVISOR:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only advisors can view shortage reports"
            )
            
        query = await get_advised_students_query(current_user, db)
        students = await db["students"].find(query).to_list(None)
        
        shortage_students = []
        attendance_service = AttendanceService(db)
        for student in students:
            pct = await attendance_service.calculate_attendance_percentage(str(student["_id"]))
            if pct < 75.0:
                user = await db["users"].find_one({"_id": ObjectId(student["user_id"])})
                shortage_students.append({
                    "student_id": str(student["_id"]),
                    "first_name": user["first_name"] if user else "Unknown",
                    "last_name": user["last_name"] if user else "Unknown",
                    "enrollment_number": student["enrollment_number"],
                    "department": student["department"],
                    "batch": student["batch"],
                    "section": student["section"],
                    "attendance_percentage": pct
                })
                
        return shortage_students
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Shortage reports error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate shortage reports"
        )


@router.get("/od-requests", response_model=List[Dict[str, Any]])
async def view_od_requests(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """View pending OD requests for advised students"""
    try:
        if current_user.get("role") != RoleEnum.ADVISOR:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only advisors can view OD requests"
            )
            
        query = await get_advised_students_query(current_user, db)
        students = await db["students"].find(query).to_list(None)
        student_ids = [str(s["_id"]) for s in students]
        
        requests = await db["od_requests"].find({
            "student_id": {"$in": student_ids},
            "status": "pending"
        }).to_list(None)
        
        formatted_requests = []
        for r in requests:
            r["_id"] = str(r["_id"])
            student_obj = await db["students"].find_one({"_id": ObjectId(r["student_id"])})
            user_obj = await db["users"].find_one({"_id": ObjectId(student_obj["user_id"])}) if student_obj else None
            session_obj = await db["attendance_sessions"].find_one({"_id": ObjectId(r["session_id"])})
            
            r["student_name"] = f"{user_obj['first_name']} {user_obj['last_name']}" if user_obj else "Unknown"
            r["enrollment_number"] = student_obj["enrollment_number"] if student_obj else ""
            r["session_title"] = session_obj["session_title"] if session_obj else "Unknown"
            formatted_requests.append(r)
            
        return formatted_requests
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Advisor view OD requests error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve OD requests"
        )


@router.post("/od-requests/{od_request_id}/approve", response_model=Dict[str, Any])
async def approve_od_request(
    od_request_id: str,
    payload: ODRequestUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Approve or reject OD request"""
    try:
        if current_user.get("role") != RoleEnum.ADVISOR:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only advisors can approve OD requests"
            )
            
        od_req = await db["od_requests"].find_one({"_id": ObjectId(od_request_id)})
        if not od_req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="OD request not found"
            )
            
        # Update OD request
        await db["od_requests"].update_one(
            {"_id": ObjectId(od_request_id)},
            {
                "$set": {
                    "status": payload.status,
                    "comment": payload.comment,
                    "approved_by": current_user["id"],
                    "approved_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # If approved, update student attendance record to "od"
        if payload.status == "approved":
            student_id = od_req["student_id"]
            session_id = od_req["session_id"]
            
            existing_record = await db["attendance_records"].find_one({
                "session_id": session_id,
                "student_id": student_id
            })
            
            if existing_record:
                await db["attendance_records"].update_one(
                    {"_id": existing_record["_id"]},
                    {
                        "$set": {
                            "status": "od",
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                # If they were present, present count remains but status is OD. Usually OD does not count as physical present, or counts.
                # Let's adjust counts if needed.
            else:
                await db["attendance_records"].insert_one({
                    "session_id": session_id,
                    "student_id": student_id,
                    "marking_time": datetime.utcnow(),
                    "status": "od",
                    "latitude": 0.0,
                    "longitude": 0.0,
                    "wifi_bssid": "od_approved",
                    "face_confidence": 1.0,
                    "verified": True,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                })
                
        # Send notification to student
        student_profile = await db["students"].find_one({"_id": ObjectId(od_req["student_id"])})
        if student_profile:
            notif = {
                "user_id": student_profile["user_id"],
                "title": f"OD Request {payload.status.capitalize()}",
                "message": f"Your OD request for session has been {payload.status}. Comment: {payload.comment or 'None'}",
                "notification_type": "od_approval",
                "data": {"od_request_id": od_request_id},
                "read": False,
                "created_at": datetime.utcnow()
            }
            await db["notifications"].insert_one(notif)
            
        return {"message": f"OD request {payload.status} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Approve OD error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update OD request status"
        )


@router.post("/send-warning", response_model=Dict[str, Any])
async def send_warning_notification(
    payload: WarningNotificationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Send attendance warning notification to a student"""
    try:
        if current_user.get("role") != RoleEnum.ADVISOR:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only advisors can send warning notifications"
            )
            
        student = await db["students"].find_one({"_id": ObjectId(payload.student_id)})
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
            
        notif = {
            "user_id": student["user_id"],
            "title": "Low Attendance Warning",
            "message": payload.message,
            "notification_type": "attendance_warning",
            "data": {"advisor_id": current_user["id"]},
            "read": False,
            "created_at": datetime.utcnow()
        }
        
        await db["notifications"].insert_one(notif)
        
        return {"message": "Warning notification sent successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send warning error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send warning notification"
        )
