from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from typing import Dict, Any, List
from bson import ObjectId
from datetime import datetime
import logging
from app.core.database import get_database
from app.api.routes.auth import get_current_user
from app.schemas.schemas import RoleEnum, DepartmentCreate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/departments", tags=["Departments"])


@router.post("/", response_model=Dict[str, Any])
async def create_department(
    payload: DepartmentCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Create a new department (Admin only)"""
    try:
        if current_user.get("role") != RoleEnum.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can create departments"
            )
            
        # Check if department code already exists
        existing = await db["departments"].find_one({"code": payload.code})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Department code already exists"
            )
            
        dept_doc = payload.model_dump()
        dept_doc["created_at"] = datetime.utcnow()
        dept_doc["updated_at"] = datetime.utcnow()
        
        result = await db["departments"].insert_one(dept_doc)
        
        return {
            "message": "Department created successfully",
            "department_id": str(result.inserted_id)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create department error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create department"
        )


@router.get("/", response_model=List[Dict[str, Any]])
async def list_departments(
    db: AsyncDatabase = Depends(get_database)
):
    """List all departments"""
    try:
        depts = await db["departments"].find().to_list(None)
        for d in depts:
            d["id"] = str(d["_id"])
            d["_id"] = str(d["_id"])
        return depts
    except Exception as e:
        logger.error(f"List departments error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve departments"
        )


@router.get("/{dept_id}", response_model=Dict[str, Any])
async def get_department(
    dept_id: str,
    db: AsyncDatabase = Depends(get_database)
):
    """Get department details"""
    try:
        dept = await db["departments"].find_one({"_id": ObjectId(dept_id)})
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )
        dept["id"] = str(dept["_id"])
        dept["_id"] = str(dept["_id"])
        return dept
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get department error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve department"
        )


@router.put("/{dept_id}", response_model=Dict[str, Any])
async def update_department(
    dept_id: str,
    payload: DepartmentCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Update department (Admin only)"""
    try:
        if current_user.get("role") != RoleEnum.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can update departments"
            )
            
        existing = await db["departments"].find_one({"_id": ObjectId(dept_id)})
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )
            
        update_doc = payload.model_dump()
        update_doc["updated_at"] = datetime.utcnow()
        
        await db["departments"].update_one(
            {"_id": ObjectId(dept_id)},
            {"$set": update_doc}
        )
        
        return {"message": "Department updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update department error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update department"
        )


@router.delete("/{dept_id}", response_model=Dict[str, Any])
async def delete_department(
    dept_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Delete department (Admin only)"""
    try:
        if current_user.get("role") != RoleEnum.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can delete departments"
            )
            
        existing = await db["departments"].find_one({"_id": ObjectId(dept_id)})
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )
            
        await db["departments"].delete_one({"_id": ObjectId(dept_id)})
        return {"message": "Department deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete department error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete department"
        )
