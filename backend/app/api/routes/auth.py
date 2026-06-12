from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from fastapi.security.http import HTTPAuthorizationCredentials as HTTPAuthCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
import logging
from app.core.database import get_database
from app.core.security import verify_token
from app.services.auth.auth_service import AuthService
from app.schemas.schemas import UserCreate, User, RoleEnum

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthCredentials = Depends(security),
    db: AsyncDatabase = Depends(get_database)
) -> Dict[str, Any]:
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    payload = verify_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims"
        )
    
    auth_service = AuthService(db)
    user = await auth_service.get_user(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user


@router.post("/register", response_model=Dict[str, Any])
async def register(
    user: UserCreate,
    db: AsyncDatabase = Depends(get_database)
):
    """Register a new user"""
    try:
        auth_service = AuthService(db)
        
        # Register user
        user_id = await auth_service.register_user(
            email=user.email,
            password=user.password,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            hotspot_ssid=user.hotspot_ssid,
            hotspot_bssid=user.hotspot_bssid
        )
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        return {
            "message": "User registered successfully",
            "user_id": user_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login", response_model=Dict[str, Any])
async def login(
    payload: LoginRequest,
    db: AsyncDatabase = Depends(get_database)
):
    """Login user"""
    try:
        auth_service = AuthService(db)
        
        # Authenticate user
        user = await auth_service.authenticate_user(payload.email, payload.password)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Create tokens
        tokens = auth_service.create_tokens(user["id"], user["email"])
        
        return {
            "user": user,
            "tokens": tokens
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@router.get("/me", response_model=Dict[str, Any])
async def get_current_user_info(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get current user information"""
    return current_user


@router.get("/profile", response_model=Dict[str, Any])
async def get_profile(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get profile information for current user"""
    first_name = current_user.get("first_name", "")
    last_name = current_user.get("last_name", "")
    display_name = f"{first_name} {last_name}".strip()
    
    return {
        "displayName": display_name,
        "email": current_user.get("email"),
        "role": current_user.get("role"),
        "phoneNumber": current_user.get("phone_number"),
        "phone_number": current_user.get("phone_number"),
        "photoUrl": current_user.get("profile_picture"),
        "profile_picture": current_user.get("profile_picture"),
        "created_at": current_user.get("created_at").isoformat() if isinstance(current_user.get("created_at"), datetime) else current_user.get("created_at"),
    }


class ProfileUpdateRequest(BaseModel):
    displayName: Optional[str] = None
    photoUrl: Optional[str] = None


@router.put("/profile", response_model=Dict[str, Any])
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Update current user profile"""
    try:
        update_data = {}
        if body.displayName is not None:
            parts = body.displayName.strip().split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""
            update_data["first_name"] = first_name
            update_data["last_name"] = last_name
            
        if body.photoUrl is not None:
            update_data["profile_picture"] = body.photoUrl
            
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            await db["users"].update_one(
                {"_id": ObjectId(current_user["id"])},
                {"$set": update_data}
            )
            
        # Get updated user details
        auth_service = AuthService(db)
        updated_user = await auth_service.get_user(current_user["id"])
        
        first_name = updated_user.get("first_name", "")
        last_name = updated_user.get("last_name", "")
        display_name = f"{first_name} {last_name}".strip()
        
        return {
            "message": "Profile updated successfully",
            "user": {
                "displayName": display_name,
                "email": updated_user.get("email"),
                "role": updated_user.get("role"),
                "phoneNumber": updated_user.get("phone_number"),
                "phone_number": updated_user.get("phone_number"),
                "photoUrl": updated_user.get("profile_picture"),
                "profile_picture": updated_user.get("profile_picture"),
            }
        }
    except Exception as e:
        logger.error(f"Profile update error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@router.post("/change-password", response_model=Dict[str, Any])
async def change_password(
    body: ChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncDatabase = Depends(get_database)
):
    """Change user password"""
    try:
        auth_service = AuthService(db)
        
        success = await auth_service.update_password(
            current_user["id"],
            body.old_password,
            body.new_password
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid old password"
            )
        
        return {"message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password change error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )
