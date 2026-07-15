from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta, timezone
import jwt
import bcrypt

from config import settings, firebase_auth, firebase_db
from middleware.auth import get_current_user

router = APIRouter()

# Demo in-memory user storage (for testing without Firebase)
demo_users: dict = {}


def _parse_expire(expire_str: str) -> int:
    """Convert JWT_EXPIRE like '7d' or '3600' to seconds."""
    if expire_str.endswith("d"):
        return int(expire_str[:-1]) * 86400
    if expire_str.endswith("h"):
        return int(expire_str[:-1]) * 3600
    return int(expire_str)


def generate_token(user: dict) -> str:
    expire_seconds = _parse_expire(settings.JWT_EXPIRE)
    payload = {
        "uid": user.get("uid") or user.get("id"),
        "email": user.get("email"),
        "role": user.get("role"),
        "name": user.get("name") or user.get("displayName"),
        "exp": datetime.now(timezone.utc) + timedelta(seconds=expire_seconds),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


# ── Schemas ──────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    displayName: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "student"
    rollNumber: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    displayName: Optional[str] = None
    photoUrl: Optional[str] = None
    faceDescriptor: Optional[list] = None
    trainingStats: Optional[dict] = None


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest):
    email = body.email
    password = body.password

    # Try Firebase first
    if firebase_auth and firebase_db:
        try:
            user_record = firebase_auth.get_user_by_email(email)
            token = generate_token({"uid": user_record.uid, "email": user_record.email})
            user_doc = firebase_db.collection("users").document(user_record.uid).get()
            user_data = user_doc.to_dict() or {}
            return {
                "token": token,
                "user": {
                    "uid": user_record.uid,
                    "email": user_record.email,
                    "displayName": user_data.get("displayName") or user_record.display_name,
                    "role": user_data.get("role"),
                    "photoUrl": user_data.get("photoUrl"),
                },
            }
        except Exception:
            pass  # Fall through to demo mode

    # Demo mode
    user = demo_users.get(email)
    if not user or not bcrypt.checkpw(password.encode(), user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = generate_token(user)
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("displayName"),
            "role": user["role"],
            "photoUrl": user.get("photoUrl"),
        },
    }


@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    email = body.email
    password = body.password
    display_name = body.displayName or f"{body.first_name or ''} {body.last_name or ''}".strip()
    if not display_name:
        raise HTTPException(status_code=422, detail="displayName or first_name and last_name are required")
    role = body.role
    roll_number = body.rollNumber

    # Try Firebase first
    if firebase_auth and firebase_db:
        try:
            user_record = firebase_auth.create_user(
                email=email, password=password, display_name=display_name
            )
            firebase_db.collection("users").document(user_record.uid).set({
                "uid": user_record.uid,
                "email": email,
                "displayName": display_name,
                "role": role,
                "rollNumber": roll_number,
                "photoUrl": None,
                "createdAt": datetime.utcnow(),
            })
            token = generate_token({"uid": user_record.uid, "email": email, "role": role})
            return {
                "token": token,
                "user": {"uid": user_record.uid, "email": email, "displayName": display_name, "role": role},
            }
        except Exception as e:
            if "EMAIL_EXISTS" in str(e) or "email-already-exists" in str(e):
                raise HTTPException(status_code=400, detail="Email already registered")
            # Fall through to demo mode

    # Demo mode
    if email in demo_users:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12))
    user = {
        "id": f"user_{int(datetime.utcnow().timestamp() * 1000)}",
        "email": email,
        "password": hashed,
        "displayName": display_name,
        "role": role,
        "rollNumber": roll_number,
        "photoUrl": None,
        "createdAt": datetime.utcnow(),
    }
    demo_users[email] = user
    token = generate_token(user)
    return {
        "token": token,
        "user": {"id": user["id"], "email": email, "displayName": display_name, "role": role},
    }


@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("uid") or current_user.get("id")

    if firebase_db:
        try:
            user_doc = firebase_db.collection("users").document(user_id).get()
            if not user_doc.exists:
                raise HTTPException(status_code=404, detail="User not found")
            return user_doc.to_dict()
        except HTTPException:
            raise
        except Exception:
            pass

    # Demo mode
    user = next((u for u in demo_users.values() if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    safe = {k: v for k, v in user.items() if k != "password"}
    return safe


@router.put("/profile")
async def update_profile(body: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("uid") or current_user.get("id")

    update_data = {}
    if body.displayName is not None:
        update_data["displayName"] = body.displayName
    if body.photoUrl is not None:
        update_data["photoUrl"] = body.photoUrl
    if body.faceDescriptor is not None:
        update_data["faceDescriptor"] = body.faceDescriptor
    if body.trainingStats is not None:
        update_data["trainingStats"] = body.trainingStats

    if firebase_db:
        try:
            firebase_db.collection("users").document(user_id).update(update_data)
            return {"message": "Profile updated", "data": update_data}
        except Exception:
            pass

    # Demo mode
    user = next((u for u in demo_users.values() if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.update(update_data)
    return {"message": "Profile updated", "data": update_data}
