from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os
from datetime import datetime
from app.core.database import connect_to_mongo, close_mongo_connection
from app.cache.redis_cache import cache
from app.core.config import settings
from app.api.routes import auth, students, faculty, users, advisors, departments, subjects, reports, notifications, attendance, timetable
from app.utils.logger import setup_logging

logger = logging.getLogger(__name__)


async def seed_database(db):
    """Seed database indexes and default documents"""
    try:
        logger.info("Initializing database indexes and default records...")
        
        # Collection indexes
        await db["users"].create_index("email", unique=True)
        
        # We catch exceptions for other indexes if fields are missing in older test databases
        try:
            await db["students"].create_index("enrollment_number", unique=True)
            await db["students"].create_index("user_id", unique=True)
        except Exception as e:
            logger.warning(f"Failed to create student indexes: {e}")
            
        try:
            await db["faculty"].create_index("faculty_id", unique=True)
            await db["faculty"].create_index("user_id", unique=True)
        except Exception as e:
            logger.warning(f"Failed to create faculty indexes: {e}")
            
        try:
            await db["attendance_records"].create_index([("session_id", 1), ("student_id", 1)], unique=True)
        except Exception as e:
            logger.warning(f"Failed to create attendance_records compound index: {e}")
            
        # Check if we have an admin user, if not create one
        admin_exists = await db["users"].find_one({"role": "admin"})
        if not admin_exists:
            logger.info("Seeding default admin user...")
            from app.core.security import hash_password
            admin_doc = {
                "email": "admin@college.edu",
                "password_hash": hash_password("admin123"),
                "first_name": "Department",
                "last_name": "Admin",
                "role": "admin",
                "phone_number": "1234567890",
                "profile_picture": None,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            await db["users"].insert_one(admin_doc)
            
        # Check and seed default wifi config
        wifi_exists = await db["system_config"].find_one({"_id": "wifi_config"})
        if not wifi_exists:
            logger.info("Seeding default wifi config...")
            await db["system_config"].insert_one({
                "_id": "wifi_config",
                "approved_bssids": [settings.college_bssid, settings.faculty_hotspot_bssid]
            })
            
        logger.info("Database seeding successfully completed")
    except Exception as e:
        logger.error(f"Database seeding failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager"""
    # Startup
    logger.info("Starting up application...")
    setup_logging()
    
    try:
        await connect_to_mongo()
        await cache.connect()
        logger.info("Database and cache connections established")
        
        # Seed database indices and defaults
        from app.core.database import get_database
        db = get_database()
        await seed_database(db)
        
    except Exception as e:
        logger.error(f"Failed to establish connections: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down application...")
    await close_mongo_connection()
    await cache.disconnect()
    logger.info("Connections closed")


def create_app() -> FastAPI:
    """Create FastAPI application"""
    
    app = FastAPI(
        title=settings.api_title,
        version=settings.api_version,
        description="Smart Attendance System API with AI Face Recognition",
        lifespan=lifespan
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_hosts,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include API routes (registered first so they take priority over catch-all)
    app.include_router(auth.router)
    app.include_router(students.router)
    app.include_router(faculty.router)
    app.include_router(users.router)
    app.include_router(advisors.router)
    app.include_router(departments.router)
    app.include_router(subjects.router)
    app.include_router(reports.router)
    app.include_router(notifications.router)
    app.include_router(attendance.router)
    app.include_router(timetable.router)
    
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {
            "status": "healthy",
            "version": settings.api_version
        }
    
    # Serve frontend static files from the same port
    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
    if os.path.isdir(frontend_dist):
        # Mount static assets (JS, CSS, images)
        assets_dir = os.path.join(frontend_dist, "assets")
        if os.path.isdir(assets_dir):
            app.mount("/assets", StaticFiles(directory=assets_dir), name="static-assets")
        
        # Catch-all route: serve index.html for any non-API route (SPA client-side routing)
        @app.get("/{full_path:path}")
        async def serve_frontend(request: Request, full_path: str):
            """Serve React frontend for all non-API routes"""
            # Try to serve the exact file first (e.g., favicon.ico, manifest.json)
            file_path = os.path.join(frontend_dist, full_path)
            if full_path and os.path.isfile(file_path):
                return FileResponse(file_path)
            # Otherwise serve index.html for SPA routing
            return FileResponse(os.path.join(frontend_dist, "index.html"))
    else:
        # No frontend build found — serve API root
        @app.get("/")
        async def root():
            """Root endpoint"""
            return {
                "message": "Welcome to Smart Attendance System API",
                "version": settings.api_version,
                "docs": "/docs",
                "note": "Frontend not built yet. Run 'npm run build' in the frontend directory."
            }
    
    return app


app = create_app()
