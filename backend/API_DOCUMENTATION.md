# 📡 Backend API Documentation

Complete API reference for Smart Attendance System backend.

---

## 🔑 Authentication

All endpoints except `/auth/login` and `/auth/register` require authentication.

**Header Format:**
```
Authorization: Bearer <your_jwt_token>
```

**Token Expiry:** 7 days (default)

---

## 🚀 Base URL

```
http://localhost:5000/api
```

---

## 1️⃣ Authentication Endpoints

### Login
Mark an attendance entry with face verification.

**Endpoint:** `POST /auth/login`

**Request:**
```json
{
  "email": "student@sece.ac.in",
  "password": "your_password"
}
```

**Response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uid": "user123abc",
    "email": "student@sece.ac.in",
    "displayName": "John Doe",
    "role": "student",
    "photoUrl": "https://..."
  }
}
```

**Error (401):**
```json
{
  "error": "Invalid credentials"
}
```

---

### Register
Create a new user account.

**Endpoint:** `POST /auth/register`

**Request:**
```json
{
  "email": "newstudent@sece.ac.in",
  "password": "secure_password123",
  "displayName": "Jane Smith",
  "role": "student",
  "rollNumber": "20CS102"
}
```

**Response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uid": "user456def",
    "email": "newstudent@sece.ac.in",
    "displayName": "Jane Smith",
    "role": "student"
  }
}
```

**Error (400):**
```json
{
  "error": "Email already registered"
}
```

---

### Get Profile
Get current user's profile information.

**Endpoint:** `GET /auth/profile`

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "uid": "user123abc",
  "email": "student@sece.ac.in",
  "displayName": "John Doe",
  "role": "student",
  "rollNumber": "20CS101",
  "photoUrl": "https://...",
  "faceDescriptor": "[0.12, 0.34, ..., 0.56]",
  "trainingStats": {
    "timestamp": "2024-06-09T10:30:00Z",
    "qualityScore": 85,
    "poseCount": 8
  },
  "createdAt": "2024-06-01T08:00:00Z"
}
```

---

### Update Profile
Update user profile information.

**Endpoint:** `PUT /auth/profile`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "displayName": "John Smith",
  "photoUrl": "https://...",
  "faceDescriptor": "[0.12, 0.34, ..., 0.56]",
  "trainingStats": {
    "timestamp": "2024-06-09T14:00:00Z",
    "qualityScore": 92,
    "poseCount": 8
  }
}
```

**Response (200):**
```json
{
  "message": "Profile updated",
  "data": {
    "displayName": "John Smith",
    "photoUrl": "https://..."
  }
}
```

---

## 2️⃣ Attendance Endpoints

### Mark Attendance
Record attendance with face verification details.

**Endpoint:** `POST /attendance/mark`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "courseId": "CS101",
  "latitude": 13.1234567,
  "longitude": 77.5678901,
  "faceDistance": 0.23,
  "confidence": 96
}
```

**Response (201):**
```json
{
  "message": "Attendance marked",
  "attendance": {
    "userId": "user123abc",
    "userEmail": "student@sece.ac.in",
    "courseId": "CS101",
    "timestamp": "2024-06-09T10:45:00Z",
    "latitude": 13.1234567,
    "longitude": 77.5678901,
    "faceDistance": 0.23,
    "confidence": 96,
    "status": "present"
  }
}
```

**Error (400):**
```json
{
  "error": "courseId required"
}
```

---

### Get My Attendance Records
Retrieve attendance history for the logged-in student.

**Endpoint:** `GET /attendance/my-records`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `courseId` (optional) - Filter by course
- `startDate` (optional) - Filter from date (ISO format)
- `endDate` (optional) - Filter to date (ISO format)

**Example:**
```
GET /attendance/my-records?courseId=CS101&startDate=2024-06-01&endDate=2024-06-30
```

**Response (200):**
```json
{
  "total": 25,
  "records": [
    {
      "userId": "user123abc",
      "userEmail": "student@sece.ac.in",
      "courseId": "CS101",
      "timestamp": "2024-06-09T10:45:00Z",
      "latitude": 13.1234567,
      "longitude": 77.5678901,
      "faceDistance": 0.23,
      "confidence": 96,
      "status": "present"
    },
    ...
  ]
}
```

---

### Get Attendance Statistics
Get summary statistics for attendance.

**Endpoint:** `GET /attendance/stats`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `courseId` (optional) - Filter by course

**Example:**
```
GET /attendance/stats?courseId=CS101
```

**Response (200):**
```json
{
  "total": 30,
  "present": 28,
  "absent": 2,
  "percentage": "93.33"
}
```

---

### Get Course Attendance (Faculty/HOD only)
Get attendance for all students in a course.

**Endpoint:** `GET /attendance/course/:courseId`

**Headers:**
```
Authorization: Bearer <token>
```

**Requires:** Faculty, Advisor, or HOD role

**Example:**
```
GET /attendance/course/CS101
```

**Response (200):**
```json
{
  "courseId": "CS101",
  "totalRecords": 150,
  "students": 6,
  "attendance": {
    "john.doe@sece.ac.in": [
      {
        "userId": "user123abc",
        "userEmail": "john.doe@sece.ac.in",
        "courseId": "CS101",
        "timestamp": "2024-06-09T10:45:00Z",
        "faceDistance": 0.23,
        "confidence": 96,
        "status": "present"
      }
    ],
    "jane.smith@sece.ac.in": [...]
  }
}
```

---

## 3️⃣ Admin Endpoints

### Get Students
Get list of all students (Faculty/HOD only).

**Endpoint:** `GET /admin/students`

**Headers:**
```
Authorization: Bearer <token>
```

**Requires:** Faculty, Advisor, or HOD role

**Response (200):**
```json
{
  "total": 45,
  "students": [
    {
      "uid": "user123abc",
      "email": "john.doe@sece.ac.in",
      "displayName": "John Doe",
      "role": "student",
      "rollNumber": "20CS101",
      "photoUrl": "https://...",
      "createdAt": "2024-06-01T08:00:00Z"
    },
    ...
  ]
}
```

---

### Get Attendance Report
Generate attendance report for a course.

**Endpoint:** `GET /admin/attendance-report`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `courseId` (required) - Course ID
- `startDate` (optional) - Start date (YYYY-MM-DD)
- `endDate` (optional) - End date (YYYY-MM-DD)

**Requires:** Faculty, Advisor, or HOD role

**Example:**
```
GET /admin/attendance-report?courseId=CS101&startDate=2024-06-01&endDate=2024-06-30
```

**Response (200):**
```json
{
  "courseId": "CS101",
  "period": {
    "startDate": "2024-06-01",
    "endDate": "2024-06-30"
  },
  "totalRecords": 150,
  "students": 6,
  "report": [
    {
      "email": "john.doe@sece.ac.in",
      "userId": "user123abc",
      "present": 28,
      "absent": 2,
      "total": 30,
      "percentage": 93.33
    },
    ...
  ]
}
```

---

### Export Attendance Report
Export attendance report as CSV or JSON.

**Endpoint:** `GET /admin/attendance-report/export`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `courseId` (required)
- `format` (optional) - `json` or `csv` (default: json)

**Requires:** Faculty, Advisor, or HOD role

**Example:**
```
GET /admin/attendance-report/export?courseId=CS101&format=csv
```

**Response (200) - CSV:**
```
Email,Course,Date,Time,Status,Face Distance,Confidence
john.doe@sece.ac.in,CS101,6/9/2024,10:45:30 AM,present,0.23,96
jane.smith@sece.ac.in,CS101,6/9/2024,10:46:00 AM,present,0.19,98
...
```

**Response (200) - JSON:**
```json
[
  {
    "userId": "user123abc",
    "userEmail": "john.doe@sece.ac.in",
    "courseId": "CS101",
    "timestamp": "2024-06-09T10:45:00Z",
    "status": "present",
    "faceDistance": 0.23,
    "confidence": 96
  },
  ...
]
```

---

### Get System Statistics (HOD only)
Get overall system statistics.

**Endpoint:** `GET /admin/system-stats`

**Headers:**
```
Authorization: Bearer <token>
```

**Requires:** HOD role

**Response (200):**
```json
{
  "totalUsers": 78,
  "students": 60,
  "faculty": 10,
  "advisors": 5,
  "hods": 3,
  "totalAttendanceRecords": 1250,
  "averageFaceDistance": 0.245,
  "averageConfidence": 94.8
}
```

---

## ✅ Health Check

### Server Health
Check if backend is running.

**Endpoint:** `GET /health`

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-06-09T14:30:00Z"
}
```

---

## 🚨 Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error",
  "details": "Email and password required"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden: Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Route not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## 📊 Data Types

### Role
- `student`
- `faculty`
- `advisor`
- `hod`
- `admin`

### Attendance Status
- `present`
- `absent`

### Face Distance
- Range: 0 to 1
- Lower = better match
- < 0.40 = Accepted
- >= 0.40 = Rejected

### Confidence
- Range: 0 to 100 (percentage)
- Higher = more confident

---

## 🔄 Request/Response Examples

### cURL
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@sece.ac.in",
    "password": "password123"
  }'

# Mark Attendance
curl -X POST http://localhost:5000/api/attendance/mark \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "CS101",
    "latitude": 13.1234567,
    "longitude": 77.5678901,
    "faceDistance": 0.23,
    "confidence": 96
  }'
```

### JavaScript/Fetch
```javascript
// Login
const response = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'student@sece.ac.in',
    password: 'password123'
  })
});
const { token, user } = await response.json();

// Mark Attendance
const attendanceResponse = await fetch('http://localhost:5000/api/attendance/mark', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    courseId: 'CS101',
    latitude: 13.1234567,
    longitude: 77.5678901,
    faceDistance: 0.23,
    confidence: 96
  })
});
const attendance = await attendanceResponse.json();
```

---

**Last Updated:** June 9, 2024  
**Version:** 1.0.0
