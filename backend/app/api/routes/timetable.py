from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from typing import Dict, Any, List
from bson import ObjectId
from datetime import datetime
import logging
from app.core.database import get_database
from app.api.routes.auth import get_current_user
from app.schemas.schemas import RoleEnum
from app.schemas.timetable_schemas import TimetableCreate, TimetableResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/timetable", tags=["Timetable"])

@router.post("/", response_model=Dict[str, Any])
async def create_or_update_timetable(
    payload: TimetableCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Create or update a timetable for a specific batch/dept/section and day (Advisor only)"""
    try:
        if current_user.get("role") not in [RoleEnum.ADMIN, RoleEnum.ADVISOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin or advisor can manage timetables"
            )

        query = {
            "batch": payload.batch,
            "department": payload.department,
            "section": payload.section,
            "day_of_week": payload.day_of_week
        }
        
        # Prepare periods with generated IDs
        periods = []
        for p in payload.periods:
            period_dict = p.model_dump()
            period_dict["id"] = str(ObjectId())
            periods.append(period_dict)
            
        update_doc = {
            "batch": payload.batch,
            "department": payload.department,
            "section": payload.section,
            "day_of_week": payload.day_of_week,
            "periods": periods,
            "updated_at": datetime.utcnow()
        }

        existing = await db["timetables"].find_one(query)
        if existing:
            await db["timetables"].update_one(
                {"_id": existing["_id"]},
                {"$set": update_doc}
            )
            timetable_id = str(existing["_id"])
        else:
            update_doc["created_at"] = datetime.utcnow()
            result = await db["timetables"].insert_one(update_doc)
            timetable_id = str(result.inserted_id)

        return {
            "message": "Timetable saved successfully",
            "timetable_id": timetable_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Timetable creation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save timetable"
        )

@router.get("/student", response_model=List[Dict[str, Any]])
async def get_student_timetable(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Get timetable for the current student's batch"""
    try:
        if current_user.get("role") != RoleEnum.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only students can access this route"
            )
            
        # Get student profile
        student = await db["students"].find_one({"user_id": str(current_user.get("id") or current_user.get("_id"))})
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found"
            )

        # Get timetable for their batch/dept/section
        query = {
            "batch": student.get("batch"),
            "department": student.get("department"),
            "section": student.get("section")
        }
        
        timetables = await db["timetables"].find(query).to_list(None)
        for t in timetables:
            t["id"] = str(t["_id"])
            t["_id"] = str(t["_id"])
        return timetables
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get student timetable error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve timetable"
        )

@router.get("/faculty", response_model=List[Dict[str, Any]])
async def get_faculty_timetable(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Get periods assigned to the current faculty across all timetables"""
    try:
        if current_user.get("role") != RoleEnum.FACULTY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only faculty can access this route"
            )
            
        # Get faculty profile
        faculty = await db["faculty"].find_one({"user_id": str(current_user.get("id") or current_user.get("_id"))})
        if not faculty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Faculty profile not found"
            )
            
        faculty_id = str(faculty["_id"])
        
        # We need to find timetables that have periods with this faculty_id
        query = {
            "periods.faculty_id": faculty_id
        }
        
        timetables = await db["timetables"].find(query).to_list(None)
        
        # Extract just the periods for this faculty, along with batch context
        assigned_periods = []
        for t in timetables:
            for p in t.get("periods", []):
                if p.get("faculty_id") == faculty_id:
                    # Look up subject name
                    subject_name = "Unknown Subject"
                    if p.get("subject_id"):
                        subject = await db["subjects"].find_one({"_id": ObjectId(p["subject_id"])})
                        if subject:
                            subject_name = subject.get("name")

                    assigned_periods.append({
                        "id": p.get("id"),
                        "title": p.get("title"),
                        "start_time": p.get("start_time"),
                        "end_time": p.get("end_time"),
                        "day_of_week": t.get("day_of_week"),
                        "batch": t.get("batch"),
                        "department": t.get("department"),
                        "section": t.get("section"),
                        "subject_id": p.get("subject_id"),
                        "subject_name": subject_name
                    })
                    
        return assigned_periods
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get faculty timetable error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve faculty timetable"
        )

@router.get("/search", response_model=Dict[str, Any])
async def get_timetable_by_params(
    batch: str,
    department: str,
    section: str,
    day_of_week: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Get timetable for a specific batch/dept/section/day"""
    try:
        query = {
            "batch": batch,
            "department": department,
            "section": section,
            "day_of_week": day_of_week
        }
        timetable = await db["timetables"].find_one(query)
        if not timetable:
            return {"periods": []}
            
        periods = timetable.get("periods", [])
        return {"periods": periods}
    except Exception as e:
        logger.error(f"Timetable search error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve timetable"
        )


@router.get("/today", response_model=Dict[str, Any])
async def get_today_timetable(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Get today's timetable for the current student's or advisor's batch"""
    try:
        from datetime import datetime
        day_of_week = datetime.now().strftime("%A")

        if current_user.get("role") == RoleEnum.STUDENT:
            student = await db["students"].find_one({"user_id": str(current_user.get("id") or current_user.get("_id"))})
            if not student:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
            batch = student.get("batch")
            department = student.get("department")
            section = student.get("section")
        elif current_user.get("role") == RoleEnum.ADVISOR:
            # Advisors have their assignments directly on their user document
            batch = current_user.get("assigned_batch")
            department = current_user.get("assigned_department")
            section = current_user.get("assigned_section")
            if not batch or not department:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Advisor does not have a batch assigned")
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only students and advisors can access this route"
            )

        query = {
            "batch": batch,
            "department": department,
            "section": section,
            "day_of_week": day_of_week
        }
        
        timetable = await db["timetables"].find_one(query)
        if not timetable:
            return {"day_of_week": day_of_week, "periods": []}
            
        periods = timetable.get("periods", [])
        return {"day_of_week": day_of_week, "periods": periods}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get today timetable error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve today's timetable"
        )
