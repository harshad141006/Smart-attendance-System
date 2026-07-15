from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import settings
from middleware.error_handler import add_error_handlers
from routers import auth, attendance, admin, notifications, vision, timetable


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up ArcFace model once at startup (loads buffalo_l weights into memory)
    try:
        from services.face_recognition.pipeline import _get_arcface
        import asyncio
        await asyncio.get_event_loop().run_in_executor(None, _get_arcface)
        print("[OK] ArcFace (buffalo_l) model loaded")
    except Exception as e:
        print(f"[WARN] ArcFace model failed to load: {e} - face registration will error at runtime")

    print(f"""
Smart Attendance System - Backend Server

Environment : {settings.NODE_ENV}
CORS Origin : {settings.CORS_ORIGIN}

API Endpoints:
   POST  /api/auth/login
   POST  /api/auth/register
   GET   /api/auth/profile
   PUT   /api/auth/profile
   POST  /api/attendance/face-register
   POST  /api/attendance/mark
   GET   /api/attendance/my-records
   GET   /api/attendance/stats
   GET   /api/attendance/course/{{courseId}}
   GET   /api/admin/students
   GET   /api/admin/attendance-report
   GET   /api/admin/attendance-report/export
   GET   /api/admin/system-stats
   GET   /api/notifications
   POST  /api/notifications/{{id}}/read
   POST  /api/vision/
   GET   /health

Backend ready.
    """)
    yield


app = FastAPI(title="Smart Attendance System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

add_error_handlers(app)

app.include_router(auth.router, prefix="/api/auth")
app.include_router(attendance.router, prefix="/api/attendance")
app.include_router(admin.router, prefix="/api/admin")
app.include_router(notifications.router, prefix="/api/notifications")
app.include_router(vision.router, prefix="/api/vision")
app.include_router(timetable.router, prefix="/api/timetable")


@app.get("/health")
def health_check():
    from datetime import datetime
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
