import math
import logging
import json
from datetime import datetime, timedelta
from typing import Tuple, Optional, List, Dict
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from bson import ObjectId
from app.cache.redis_cache import cache

logger = logging.getLogger(__name__)


def serialize_mongo_doc(doc: dict) -> dict:
    """Helper to serialize MongoDB doc with ObjectIds and datetimes to JSON-safe dict"""
    if not doc:
        return doc
    new_doc = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            new_doc[k] = str(v)
        elif isinstance(v, datetime):
            new_doc[k] = v.isoformat()
        elif isinstance(v, dict):
            new_doc[k] = serialize_mongo_doc(v)
        elif isinstance(v, list):
            new_doc[k] = [
                serialize_mongo_doc(item) if isinstance(item, dict) 
                else (str(item) if isinstance(item, ObjectId) else item) 
                for item in v
            ]
        else:
            new_doc[k] = v
    return new_doc


def deserialize_mongo_doc(doc: dict) -> dict:
    """Helper to deserialize JSON-safe dict back to MongoDB types"""
    if not doc:
        return doc
    new_doc = {}
    for k, v in doc.items():
        if k == "_id" or k.endswith("_id") or k == "id":
            if isinstance(v, str) and len(v) == 24:
                try:
                    new_doc[k] = ObjectId(v)
                    continue
                except:
                    pass
        if isinstance(v, str):
            try:
                new_doc[k] = datetime.fromisoformat(v)
            except ValueError:
                new_doc[k] = v
        elif isinstance(v, dict):
            new_doc[k] = deserialize_mongo_doc(v)
        elif isinstance(v, list):
            new_doc[k] = [
                deserialize_mongo_doc(item) if isinstance(item, dict) 
                else (ObjectId(item) if isinstance(item, str) and len(item) == 24 else item) 
                for item in v
            ]
        else:
            new_doc[k] = v
    return new_doc




class WiFiValidationService:
    """Service for WiFi validation"""

    def __init__(self, db: AsyncDatabase):
        self.db = db

    async def get_approved_bssids(self) -> List[str]:
        """Get list of approved WiFi BSSIDs (utilizing Redis cache)"""
        try:
            cached_bssids = await cache.get("wifi:approved_bssids")
            if cached_bssids is not None:
                logger.debug("WiFi approved BSSIDs retrieved from Redis cache")
                return cached_bssids
                
            config = await self.db["system_config"].find_one({"_id": "wifi_config"})
            bssids = config.get("approved_bssids", []) if config else []
            await cache.set("wifi:approved_bssids", bssids, expiry=3600)
            return bssids
        except Exception as e:
            logger.error(f"Failed to get approved BSSIDs: {e}")
            return []

    async def verify_wifi_bssid(self, bssid: str) -> Tuple[bool, str]:
        """
        Verify if WiFi BSSID is approved
        
        Returns:
            Tuple of (is_approved: bool, bssid_type: str)
        """
        try:
            approved_bssids = await self.get_approved_bssids()
            
            if bssid in approved_bssids:
                logger.debug(f"WiFi BSSID {bssid} verified")
                return True, "approved"
            
            logger.warning(f"WiFi BSSID {bssid} not approved")
            return False, "not_approved"
        except Exception as e:
            logger.error(f"Failed to verify WiFi BSSID: {e}")
            return False, "error"

    async def add_approved_bssid(self, bssid: str, bssid_type: str = "college") -> bool:
        """Add a new approved WiFi BSSID"""
        try:
            await self.db["system_config"].update_one(
                {"_id": "wifi_config"},
                {"$addToSet": {"approved_bssids": bssid}},
                upsert=True
            )
            # Invalidate BSSID cache
            await cache.delete("wifi:approved_bssids")
            logger.info(f"Added approved BSSID: {bssid}")
            return True
        except Exception as e:
            logger.error(f"Failed to add approved BSSID: {e}")
            return False


class AttendanceService:
    """Service for attendance operations"""

    def __init__(self, db: AsyncDatabase):
        self.db = db
        self.wifi_validation = WiFiValidationService(db)

    async def create_session(
        self,
        subject_id: str,
        faculty_id: str,
        session_title: str,
        duration_minutes: int,
        scheduled_start_time: datetime,
        allow_faculty_hotspot: bool = False
    ) -> str:
        """Create a new attendance session"""
        try:
            session_doc = {
                "subject_id": subject_id,
                "faculty_id": faculty_id,
                "session_title": session_title,
                "duration_minutes": duration_minutes,
                "scheduled_start_time": scheduled_start_time,
                "actual_start_time": None,
                "end_time": None,
                "allow_faculty_hotspot": allow_faculty_hotspot,
                "status": "scheduled",
                "total_students_enrolled": 0,
                "total_students_present": 0,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            result = await self.db["attendance_sessions"].insert_one(session_doc)
            session_id = str(result.inserted_id)
            
            # Cache session details
            session_doc["_id"] = session_id
            await cache.set(
                f"session:info:{session_id}", 
                serialize_mongo_doc(session_doc),
                expiry=3600
            )
            
            logger.info(f"Created attendance session: {session_id}")
            return session_id
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            raise

    async def start_session(self, session_id: str) -> bool:
        """Start an attendance session"""
        try:
            actual_start = datetime.utcnow()
            result = await self.db["attendance_sessions"].update_one(
                {"_id": ObjectId(session_id)},
                {
                    "$set": {
                        "status": "active",
                        "actual_start_time": actual_start,
                        "updated_at": actual_start
                    }
                }
            )
            
            if result.modified_count > 0:
                # Cache active flag
                await cache.set(f"session:active:{session_id}", True, expiry=3600)
                
                # Update info cache
                session = await self.db["attendance_sessions"].find_one({"_id": ObjectId(session_id)})
                if session:
                    await cache.set(
                        f"session:info:{session_id}", 
                        serialize_mongo_doc(session),
                        expiry=3600
                    )
                
                logger.info(f"Started session {session_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to start session: {e}")
            raise

    async def end_session(self, session_id: str) -> bool:
        """End an attendance session"""
        try:
            end_time = datetime.utcnow()
            result = await self.db["attendance_sessions"].update_one(
                {"_id": ObjectId(session_id)},
                {
                    "$set": {
                        "status": "ended",
                        "end_time": end_time,
                        "updated_at": end_time
                    }
                }
            )
            
            if result.modified_count > 0:
                # Delete active flag
                await cache.delete(f"session:active:{session_id}")
                
                # Update info cache
                session = await self.db["attendance_sessions"].find_one({"_id": ObjectId(session_id)})
                if session:
                    await cache.set(
                        f"session:info:{session_id}", 
                        serialize_mongo_doc(session),
                        expiry=3600
                    )
                    
                logger.info(f"Ended session {session_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to end session: {e}")
            raise

    async def get_session(self, session_id: str) -> Optional[dict]:
        """Get session details (utilizing Redis cache)"""
        try:
            cached_session = await cache.get(f"session:info:{session_id}")
            if cached_session is not None:
                logger.debug(f"Session info {session_id} retrieved from Redis cache")
                return deserialize_mongo_doc(cached_session)
                
            session = await self.db["attendance_sessions"].find_one({"_id": ObjectId(session_id)})
            if session:
                await cache.set(
                    f"session:info:{session_id}", 
                    serialize_mongo_doc(session),
                    expiry=3600
                )
            return session
        except Exception as e:
            logger.error(f"Failed to get session: {e}")
            raise

    async def get_active_sessions(self, subject_id: str = None) -> List[dict]:
        """Get active attendance sessions"""
        try:
            # Query MongoDB directly for query accuracy, or filter active sessions
            query = {"status": "active"}
            if subject_id:
                query["subject_id"] = subject_id
            
            sessions = await self.db["attendance_sessions"].find(query).to_list(None)
            return sessions
        except Exception as e:
            logger.error(f"Failed to get active sessions: {e}")
            raise

    async def mark_attendance(
        self,
        session_id: str,
        student_id: str,
        wifi_bssid: str,
        face_confidence: float,
        wifi_rssi: Optional[int] = None,
        status: str = "present",
        hotspot_only: bool = False
    ) -> Tuple[bool, str]:
        """
        Mark attendance with validation
        
        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            # Get session details
            session = await self.get_session(session_id)
            if not session:
                return False, "Session not found"
            
            if session["status"] != "active":
                return False, "Session is not active"
            
            # Check if already marked
            existing = await self.db["attendance_records"].find_one({
                "session_id": session_id,
                "student_id": student_id
            })
            
            if existing:
                return False, "Attendance already marked for this session"
            
            
            # Signal strength validation (if provided natively)
            if wifi_rssi is not None and wifi_rssi < -80:
                return False, f"WiFi Signal too weak ({wifi_rssi} dBm). Please move closer to the classroom router."

            # If using hotspot_only, session must allow it
            if hotspot_only and not session.get("allow_faculty_hotspot"):
                return False, "Hotspot attendance marking is not enabled for this session."

            # Check WiFi connection
            if session.get("allow_faculty_hotspot") and hotspot_only:
                faculty = await self.db["faculty"].find_one({"_id": ObjectId(session["faculty_id"])})
                if not faculty or not faculty.get("hotspot_bssid"):
                    return False, "Teacher has not configured their hotspot BSSID."
                    
                if faculty["hotspot_bssid"] != wifi_bssid:
                    return False, f"Connected to unauthorized network. Please connect to the teacher's hotspot: {faculty.get('hotspot_ssid', 'Unknown')}"
            else:
                is_approved, _ = await self.wifi_validation.verify_wifi_bssid(wifi_bssid)
                if not is_approved:
                    # Optional fallback: If session allows hotspot and they accidentally used normal marking while on hotspot
                    if session.get("allow_faculty_hotspot"):
                        faculty = await self.db["faculty"].find_one({"_id": ObjectId(session["faculty_id"])})
                        if faculty and faculty.get("hotspot_bssid") == wifi_bssid:
                            pass # Allowed
                        else:
                            return False, "Connected to unauthorized WiFi. Please connect to College WiFi or Teacher Hotspot."
                    else:
                        return False, "Connected to unauthorized WiFi. Please connect to College WiFi."
            
            # Check if within marking window
            if session["actual_start_time"]:
                elapsed = (datetime.utcnow() - session["actual_start_time"]).total_seconds() / 60
                if elapsed > session["duration_minutes"]:
                    return False, "Marking window has closed"
            
            # Record attendance
            attendance_doc = {
                "session_id": session_id,
                "student_id": student_id,
                "marking_time": datetime.utcnow(),
                "status": status,
                "wifi_bssid": wifi_bssid,
                "wifi_rssi": wifi_rssi,
                "face_confidence": face_confidence,
                "verified": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            result = await self.db["attendance_records"].insert_one(attendance_doc)
            
            # Update session count
            await self.db["attendance_sessions"].update_one(
                {"_id": ObjectId(session_id)},
                {"$inc": {"total_students_present": 1}}
            )
            
            # Invalidate session cache to reflect present count
            await cache.delete(f"session:info:{session_id}")
            
            logger.info(f"Marked attendance for student {student_id} in session {session_id}")
            return True, "Attendance marked successfully"
            
        except Exception as e:
            logger.error(f"Failed to mark attendance: {e}")
            return False, f"Error: {str(e)}"

    async def get_student_attendance_history(self, student_id: str) -> List[dict]:
        """Get attendance history for a student"""
        try:
            records = await self.db["attendance_records"].find(
                {"student_id": student_id}
            ).sort("marking_time", -1).to_list(None)
            return records
        except Exception as e:
            logger.error(f"Failed to get attendance history: {e}")
            raise

    async def calculate_attendance_percentage(self, student_id: str, subject_id: str = None) -> float:
        """Calculate attendance percentage for a student"""
        try:
            # Get all sessions
            session_query = {} if not subject_id else {"subject_id": subject_id}
            total_sessions = await self.db["attendance_sessions"].count_documents(session_query)
            
            if total_sessions == 0:
                return 0.0
            
            # Count present attendance
            attendance_query = {"student_id": student_id, "status": "present"}
            if subject_id:
                session_ids = await self.db["attendance_sessions"].find(
                    {"subject_id": subject_id},
                    {"_id": 1}
                ).to_list(None)
                session_ids = [str(s["_id"]) for s in session_ids]
                attendance_query["session_id"] = {"$in": session_ids}
            
            present_count = await self.db["attendance_records"].count_documents(attendance_query)
            
            percentage = (present_count / total_sessions) * 100
            logger.debug(f"Student {student_id} attendance: {percentage:.2f}%")
            
            return percentage
        except Exception as e:
            logger.error(f"Failed to calculate attendance percentage: {e}")
            return 0.0

