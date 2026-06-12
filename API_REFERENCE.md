# API Reference

## Authentication

All protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer <access_token>
```

## Endpoints

### Public Endpoints

#### Register User
```
POST /api/v1/auth/register
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "SecurePassword@123",
  "first_name": "John",
  "last_name": "Doe",
  "role": "student"  // student, faculty, advisor, admin
}

Response (201):
{
  "message": "User registered successfully",
  "user_id": "507f1f77bcf86cd799439011"
}

Response (400):
{
  "detail": "Email already registered"
}
```

#### Login
```
POST /api/v1/auth/login
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "SecurePassword@123"
}

Response (200):
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "student",
    "is_active": true
  },
  "tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer"
  }
}

Response (401):
{
  "detail": "Invalid email or password"
}
```

### Protected Endpoints

#### Get Current User
```
GET /api/v1/auth/me
Authorization: Bearer <token>

Response (200):
{
  "id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "student",
  "phone_number": "+91...",
  "is_active": true
}

Response (401):
{
  "detail": "Invalid or expired token"
}
```

#### Change Password
```
POST /api/v1/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "old_password": "OldPassword@123",
  "new_password": "NewPassword@123"
}

Response (200):
{
  "message": "Password changed successfully"
}

Response (400):
{
  "detail": "Invalid old password"
}
```

### Student Endpoints

#### Register Face
```
POST /api/v1/students/register-face
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "embedding": [0.1234, 0.5678, ...],  // 512-dimensional array
  "confidence_score": 0.95
}

Response (200):
{
  "message": "Face registered successfully",
  "embedding_id": "507f1f77bcf86cd799439011"
}

Response (403):
{
  "detail": "Only students can register face"
}
```

#### Mark Attendance
```
POST /api/v1/students/mark-attendance
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "session_id": "507f1f77bcf86cd799439011",
  "embedding": [0.1234, 0.5678, ...],  // 512-dimensional
  "latitude": 28.7041,
  "longitude": 77.1025,
  "wifi_bssid": "AA:BB:CC:DD:EE:FF"
}

Response (200):
{
  "message": "Attendance marked successfully",
  "face_verified": true,
  "confidence": 0.95
}

Response (400):
{
  "detail": "Outside geofence (distance: 523.45m)"
}

Response (401):
{
  "detail": "Face verification failed"
}
```

#### Get Attendance History
```
GET /api/v1/students/attendance-history
Authorization: Bearer <token>

Response (200):
{
  "attendance_records": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "session_id": "...",
      "student_id": "...",
      "marking_time": "2024-06-10T10:30:00Z",
      "status": "present",
      "latitude": 28.7041,
      "longitude": 77.1025,
      "wifi_bssid": "AA:BB:CC:DD:EE:FF",
      "face_confidence": 0.95,
      "verified": true
    }
  ],
  "total_records": 45
}
```

#### Get Attendance Percentage
```
GET /api/v1/students/attendance-percentage
Authorization: Bearer <token>

Response (200):
{
  "attendance_percentage": 85.5,
  "status": "good"
}
```

### Faculty Endpoints

#### Create Session
```
POST /api/v1/faculty/create-session
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "subject_id": "507f1f77bcf86cd799439011",
  "session_title": "Lecture 1: Introduction",
  "duration_minutes": 60,
  "latitude": 28.7041,
  "longitude": 77.1025,
  "radius_meters": 500
}

Response (200):
{
  "message": "Session created successfully",
  "session_id": "507f1f77bcf86cd799439011"
}

Response (403):
{
  "detail": "Only faculty can create sessions"
}
```

#### Start Session
```
POST /api/v1/faculty/start-session
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "session_id": "507f1f77bcf86cd799439011"
}

Response (200):
{
  "message": "Session started successfully"
}
```

#### End Session
```
POST /api/v1/faculty/end-session
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "session_id": "507f1f77bcf86cd799439011"
}

Response (200):
{
  "message": "Session ended successfully"
}
```

#### Get Faculty Sessions
```
GET /api/v1/faculty/sessions
Authorization: Bearer <token>

Response (200):
{
  "sessions": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "subject_id": "...",
      "faculty_id": "...",
      "session_title": "Lecture 1",
      "duration_minutes": 60,
      "status": "active",
      "total_students_enrolled": 50,
      "total_students_present": 45,
      "scheduled_start_time": "2024-06-10T10:00:00Z",
      "actual_start_time": "2024-06-10T10:05:00Z"
    }
  ],
  "total_sessions": 1
}
```

#### Get Session Attendance
```
GET /api/v1/faculty/session/{session_id}/attendance
Authorization: Bearer <token>

Response (200):
{
  "records": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "session_id": "...",
      "student_id": "...",
      "marking_time": "2024-06-10T10:30:00Z",
      "status": "present",
      "face_confidence": 0.95
    }
  ],
  "total_present": 45,
  "total_records": 50
}
```

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 200 | Success | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid input or validation error |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error |

## Rate Limiting

Rate limiting may be implemented. Look for headers:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Response Format

All responses follow this format:

```json
{
  "data": {},  // Actual response data
  "message": "Success message",
  "status_code": 200
}
```

Errors:
```json
{
  "detail": "Error description",
  "status_code": 400
}
```

## Pagination

For list endpoints, pagination may be available:

```
GET /api/v1/students/attendance-history?page=1&limit=20
```

Response includes:
```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5
  }
}
```

## Webhooks

Webhooks can be set up for real-time notifications:
- `attendance.marked`: When attendance is marked
- `session.started`: When session starts
- `session.ended`: When session ends
- `face.registered`: When face is registered

## SDK/Client Libraries

- Python: `smart-attendance-py` (coming soon)
- JavaScript: `smart-attendance-js` (coming soon)
- React: Built-in integration

## Base URL

Development: `http://localhost:8000/api/v1`
Production: `https://yourdomain.com/api/v1`

## Version

Current API Version: `v1`

Future versions will be available at `/api/v2`, etc.
