from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from typing import Dict, Any, List
from bson import ObjectId
from datetime import datetime
import logging
from app.core.database import get_database
from app.api.routes.auth import get_current_user
from app.schemas.schemas import RoleEnum, SubjectCreate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/subjects", tags=["Subjects"])


@router.post("/", response_model=Dict[str, Any])
async def create_subject(
    payload: SubjectCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Create a new subject (Admin only)"""
    try:
        if current_user.get("role") != RoleEnum.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can create subjects"
            )
            
        # Check if subject code already exists
        existing = await db["subjects"].find_one({"code": payload.code})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subject code already exists"
            )
            
        subject_doc = payload.model_dump()
        subject_doc["created_at"] = datetime.utcnow()
        subject_doc["updated_at"] = datetime.utcnow()
        
        result = await db["subjects"].insert_one(subject_doc)
        
        return {
            "message": "Subject created successfully",
            "subject_id": str(result.inserted_id)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create subject error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create subject"
        )


@router.get("/", response_model=List[Dict[str, Any]])
async def list_subjects(
    db: AsyncDatabase = Depends(get_database)
):
    """List all subjects"""
    try:
        subjects = await db["subjects"].find().to_list(None)
        for s in subjects:
            s["id"] = str(s["_id"])
            s["_id"] = str(s["_id"])
        return subjects
    except Exception as e:
        logger.error(f"List subjects error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subjects"
        )


@router.get("/faculty/{faculty_id}", response_model=List[Dict[str, Any]])
async def list_subjects_by_faculty(
    faculty_id: str,
    db: AsyncDatabase = Depends(get_database)
):
    """List subjects taught by a specific faculty"""
    try:
        subjects = await db["subjects"].find({"faculty_id": faculty_id}).to_list(None)
        for s in subjects:
            s["id"] = str(s["_id"])
            s["_id"] = str(s["_id"])
        return subjects
    except Exception as e:
        logger.error(f"List subjects by faculty error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve faculty subjects"
        )


@router.put("/{subject_id}", response_model=Dict[str, Any])
async def update_subject(
    subject_id: str,
    payload: SubjectCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Update subject (Admin only)"""
    try:
        if current_user.get("role") != RoleEnum.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can update subjects"
            )
            
        existing = await db["subjects"].find_one({"_id": ObjectId(subject_id)})
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found"
            )
            
        update_doc = payload.model_dump()
        update_doc["updated_at"] = datetime.utcnow()
        
        await db["subjects"].update_one(
            {"_id": ObjectId(subject_id)},
            {"$set": update_doc}
        )
        
        return {"message": "Subject updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update subject error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update subject"
        )


@router.delete("/{subject_id}", response_model=Dict[str, Any])
async def delete_subject(
    subject_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Delete subject (Admin only)"""
    try:
        if current_user.get("role") != RoleEnum.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can delete subjects"
            )
            
        existing = await db["subjects"].find_one({"_id": ObjectId(subject_id)})
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found"
            )
            
        await db["subjects"].delete_one({"_id": ObjectId(subject_id)})
        return {"message": "Subject deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete subject error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete subject"
        )
