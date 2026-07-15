from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime
import io

from config import firebase_db
from middleware.auth import require_roles

router = APIRouter()


@router.get("/students")
async def get_students(current_user: dict = Depends(require_roles("faculty", "advisor", "hod"))):
    if firebase_db:
        try:
            docs = firebase_db.collection("users").where("role", "==", "student").stream()
            students = [{"uid": doc.id, **doc.to_dict()} for doc in docs]
            return {"total": len(students), "students": students}
        except Exception:
            pass
    return {"total": 0, "students": []}


@router.get("/attendance-report")
async def get_attendance_report(
    courseId: str,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    current_user: dict = Depends(require_roles("faculty", "advisor", "hod")),
):
    if not firebase_db:
        return {"courseId": courseId, "totalRecords": 0, "students": 0, "report": []}

    try:
        docs = firebase_db.collection("attendance").where("courseId", "==", courseId).stream()
        records = [doc.to_dict() for doc in docs]

        if startDate:
            records = [
                r for r in records
                if _to_datetime(r.get("timestamp")) >= datetime.fromisoformat(startDate)
            ]
        if endDate:
            records = [
                r for r in records
                if _to_datetime(r.get("timestamp")) <= datetime.fromisoformat(endDate)
            ]

        student_stats: dict = {}
        for r in records:
            email = r.get("userEmail", "unknown")
            if email not in student_stats:
                student_stats[email] = {"email": email, "userId": r.get("userId"), "present": 0, "absent": 0}
            if r.get("status") == "present":
                student_stats[email]["present"] += 1
            else:
                student_stats[email]["absent"] += 1

        report = []
        for stat in student_stats.values():
            total = stat["present"] + stat["absent"]
            report.append({
                **stat,
                "total": total,
                "percentage": round((stat["present"] / total) * 100, 2) if total > 0 else 0,
            })

        return {
            "courseId": courseId,
            "period": {"startDate": startDate or "N/A", "endDate": endDate or "N/A"},
            "totalRecords": len(records),
            "students": len(report),
            "report": report,
        }
    except Exception:
        return {"courseId": courseId, "totalRecords": 0, "students": 0, "report": []}


@router.get("/system-stats")
async def get_system_stats(current_user: dict = Depends(require_roles("admin", "hod"))):
    if not firebase_db:
        return {"totalUsers": 0, "students": 0, "faculty": 0, "advisors": 0, "hods": 0, "totalAttendanceRecords": 0}

    try:
        users = [doc.to_dict() for doc in firebase_db.collection("users").stream()]
        attendance_records = [doc.to_dict() for doc in firebase_db.collection("attendance").stream()]

        count = len(attendance_records)
        avg_face = round(sum(r.get("faceDistance", 0) for r in attendance_records) / count, 3) if count > 0 else 0
        avg_conf = round(sum(r.get("confidence", 0) for r in attendance_records) / count, 1) if count > 0 else 0

        return {
            "totalUsers": len(users),
            "students": sum(1 for u in users if u.get("role") == "student"),
            "faculty": sum(1 for u in users if u.get("role") == "faculty"),
            "advisors": sum(1 for u in users if u.get("role") == "advisor"),
            "hods": sum(1 for u in users if u.get("role") == "hod"),
            "totalAttendanceRecords": count,
            "averageFaceDistance": avg_face,
            "averageConfidence": avg_conf,
        }
    except Exception:
        return {"totalUsers": 0, "students": 0, "faculty": 0, "advisors": 0, "hods": 0, "totalAttendanceRecords": 0}


@router.get("/attendance-report/export")
async def export_attendance_report(
    courseId: str,
    format: str = "json",
    current_user: dict = Depends(require_roles("faculty", "advisor", "hod")),
):
    if not firebase_db:
        return []

    docs = firebase_db.collection("attendance").where("courseId", "==", courseId).stream()
    records = [doc.to_dict() for doc in docs]

    if format == "csv":
        csv_lines = ["Email,Course,Date,Time,Status,Face Distance,Confidence"]
        for r in records:
            dt = _to_datetime(r.get("timestamp"))
            csv_lines.append(
                f"{r.get('userEmail','')},{r.get('courseId','')},{dt.strftime('%Y-%m-%d')},{dt.strftime('%H:%M:%S')},{r.get('status','')},{r.get('faceDistance','N/A')},{r.get('confidence','N/A')}"
            )
        content = "\n".join(csv_lines)
        return StreamingResponse(
            io.StringIO(content),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="attendance-{courseId}.csv"'},
        )

    return records


def _to_datetime(value) -> datetime:
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except Exception:
        return datetime.utcnow()
