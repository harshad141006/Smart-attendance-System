import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).parent / ".env.local")

class Settings:
    PORT: int = int(os.getenv("PORT", 8000))
    NODE_ENV: str = os.getenv("NODE_ENV", "development")

    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "")
    FIREBASE_PRIVATE_KEY: str = os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n")
    FIREBASE_CLIENT_EMAIL: str = os.getenv("FIREBASE_CLIENT_EMAIL", "")

    JWT_SECRET: str = os.getenv("JWT_SECRET") or "dev-secret-change-in-production"
    JWT_EXPIRE: str = os.getenv("JWT_EXPIRE", "7d")

    CORS_ORIGIN: str = os.getenv("CORS_ORIGIN", "http://localhost:3000")
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017/smart-attendance")

    PYTHON_VISION_URL: str = os.getenv("PYTHON_VISION_URL", "http://127.0.0.1:8000/analyze")


settings = Settings()

# Firebase Admin initialization
firebase_auth = None
firebase_db = None

try:
    import firebase_admin
    from firebase_admin import credentials, auth as _auth, firestore

    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": settings.FIREBASE_PROJECT_ID,
        "private_key": settings.FIREBASE_PRIVATE_KEY,
        "client_email": settings.FIREBASE_CLIENT_EMAIL,
        "token_uri": "https://oauth2.googleapis.com/token",
    })
    _app = firebase_admin.initialize_app(cred)
    firebase_auth = _auth
    firebase_db = firestore.client()
    print("[OK] Firebase Admin initialized")
except Exception as e:
    print(f"[WARN] Firebase initialization error: {e}")
    print("[INFO] Running in demo mode without Firebase")
    firebase_auth = None
    firebase_db = None
