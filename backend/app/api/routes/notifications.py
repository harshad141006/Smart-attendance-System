from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from typing import Dict, Any, List
from bson import ObjectId
from datetime import datetime
import logging
from app.core.database import get_database
from app.api.routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


@router.get("", response_model=List[Dict[str, Any]])
async def get_my_notifications(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Retrieve notifications for current authenticated user"""
    try:
        notifications = await db["notifications"].find(
            {"user_id": current_user["id"]}
        ).sort("created_at", -1).to_list(None)
        
        for n in notifications:
            n["id"] = str(n["_id"])
            n["_id"] = str(n["_id"])
            n["created_at"] = n["created_at"].isoformat()
            if n.get("read_at"):
                n["read_at"] = n["read_at"].isoformat()
                
        return notifications
    except Exception as e:
        logger.error(f"Get notifications error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve notifications"
        )


@router.post("/{notification_id}/read", response_model=Dict[str, Any])
async def mark_notification_read(
    notification_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Mark specific notification as read"""
    try:
        notif = await db["notifications"].find_one({"_id": ObjectId(notification_id)})
        if not notif:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
            
        if notif["user_id"] != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
            
        await db["notifications"].update_one(
            {"_id": ObjectId(notification_id)},
            {
                "$set": {
                    "read": True,
                    "read_at": datetime.utcnow()
                }
            }
        )
        
        return {"message": "Notification marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Mark notification read error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update notification"
        )
