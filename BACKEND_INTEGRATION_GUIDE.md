# 🔗 Frontend-Backend Integration Guide

Complete guide to connect the React frontend with the Node.js backend.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│           React Frontend (Vite)                      │
│       http://localhost:5173                          │
│   - Student Dashboard                               │
│   - Face Recognition                                │
│   - Attendance Marking                              │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ HTTP/REST API
                       │ Bearer Token Auth
                       │
┌──────────────────────▼──────────────────────────────┐
│         Node.js + Express Backend                    │
│       http://localhost:5000/api                      │
│   - User Management                                 │
│   - Attendance Tracking                             │
│   - Reporting & Analytics                          │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ Firebase Admin SDK
                       │
┌──────────────────────▼──────────────────────────────┐
│              Firebase Services                       │
│   - Authentication                                  │
│   - Firestore Database                              │
│   - User Profiles                                   │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Setup Instructions

### Step 1: Start the Backend

```bash
cd backend
npm install
npm run dev
```

Server will run at: `http://localhost:5000`

### Step 2: Update Frontend Configuration

In `src/utils/api.js` or create this file if it doesn't exist:

```javascript
// src/utils/api.js
const API_BASE_URL = 'http://localhost:5000/api';

export const authAPI = {
  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) throw new Error('Login failed');
    return response.json();
  },

  register: async (email, password, displayName, rollNumber) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        displayName,
        role: 'student',
        rollNumber
      })
    });
    if (!response.ok) throw new Error('Registration failed');
    return response.json();
  },

  getProfile: async (token) => {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch profile');
    return response.json();
  },

  updateProfile: async (token, data) => {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Profile update failed');
    return response.json();
  }
};

export const attendanceAPI = {
  mark: async (token, courseId, faceData, location) => {
    const response = await fetch(`${API_BASE_URL}/attendance/mark`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        courseId,
        latitude: location?.latitude,
        longitude: location?.longitude,
        faceDistance: faceData?.distance,
        confidence: faceData?.confidence
      })
    });
    if (!response.ok) throw new Error('Attendance marking failed');
    return response.json();
  },

  getRecords: async (token, courseId) => {
    const url = new URL(`${API_BASE_URL}/attendance/my-records`);
    if (courseId) url.searchParams.append('courseId', courseId);

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch records');
    return response.json();
  },

  getStats: async (token, courseId) => {
    const url = new URL(`${API_BASE_URL}/attendance/stats`);
    if (courseId) url.searchParams.append('courseId', courseId);

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  }
};

export const adminAPI = {
  getCourseAttendance: async (token, courseId) => {
    const response = await fetch(`${API_BASE_URL}/attendance/course/${courseId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch course attendance');
    return response.json();
  },

  getReport: async (token, courseId, startDate, endDate) => {
    const url = new URL(`${API_BASE_URL}/admin/attendance-report`);
    url.searchParams.append('courseId', courseId);
    if (startDate) url.searchParams.append('startDate', startDate);
    if (endDate) url.searchParams.append('endDate', endDate);

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch report');
    return response.json();
  },

  exportReport: async (token, courseId, format = 'csv') => {
    const url = new URL(`${API_BASE_URL}/admin/attendance-report/export`);
    url.searchParams.append('courseId', courseId);
    url.searchParams.append('format', format);

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to export report');
    
    if (format === 'csv') {
      return response.text();
    }
    return response.json();
  }
};
```

### Step 3: Update AuthContext

Modify `src/firebase/AuthContext.jsx` to use backend API:

```javascript
import { authAPI } from '../utils/api.js';

// In your AuthContext provider:

export const login = async (email, password) => {
  try {
    // Try backend first
    const response = await authAPI.login(email, password);
    
    // Store token
    localStorage.setItem('token', response.token);
    setUser(response.user);
    
    return response;
  } catch (error) {
    console.error('Backend login failed:', error);
    // Fall back to Firebase if needed
    // ... existing Firebase logic
  }
};

export const register = async (email, password, displayName, rollNumber) => {
  try {
    const response = await authAPI.register(
      email,
      password,
      displayName,
      rollNumber
    );
    
    localStorage.setItem('token', response.token);
    setUser(response.user);
    
    return response;
  } catch (error) {
    console.error('Backend registration failed:', error);
    // Fall back to Firebase if needed
  }
};
```

### Step 4: Update Attendance Marking

In `src/components/CameraVerification.jsx`:

```javascript
import { attendanceAPI } from '../utils/api.js';

// When marking attendance:
const markAttendance = async (faceData) => {
  const token = localStorage.getItem('token');
  
  const location = {
    latitude: null,
    longitude: null
  };
  
  // Get location if available
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      location.latitude = pos.coords.latitude;
      location.longitude = pos.coords.longitude;
    });
  }
  
  try {
    const result = await attendanceAPI.mark(
      token,
      courseId,
      faceData,
      location
    );
    
    console.log('Attendance marked:', result);
    return result;
  } catch (error) {
    console.error('Failed to mark attendance:', error);
    throw error;
  }
};
```

---

## 📡 API Integration Checklist

### Authentication
- [ ] Login endpoint integrated
- [ ] Register endpoint integrated
- [ ] Token stored in localStorage
- [ ] Token sent in all API requests
- [ ] Token refresh/renewal implemented
- [ ] Logout clears token

### Attendance
- [ ] Mark attendance endpoint integrated
- [ ] Get attendance records endpoint integrated
- [ ] Get stats endpoint integrated
- [ ] Course attendance endpoint (for faculty)
- [ ] Location data sent with attendance
- [ ] Face distance & confidence tracked

### Admin/Faculty
- [ ] Get students list
- [ ] View course attendance
- [ ] Generate reports
- [ ] Export to CSV
- [ ] System statistics

---

## 🧪 Testing the Integration

### 1. Test Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@sece.ac.in",
    "password": "password123"
  }'
```

### 2. Test with Frontend
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
npm run dev

# Open http://localhost:5173
# Try login/register/mark attendance
```

### 3. Check Network Requests
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Try login
4. Check request/response in Network tab
5. Verify headers include `Authorization: Bearer <token>`

---

## 🔐 Security Considerations

### CORS Configuration
The backend CORS is configured to accept:
```
http://localhost:5173 (default)
```

To change, update `.env.local`:
```
CORS_ORIGIN=http://your-frontend-url:port
```

### Token Management
```javascript
// Store token
localStorage.setItem('token', token);

// Send with requests
headers: {
  'Authorization': `Bearer ${token}`
}

// Clear on logout
localStorage.removeItem('token');
```

### Environment Variables
Never commit `.env.local`. Use `.env.example` as template.

---

## 🚨 Common Issues

### Issue 1: CORS Error
**Error:** `Access to XMLHttpRequest blocked by CORS policy`

**Solution:**
```javascript
// Make sure backend is running
// Check CORS_ORIGIN in backend/.env.local
// Restart backend after changing CORS_ORIGIN
```

### Issue 2: Token Errors
**Error:** `401 Unauthorized` or `Invalid token`

**Solution:**
```javascript
// Ensure token is being sent correctly
// Check token is stored in localStorage
// Verify token format: "Bearer <token>"
// Token expires in 7 days - re-login if needed
```

### Issue 3: Network Connection
**Error:** `Failed to fetch` or `Connection refused`

**Solution:**
```bash
# Check backend is running
curl http://localhost:5000/health

# Should respond with:
# { "status": "ok", "timestamp": "..." }
```

### Issue 4: Firebase and Backend Conflict
**Error:** Data inconsistency between Firebase and backend

**Solution:**
```javascript
// Backend can work with or without Firebase
// Set FIREBASE_* variables to enable Firebase sync
// Without Firebase, data is stored in memory (demo mode)
```

---

## 📊 Data Flow Example

### Student Marks Attendance

```
Student App
    │
    ├─ 1. Take face photo
    ├─ 2. Extract face descriptor (browser)
    ├─ 3. Calculate face distance vs registered descriptor
    │
    └─ 4. If verified (distance < 0.40):
         │
         POST /api/attendance/mark
         {
           courseId: "CS101",
           faceDistance: 0.23,
           confidence: 96,
           latitude: 13.123,
           longitude: 77.567
         }
         │
         Backend Server
         │
         ├─ 5. Validate request & token
         ├─ 6. Store attendance record
         ├─ 7. Sync to Firebase (if configured)
         │
         └─ 8. Return:
            {
              message: "Attendance marked",
              attendance: { ... }
            }
    │
    └─ 9. Display "Attendance marked successfully!"
```

---

## 🚀 Production Deployment

### Frontend (Vite)
```bash
npm run build
# Deploy dist/ to hosting (Vercel, Netlify, etc.)
```

### Backend (Node.js)
```bash
# Update .env.local with production values
NODE_ENV=production
PORT=5000
CORS_ORIGIN=https://your-frontend-domain.com

# Deploy to Heroku, AWS, Google Cloud, etc.
npm install
npm start
```

---

## 📚 Next Steps

1. ✅ Backend API complete
2. ✅ Frontend API utilities
3. ⏳ Connect frontend components
4. ⏳ Test end-to-end flow
5. ⏳ Deploy to production

---

**Status:** Ready for Integration  
**Updated:** June 9, 2024
