from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application configuration settings"""

    # API Configuration
    debug: bool = True
    api_title: str = "Smart Attendance System API"
    api_version: str = "1.0.0"
    allowed_hosts: List[str] = ["http://localhost:3000", "http://localhost:5173", "http://localhost:8000"]

    # MongoDB Configuration
    mongodb_url: str = "mongodb+srv://username:password@cluster.mongodb.net/"
    mongodb_db_name: str = "smart_attendance_db"

    # Redis Configuration
    redis_url: str = "redis://localhost:6379/0"
    redis_cache_expiry: int = 3600  # 1 hour

    # JWT Configuration
    secret_key: str = "your-super-secret-key-change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # Face Recognition Configuration
    face_embedding_dimension: int = 512
    face_similarity_threshold: float = 0.35
    arcface_model_name: str = "buffalo_l"
    arcface_det_size: int = 640

    # Geofencing Configuration
    college_latitude: float = 28.7041
    college_longitude: float = 77.1025
    geofence_radius_meters: int = 500

    # WiFi Configuration
    college_bssid: str = "AA:BB:CC:DD:EE:FF"
    faculty_hotspot_bssid: str = "11:22:33:44:55:66"

    # Email Configuration
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    sender_email: str = "your-email@example.com"
    sender_password: str = "your-app-password"

    # Attendance Configuration
    min_attendance_percentage: float = 75.0
    max_od_requests_per_semester: int = 5
    attendance_mark_window_minutes: int = 5  # Minutes after session start to mark attendance

    class Config:
        import os
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
        case_sensitive = False


settings = Settings()
