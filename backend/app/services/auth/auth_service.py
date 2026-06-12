import logging
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from bson import ObjectId
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.schemas.schemas import RoleEnum
from datetime import datetime

logger = logging.getLogger(__name__)


class AuthService:
    """Service for authentication operations"""

    def __init__(self, db: AsyncDatabase):
        self.db = db

    async def register_user(
        self,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        role: RoleEnum,
        hotspot_ssid: Optional[str] = None,
        hotspot_bssid: Optional[str] = None,
        assigned_subjects: Optional[list] = None
    ) -> Optional[str]:
        """Register a new user"""
        try:
            # Check if user already exists
            existing_user = await self.db["users"].find_one({"email": email})
            if existing_user:
                logger.warning(f"User already exists: {email}")
                return None
            
            # Hash password
            hashed_password = hash_password(password)
            
            # Create user document
            user_doc = {
                "email": email,
                "password_hash": hashed_password,
                "first_name": first_name,
                "last_name": last_name,
                "role": role,
                "phone_number": None,
                "profile_picture": None,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            if role == RoleEnum.ADVISOR:
                user_doc["assigned_batch"] = "2026"
                user_doc["assigned_department"] = "Computer Science"
                user_doc["assigned_section"] = "A"
            
            result = await self.db["users"].insert_one(user_doc)
            user_id = str(result.inserted_id)
            
            # Auto-create profile documents for students and faculty/advisors
            if role == RoleEnum.STUDENT:
                student_doc = {
                    "user_id": user_id,
                    "enrollment_number": f"ENR_{user_id[-6:]}",
                    "batch": "2026",
                    "department": "Computer Science",
                    "semester": 1,
                    "section": "A",
                    "cgpa": 0.0,
                    "total_attendance_percentage": 0.0,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                await self.db["students"].insert_one(student_doc)
                logger.info(f"Auto-created student profile for user: {user_id}")
            elif role in (RoleEnum.FACULTY, RoleEnum.ADVISOR):
                faculty_doc = {
                    "user_id": user_id,
                    "faculty_id": f"FAC_{user_id[-6:]}",
                    "department": "Computer Science",
                    "specialization": "General",
                    "phone_number": "0000000000",
                    "hotspot_ssid": hotspot_ssid,
                    "hotspot_bssid": hotspot_bssid,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                await self.db["faculty"].insert_one(faculty_doc)
                logger.info(f"Auto-created faculty profile for user: {user_id}")
                
                if role == RoleEnum.FACULTY and assigned_subjects:
                    # Update each subject to link to this faculty_id
                    # The subjects expect `faculty_id` to refer to the faculty user's user_id or faculty doc id.
                    # In our schema, subjects.faculty_id references the User ID (or faculty doc id).
                    # Wait, looking at CreateSession, faculty_id is often the user_id or faculty._id.
                    # Let's set it to user_id for simplicity, as it's the most common linking key in this app.
                    from bson import ObjectId
                    for sub_id in assigned_subjects:
                        try:
                            await self.db["subjects"].update_one(
                                {"_id": ObjectId(sub_id)},
                                {"$set": {"faculty_id": user_id, "updated_at": datetime.utcnow()}}
                            )
                        except Exception as ex:
                            logger.error(f"Failed to assign subject {sub_id} to faculty {user_id}: {ex}")
                
                
            logger.info(f"Registered new user: {email}")
            return user_id
        except Exception as e:
            logger.error(f"Failed to register user: {e}")
            raise

    async def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticate user with email and password"""
        try:
            user = await self.db["users"].find_one({"email": email})
            
            if not user:
                logger.warning(f"User not found: {email}")
                return None
            
            if not user.get("is_active"):
                logger.warning(f"User account inactive: {email}")
                return None
            
            if not verify_password(password, user.get("password_hash", "")):
                logger.warning(f"Invalid password for user: {email}")
                return None
            
            logger.info(f"User authenticated successfully: {email}")
            
            # Prepare user data
            user_data = {
                "id": str(user["_id"]),
                "email": user["email"],
                "first_name": user["first_name"],
                "last_name": user["last_name"],
                "role": user["role"],
                "is_active": user["is_active"]
            }
            
            if user.get("role") == RoleEnum.ADVISOR:
                user_data["assigned_batch"] = user.get("assigned_batch", "2026")
                user_data["assigned_department"] = user.get("assigned_department", "Computer Science")
                user_data["assigned_section"] = user.get("assigned_section", "A")
            else:
                if "assigned_batch" in user:
                    user_data["assigned_batch"] = user["assigned_batch"]
                if "assigned_department" in user:
                    user_data["assigned_department"] = user["assigned_department"]
                if "assigned_section" in user:
                    user_data["assigned_section"] = user["assigned_section"]
            
            return user_data
        except Exception as e:
            logger.error(f"Failed to authenticate user: {e}")
            raise

    async def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user details"""
        try:
            user = await self.db["users"].find_one({"_id": ObjectId(user_id)})
            if user:
                user["id"] = str(user["_id"])
                del user["password_hash"]
                if user.get("role") == RoleEnum.ADVISOR:
                    user.setdefault("assigned_batch", "2026")
                    user.setdefault("assigned_department", "Computer Science")
                    user.setdefault("assigned_section", "A")
            return user
        except Exception as e:
            logger.error(f"Failed to get user: {e}")
            raise

    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email"""
        try:
            user = await self.db["users"].find_one({"email": email})
            if user:
                user["id"] = str(user["_id"])
            return user
        except Exception as e:
            logger.error(f"Failed to get user by email: {e}")
            raise

    async def update_password(self, user_id: str, old_password: str, new_password: str) -> bool:
        """Update user password"""
        try:
            user = await self.db["users"].find_one({"_id": ObjectId(user_id)})
            
            if not user or not verify_password(old_password, user.get("password_hash", "")):
                logger.warning(f"Invalid old password for user: {user_id}")
                return False
            
            hashed_password = hash_password(new_password)
            
            result = await self.db["users"].update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$set": {
                        "password_hash": hashed_password,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            logger.info(f"Password updated for user: {user_id}")
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to update password: {e}")
            raise

    def create_tokens(self, user_id: str, email: str) -> Dict[str, str]:
        """Create access and refresh tokens"""
        try:
            access_token = create_access_token({"sub": user_id, "email": email})
            refresh_token = create_refresh_token({"sub": user_id, "email": email})
            
            logger.debug(f"Tokens created for user: {user_id}")
            
            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer"
            }
        except Exception as e:
            logger.error(f"Failed to create tokens: {e}")
            raise
