# 🎓 Smart Attendance System - Backend

Complete Node.js + Express backend server for the Smart Attendance System with Face Recognition.

## 📦 Features

- ✅ Authentication & Authorization (JWT)
- ✅ Attendance tracking & marking
- ✅ Face recognition verification
- ✅ Role-based access control (Student, Faculty, Advisor, HOD)
- ✅ Attendance reports & analytics
- ✅ Firebase integration
- ✅ Demo mode (works without Firebase)
- ✅ Error handling & validation

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local` and fill in your Firebase credentials:
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
PORT=5000
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_email
JWT_SECRET=your_secret
CORS_ORIGIN=http://localhost:5173
```

### 3. Start Server

**Development** (with auto-reload):
```bash
npm run dev
```

**Production**:
```bash
npm start
```

Server runs at: `http://localhost:5000`

## 📡 API Endpoints

### Authentication
```
POST   /api/auth/login
POST   /api/auth/register
GET    /api/auth/profile
PUT    /api/auth/profile
```

### Attendance
```
POST   /api/attendance/mark
GET    /api/attendance/my-records
GET    /api/attendance/stats
GET    /api/attendance/course/:courseId
```

### Admin
```
GET    /api/admin/students
GET    /api/admin/attendance-report
GET    /api/admin/attendance-report/export
GET    /api/admin/system-stats
```

### Health Check
```
GET    /health
```

---

## 🔐 Authentication

All API endpoints (except `/login` and `/register`) require a Bearer token:

```
Authorization: Bearer <token>
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@sece.ac.in",
    "password": "password123"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "uid": "user123",
    "email": "student@sece.ac.in",
    "displayName": "John Doe",
    "role": "student"
  }
}
```

---

## 📝 API Usage Examples

### Mark Attendance
```bash
curl -X POST http://localhost:5000/api/attendance/mark \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "CS101",
    "latitude": 13.1234,
    "longitude": 77.5678,
    "faceDistance": 0.25,
    "confidence": 95
  }'
```

### Get Attendance Records
```bash
curl -X GET http://localhost:5000/api/attendance/my-records \
  -H "Authorization: Bearer <token>"
```

### Get Attendance Statistics
```bash
curl -X GET http://localhost:5000/api/attendance/stats?courseId=CS101 \
  -H "Authorization: Bearer <token>"
```

### Get Course Attendance (Faculty/HOD only)
```bash
curl -X GET http://localhost:5000/api/attendance/course/CS101 \
  -H "Authorization: Bearer <token>"
```

### Get Attendance Report (Faculty/HOD only)
```bash
curl -X GET "http://localhost:5000/api/admin/attendance-report?courseId=CS101&startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <token>"
```

### Export Report as CSV
```bash
curl -X GET "http://localhost:5000/api/admin/attendance-report/export?courseId=CS101&format=csv" \
  -H "Authorization: Bearer <token>" \
  > attendance.csv
```

---

## 🔧 Project Structure

```
backend/
├── server.js                 # Main entry point
├── package.json             # Dependencies
├── .env.example             # Environment template
├── .env.local               # Your local config (git ignored)
└── src/
    ├── config/
    │   ├── index.js         # Configuration loader
    │   └── firebase.js      # Firebase initialization
    ├── routes/
    │   ├── authRoutes.js    # Auth endpoints
    │   ├── attendanceRoutes.js
    │   └── adminRoutes.js
    ├── controllers/
    │   ├── authController.js
    │   ├── attendanceController.js
    │   └── adminController.js
    ├── middleware/
    │   ├── auth.js          # JWT authentication
    │   └── errorHandler.js  # Error handling
    ├── models/              # Data models (future)
    └── utils/               # Utilities (future)
```

---

## 🔑 Role-Based Access

| Endpoint | Student | Faculty | Advisor | HOD |
|----------|---------|---------|---------|-----|
| POST /auth/login | ✅ | ✅ | ✅ | ✅ |
| POST /auth/register | ✅ | ✅ | ✅ | ✅ |
| GET /auth/profile | ✅ | ✅ | ✅ | ✅ |
| POST /attendance/mark | ✅ | - | - | - |
| GET /attendance/my-records | ✅ | - | - | - |
| GET /attendance/course/:id | - | ✅ | ✅ | ✅ |
| GET /admin/students | - | ✅ | ✅ | ✅ |
| GET /admin/attendance-report | - | ✅ | ✅ | ✅ |
| GET /admin/system-stats | - | - | - | ✅ |

---

## 🗄️ Data Models

### User
```javascript
{
  uid: String,
  email: String,
  displayName: String,
  role: 'student' | 'faculty' | 'advisor' | 'hod',
  rollNumber: String (for students),
  photoUrl: String,
  faceDescriptor: String (512-D face embedding),
  trainingStats: {
    timestamp: Date,
    qualityScore: Number,
    poseCount: Number
  },
  createdAt: Date
}
```

### Attendance
```javascript
{
  userId: String,
  userEmail: String,
  courseId: String,
  timestamp: Date,
  latitude: Number,
  longitude: Number,
  faceDistance: Number,      // 0-1 (lower = better match)
  confidence: Number,         // 0-100%
  status: 'present' | 'absent',
  livenessVerified: Boolean
}
```

---

## 🧪 Testing

### Test with Demo Mode (No Firebase)
The backend works in demo mode without Firebase credentials. Users are stored in memory.

### Test Endpoints
```bash
# Health check
curl http://localhost:5000/health

# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "displayName": "Test User",
    "role": "student"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

---

## 🔐 Security Features

- ✅ JWT token-based authentication
- ✅ Role-based access control (RBAC)
- ✅ CORS protection
- ✅ Helmet security headers
- ✅ Input validation
- ✅ Error handling (no sensitive info leakage)
- ✅ Environment variable configuration

---

## 🚀 Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Heroku
```bash
heroku create smart-attendance-api
heroku config:set FIREBASE_PROJECT_ID=...
git push heroku main
```

### Environment Variables Required
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `JWT_SECRET` (production: use strong secret)
- `NODE_ENV=production`

---

## 📊 API Response Format

All responses are in JSON format:

### Success (2xx)
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error (4xx/5xx)
```json
{
  "error": "Error message",
  "details": "Additional details (optional)"
}
```

---

## 🐛 Troubleshooting

### Firebase Connection Error
- Check `.env.local` has correct credentials
- Backend will fall back to demo mode if Firebase unavailable
- Check Firebase Console for service account key

### CORS Error
- Ensure `CORS_ORIGIN` in `.env.local` matches frontend URL
- Frontend must be at `http://localhost:5173`

### Token Expired
- Regenerate token by logging in again
- Check `JWT_EXPIRE` setting (default: 7d)

---

## 📚 Tech Stack

- **Framework**: Express.js v4.18
- **Language**: Node.js (ES6 modules)
- **Authentication**: JWT (jsonwebtoken)
- **Backend-as-a-Service**: Firebase Admin SDK
- **Security**: Helmet, CORS
- **Dev Tool**: Nodemon

---

## 📄 License

ISC License - Smart Attendance Team

---

## 🤝 Support

For issues or questions:
1. Check `.env.local` configuration
2. Review API endpoint documentation above
3. Check Firebase console for errors
4. Enable demo mode by removing Firebase credentials

**Happy coding! 🎉**
