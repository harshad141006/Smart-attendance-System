from fastapi import APIRouter, Depends
from datetime import datetime
from typing import Optional

from config import firebase_db
from middleware.auth import get_current_user

router = APIRouter()

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


@router.get("/today")
async def get_today_timetable(current_user: dict = Depends(get_current_user)):
    today = DAYS[datetime.now().weekday()]
    user_id = current_user.get("uid") or current_user.get("id")

    if firebase_db:
        try:
            docs = (
                firebase_db.collection("timetable")
                .where("userId", "==", user_id)
                .where("day_of_week", "==", today)
                .stream()
            )
            records = [{"id": doc.id, **doc.to_dict()} for doc in docs]
            if records:
                return records[0]
        except Exception:
            pass

    # Return empty timetable — no classes today
    return {"day_of_week": today, "periods": []}


@router.get("/student")
async def get_student_timetable(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("uid") or current_user.get("id")

    if firebase_db:
        try:
            docs = firebase_db.collection("timetable").where("userId", "==", user_id).stream()
            return [{"id": doc.id, **doc.to_dict()} for doc in docs]
        except Exception:
            pass
    return []


@router.get("/faculty")
async def get_faculty_timetable(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("uid") or current_user.get("id")

    if firebase_db:
        try:
            docs = firebase_db.collection("timetable").where("facultyId", "==", user_id).stream()
            return [{"id": doc.id, **doc.to_dict()} for doc in docs]
        except Exception:
            pass
    return []


@router.get("/search")
async def search_timetable(
    batch: Optional[str] = None,
    department: Optional[str] = None,
    section: Optional[str] = None,
    day_of_week: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    if firebase_db:
        try:
            query = firebase_db.collection("timetable")
            if batch:
                query = query.where("batch", "==", batch)
            if department:
                query = query.where("department", "==", department)
            if section:
                query = query.where("section", "==", section)
            if day_of_week:
                query = query.where("day_of_week", "==", day_of_week)
            docs = query.stream()
            return [{"id": doc.id, **doc.to_dict()} for doc in docs]
        except Exception:
            pass
    return []


@router.post("/", status_code=201)
async def save_timetable(data: dict, current_user: dict = Depends(get_current_user)):
    if firebase_db:
        try:
            ref = firebase_db.collection("timetable").add(data)
            return {"id": ref[1].id, **data}
        except Exception:
            pass
    return {"message": "Timetable saved (demo)", **data}
