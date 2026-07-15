from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta

from config import firebase_db
from middleware.auth import get_current_user

router = APIRouter()

# Demo in-memory notifications
_demo_notifications = [
    {
        "id": "notif_1",
        "userId": "default_student",
        "title": "Face Registration Required",
        "message": "Please register your face profile in the settings to enable auto-attendance.",
        "created_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
        "read": False,
    },
    {
        "id": "notif_2",
        "userId": "default_student",
        "title": "Attendance Alert",
        "message": "Your attendance in Web Development is currently 71.4%, which is below the 75% threshold.",
        "created_at": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat(),
        "read": False,
    },
    {
        "id": "notif_3",
        "userId": "default_student",
        "title": "System Profile Verified",
        "message": "Your student profile details have been successfully verified by the administrator.",
        "created_at": (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat(),
        "read": True,
    },
]


@router.get("")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("uid") or current_user.get("id")

    if firebase_db:
        try:
            docs = (
                firebase_db.collection("notifications")
                .where("userId", "==", user_id)
                .order_by("created_at", direction="DESCENDING")
                .stream()
            )
            records = [{"id": doc.id, **doc.to_dict()} for doc in docs]
            if records:
                return records
        except Exception:
            pass

    # Demo mode / fallback
    return [{**n, "userId": user_id} for n in _demo_notifications]


@router.post("/{notif_id}/read")
async def mark_as_read(notif_id: str, current_user: dict = Depends(get_current_user)):
    if firebase_db:
        try:
            ref = firebase_db.collection("notifications").document(notif_id)
            doc = ref.get()
            if not doc.exists:
                raise HTTPException(status_code=404, detail="Notification not found")
            ref.update({"read": True})
            return {"message": "Notification marked as read"}
        except HTTPException:
            raise
        except Exception:
            pass

    # Demo mode
    notif = next((n for n in _demo_notifications if n["id"] == notif_id), None)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif["read"] = True
    return {"message": "Notification marked as read (demo)"}
