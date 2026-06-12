from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class RoleEnum(str, Enum):
    STUDENT = "student"
    FACULTY = "faculty"
    ADVISOR = "advisor"
    ADMIN = "admin"


class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: RoleEnum


class UserCreate(UserBase):
    password: str
    hotspot_ssid: Optional[str] = None
    hotspot_bssid: Optional[str] = None
    assigned_subjects: Optional[List[str]] = []


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    profile_picture: Optional[str] = None


class User(UserBase):
    id: Optional[str] = Field(None, alias="_id")
    phone_number: Optional[str] = None
    profile_picture: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class StudentCreate(BaseModel):
    user_id: str
    enrollment_number: str
    batch: str  # e.g., "2024"
    department: str
    semester: int
    section: str
    cgpa: Optional[float] = None
    assigned_bssid: Optional[str] = None


class StudentUpdate(BaseModel):
    semester: Optional[int] = None
    cgpa: Optional[float] = None
    assigned_bssid: Optional[str] = None


class Student(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    enrollment_number: str
    batch: str
    department: str
    semester: int
    section: str
    cgpa: Optional[float] = None
    assigned_bssid: Optional[str] = None
    total_attendance_percentage: float = 0.0
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class FacultyCreate(BaseModel):
    user_id: str
    faculty_id: str
    department: str
    specialization: str
    phone_number: str
    hotspot_ssid: Optional[str] = None
    hotspot_bssid: Optional[str] = None


class Faculty(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    faculty_id: str
    department: str
    specialization: str
    phone_number: str
    hotspot_ssid: Optional[str] = None
    hotspot_bssid: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class DepartmentCreate(BaseModel):
    name: str
    code: str
    hod_id: str
    contact_email: str
    contact_phone: str


class Department(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    code: str
    hod_id: str
    contact_email: str
    contact_phone: str
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class SubjectCreate(BaseModel):
    code: str
    name: str
    description: str
    credits: int
    department_id: str
    faculty_id: str
    semester: int
    total_sessions: int = 0


class Subject(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    code: str
    name: str
    description: str
    credits: int
    department_id: str
    faculty_id: str
    semester: int
    total_sessions: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class AttendanceSessionCreate(BaseModel):
    subject_id: str
    faculty_id: str
    session_title: str
    duration_minutes: int
    scheduled_start_time: datetime
    allow_faculty_hotspot: bool = False


class AttendanceSessionUpdate(BaseModel):
    status: str  # "active", "ended"


class AttendanceSession(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    subject_id: str
    faculty_id: str
    session_title: str
    duration_minutes: int
    scheduled_start_time: datetime
    actual_start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    allow_faculty_hotspot: bool = False
    status: str = "scheduled"  # scheduled, active, ended
    total_students_enrolled: int = 0
    total_students_present: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class AttendanceRecordCreate(BaseModel):
    session_id: str
    student_id: str
    marking_time: datetime
    status: str  # "present", "absent", "od"
    wifi_bssid: str
    face_confidence: float


class AttendanceRecord(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    session_id: str
    student_id: str
    marking_time: datetime
    status: str
    wifi_bssid: str
    face_confidence: float
    verified: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class ODRequestCreate(BaseModel):
    student_id: str
    session_id: str
    reason: str
    supporting_document_url: Optional[str] = None


class ODRequestUpdate(BaseModel):
    status: str  # "pending", "approved", "rejected"
    comment: Optional[str] = None


class ODRequest(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    student_id: str
    session_id: str
    reason: str
    supporting_document_url: Optional[str] = None
    status: str = "pending"
    requested_at: datetime
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    comment: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class FaceEmbedding(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    student_id: str
    embedding: List[float]  # 512-dimensional vector
    image_metadata: Optional[Dict[str, Any]] = None  # No raw image stored
    confidence_score: float
    registered_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class Notification(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    title: str
    message: str
    notification_type: str  # "attendance_warning", "od_approval", "session_reminder"
    data: Optional[Dict[str, Any]] = None
    read: bool = False
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class AuditLog(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None
    ip_address: str
    user_agent: str
    hotspot_ssid: Optional[str] = None
    hotspot_bssid: Optional[str] = None


class Faculty(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    faculty_id: str
    department: str
    specialization: str
    phone_number: str
    hotspot_ssid: Optional[str] = None
    hotspot_bssid: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class DepartmentCreate(BaseModel):
    name: str
    code: str
    hod_id: str
    contact_email: str
    contact_phone: str


class Department(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    code: str
    hod_id: str
    contact_email: str
    contact_phone: str
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class SubjectCreate(BaseModel):
    code: str
    name: str
    description: str
    credits: int
    department_id: str
    faculty_id: str
    semester: int
    total_sessions: int = 0


class Subject(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    code: str
    name: str
    description: str
    credits: int
    department_id: str
    faculty_id: str
    semester: int
    total_sessions: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class AttendanceSessionCreate(BaseModel):
    subject_id: str
    faculty_id: str
    session_title: str
    duration_minutes: int
    scheduled_start_time: datetime
    allow_faculty_hotspot: bool = False


class AttendanceSessionUpdate(BaseModel):
    status: str  # "active", "ended"


class AttendanceSession(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    subject_id: str
    faculty_id: str
    session_title: str
    duration_minutes: int
    scheduled_start_time: datetime
    actual_start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    allow_faculty_hotspot: bool = False
    status: str = "scheduled"  # scheduled, active, ended
    total_students_enrolled: int = 0
    total_students_present: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class AttendanceRecordCreate(BaseModel):
    session_id: str
    student_id: str
    marking_time: datetime
    status: str  # "present", "absent", "od"
    wifi_bssid: str
    wifi_rssi: Optional[int] = None
    face_confidence: float


class AttendanceRecord(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    session_id: str
    student_id: str
    marking_time: datetime
    status: str
    wifi_bssid: str
    wifi_rssi: Optional[int] = None
    face_confidence: float
    verified: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class ODRequestCreate(BaseModel):
    student_id: str
    session_id: str
    reason: str
    supporting_document_url: Optional[str] = None


class ODRequestUpdate(BaseModel):
    status: str  # "pending", "approved", "rejected"
    comment: Optional[str] = None


class ODRequest(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    student_id: str
    session_id: str
    reason: str
    supporting_document_url: Optional[str] = None
    status: str = "pending"
    requested_at: datetime
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    comment: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class FaceEmbedding(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    student_id: str
    embedding: List[float]  # 512-dimensional vector
    image_metadata: Optional[Dict[str, Any]] = None  # No raw image stored
    confidence_score: float
    registered_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class Notification(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    title: str
    message: str
    notification_type: str  # "attendance_warning", "od_approval", "session_reminder"
    data: Optional[Dict[str, Any]] = None
    read: bool = False
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class AuditLog(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None
    ip_address: str
    user_agent: str
    created_at: datetime

    class Config:
        populate_by_name = True


class AnnouncementCreate(BaseModel):
    batch: str
    department: str
    section: str
    message: str


class AnnouncementResponse(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    advisor_id: str
    advisor_name: str
    batch: str
    department: str
    section: str
    message: str
    created_at: datetime