from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from typing import Dict, Any, List, Optional
from bson import ObjectId
import logging
from app.core.database import get_database
from app.api.routes.auth import get_current_user
from app.schemas.schemas import RoleEnum
from app.services.attendance.attendance_service import AttendanceService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


@router.get("/semester", response_model=Dict[str, Any])
async def get_semester_report(
    department: str,
    semester: int,
    batch: str,
    subject_id: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Retrieve semester report for students in a batch"""
    try:
        # Check permissions: Admin, Faculty, or Advisor
        if current_user.get("role") not in [RoleEnum.ADMIN, RoleEnum.FACULTY, RoleEnum.ADVISOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
            
        students = await db["students"].find({
            "department": department,
            "semester": semester,
            "batch": batch
        }).to_list(None)
        
        report_entries = []
        attendance_service = AttendanceService(db)
        
        for student in students:
            user = await db["users"].find_one({"_id": ObjectId(student["user_id"])})
            pct = await attendance_service.calculate_attendance_percentage(
                student_id=str(student["_id"]),
                subject_id=subject_id
            )
            
            # Count present, absent, od
            records_query = {"student_id": str(student["_id"])}
            if subject_id:
                sessions = await db["attendance_sessions"].find({"subject_id": subject_id}).to_list(None)
                session_ids = [str(s["_id"]) for s in sessions]
                records_query["session_id"] = {"$in": session_ids}
                
            records = await db["attendance_records"].find(records_query).to_list(None)
            
            present = len([r for r in records if r["status"] == "present"])
            absent = len([r for r in records if r["status"] == "absent"])
            od = len([r for r in records if r["status"] == "od"])
            
            report_entries.append({
                "student_id": str(student["_id"]),
                "first_name": user["first_name"] if user else "Unknown",
                "last_name": user["last_name"] if user else "Unknown",
                "enrollment_number": student["enrollment_number"],
                "present_count": present,
                "absent_count": absent,
                "od_count": od,
                "attendance_percentage": pct
            })
            
        return {
            "department": department,
            "semester": semester,
            "batch": batch,
            "subject_id": subject_id,
            "students": report_entries
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Semester report error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate semester report"
        )


@router.get("/audit-logs", response_model=List[Dict[str, Any]])
async def get_audit_logs(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Retrieve system audit logs (Admin only)"""
    try:
        if current_user.get("role") != RoleEnum.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can access audit logs"
            )
            
        logs = await db["audit_logs"].find().sort("created_at", -1).limit(100).to_list(None)
        for l in logs:
            l["_id"] = str(l["_id"])
            if "created_at" in l:
                l["created_at"] = l["created_at"].isoformat()
        return logs
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get audit logs error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve audit logs"
        )
