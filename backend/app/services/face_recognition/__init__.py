"""Face recognition services powered by InsightFace ArcFace + SCRFD."""

from app.services.face_recognition.arcface_service import get_arcface_service

__all__ = ["get_arcface_service"]
