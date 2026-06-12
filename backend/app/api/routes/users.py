from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from typing import Dict, Any, List
from bson import ObjectId
from datetime import datetime
import logging
from app.core.database import get_database
from app.api.routes.auth import get_current_user
from app.schemas.schemas import RoleEnum, UserUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/users", tags=["Users"])


@router.get("/", response_model=List[Dict[str, Any]])
async def list_users(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """List all users (Admin only)"""
    try:
        if current_user.get("role") not in [RoleEnum.ADMIN, RoleEnum.ADVISOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators and advisors can list users"
            )
            
        users = await db["users"].find().to_list(None)
        formatted_users = []
        for u in users:
            u["id"] = str(u["_id"])
            if "password_hash" in u:
                del u["password_hash"]
            u["_id"] = str(u["_id"])
            formatted_users.append(u)
            
        return formatted_users
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"List users error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users"
        )


@router.get("/{user_id}", response_model=Dict[str, Any])
async def get_user_by_id(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Get user by ID"""
    try:
        # Check permissions: Admin, or the user themselves
        if current_user.get("role") != RoleEnum.ADMIN and current_user["id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
            
        user = await db["users"].find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
            
        user["id"] = str(user["_id"])
        if "password_hash" in user:
            del user["password_hash"]
        user["_id"] = str(user["_id"])
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user by ID error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user details"
        )


@router.put("/{user_id}", response_model=Dict[str, Any])
async def update_user(
    user_id: str,
    payload: UserUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Update user profile"""
    try:
        # Check permissions
        if current_user.get("role") != RoleEnum.ADMIN and current_user["id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
            
        user = await db["users"].find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
            
        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            await db["users"].update_one(
                {"_id": ObjectId(user_id)},
                {"$set": update_data}
            )
            
        updated_user = await db["users"].find_one({"_id": ObjectId(user_id)})
        updated_user["id"] = str(updated_user["_id"])
        if "password_hash" in updated_user:
            del updated_user["password_hash"]
        updated_user["_id"] = str(updated_user["_id"])
        
        return {
            "message": "Profile updated successfully",
            "user": updated_user
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update user error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )


@router.delete("/{user_id}", response_model=Dict[str, Any])
async def delete_user(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Delete a user (Admin only)"""
    try:
        if current_user.get("role") != RoleEnum.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can delete users"
            )
            
        # Check if user exists
        user = await db["users"].find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
            
        # Delete dependencies
        role = user.get("role")
        if role == RoleEnum.STUDENT:
            student = await db["students"].find_one({"user_id": user_id})
            if student:
                # Delete face embeddings
                await db["face_embeddings"].delete_many({"student_id": str(student["_id"])})
                # Delete attendance records
                await db["attendance_records"].delete_many({"student_id": str(student["_id"])})
                # Delete student profile
                await db["students"].delete_one({"_id": student["_id"]})
        elif role == RoleEnum.FACULTY:
            await db["faculty"].delete_one({"user_id": user_id})
            
        await db["users"].delete_one({"_id": ObjectId(user_id)})
        
        return {"message": "User and associated data deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete user error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )
