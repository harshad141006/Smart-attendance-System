# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│                    React.js Frontend (Port 3000)             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Login Page │  │  Dashboards  │  │  Attendance  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│                      API Gateway / Nginx                    │
├─────────────────────────────────────────────────────────────┤
│                   FastAPI Backend (Port 8000)               │
│   ┌────────────────────────────────────────────────────┐   │
│   │              API Routes & Controllers              │   │
│   │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│   │  │   Auth   │ │ Students │ │ Faculty  │          │   │
│   │  └──────────┘ └──────────┘ └──────────┘          │   │
│   └────────────────────────────────────────────────────┘   │
│   ┌────────────────────────────────────────────────────┐   │
│   │            Services Layer                          │   │
│   │  ┌─────────────┐ ┌─────────────┐ ┌────────────┐  │   │
│   │  │   Face      │ │ Attendance  │ │ Auth       │  │   │
│   │  │ Recognition │ │ Management  │ │ Service    │  │   │
│   │  └─────────────┘ └─────────────┘ └────────────┘  │   │
│   └────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Caching & Storage                        │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Redis Cache     │  │  MongoDB         │               │
│  │  (Port 6379)     │  │  (Port 27017)    │               │
│  │ ┌──────────────┐ │  │ ┌──────────────┐ │               │
│  │ │ Embeddings   │ │  │ │ Users        │ │               │
│  │ │ Sessions     │ │  │ │ Students     │ │               │
│  │ │ WiFi Config  │ │  │ │ Attendance   │ │               │
│  │ └──────────────┘ │  │ └──────────────┘ │               │
│  └──────────────────┘  └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Architecture

```
App.jsx
├── Router Setup
├── Theme Configuration
└── Layout
    ├── DashboardLayout
    │   ├── Navigation
    │   ├── Sidebar
    │   └── Content Area
    └── Routes
        ├── Public Routes
        │   ├── Login
        │   ├── Register
        │   └── ForgotPassword
        └── Protected Routes
            ├── Student Routes
            │   ├── Dashboard
            │   ├── FaceRegistration
            │   ├── MarkAttendance
            │   └── History
            ├── Faculty Routes
            ├── Advisor Routes
            └── Admin Routes

Redux Store
├── Auth Slice (User, Tokens, Authentication State)

Hooks
├── useAuth (Authentication logic)
├── useCamera (Camera access)
└── useGeolocation (Location services)

Services
├── API Client (Axios instance)
├── Auth Service
├── Student Service
└── Faculty Service
```

### Backend Architecture

```
FastAPI Application
├── Main (app/main.py)
│   ├── CORS Middleware
│   ├── Lifespan Context Manager
│   └── Routes Inclusion
│
├── API Routes (app/api/routes/)
│   ├── auth.py (Authentication endpoints)
│   ├── students.py (Student endpoints)
│   ├── faculty.py (Faculty endpoints)
│   ├── advisors.py (Advisor endpoints)
│   └── admins.py (Admin endpoints)
│
├── Services (app/services/)
│   ├── auth/
│   │   └── auth_service.py
│   ├── face_recognition/
│   │   ├── embedding_service.py
│   │   ├── verification_service.py
│   │   └── registration_service.py
│   └── attendance/
│       └── attendance_service.py
│
├── Core (app/core/)
│   ├── config.py (Configuration)
│   ├── database.py (MongoDB connection)
│   └── security.py (JWT & encryption)
│
├── Cache (app/cache/)
│   └── redis_cache.py (Redis operations)
│
└── Utils (app/utils/)
    └── logger.py (Logging)
```

## Data Flow

### Face Registration Flow

```
1. Student captures face via camera
   ↓
2. Frontend sends face image to backend
   ↓
3. Backend processes image and generates embedding (ViT model)
   ↓
4. Embedding is normalized (512-dimensional vector)
   ↓
5. Embedding stored in MongoDB
   ↓
6. Confirmation sent to frontend
```

### Attendance Marking Flow

```
1. Student starts attendance marking process
   ↓
2. Get current location (geolocation)
   ↓
3. Get connected WiFi BSSID
   ↓
4. Capture face image
   ↓
5. Generate embedding from face image
   ↓
6. Send to backend with location and WiFi info
   ↓
7. Backend validates:
   - Face verification against stored embedding
   - Geofence verification (Haversine distance)
   - WiFi BSSID verification
   - Session active status
   ↓
8. If all validations pass: Mark attendance in MongoDB
   ↓
9. Send response with result to frontend
```

### Session Management Flow

```
1. Faculty creates attendance session
   ↓
2. Session stored in MongoDB with schedule details
   ↓
3. Faculty starts session
   ↓
4. Session status changes to "active"
   ↓
5. Session details cached in Redis
   ↓
6. Students can now mark attendance
   ↓
7. Faculty ends session
   ↓
8. Session status changes to "ended"
   ↓
9. Attendance report generated
```

## Database Schema

### Collections

1. **users** - User accounts and credentials
2. **students** - Student profile information
3. **faculty** - Faculty profile information
4. **departments** - Department information
5. **subjects** - Subject/Course information
6. **attendance_sessions** - Attendance session details
7. **attendance_records** - Individual attendance marks
8. **face_embeddings** - Stored face embeddings
9. **od_requests** - On Duty requests
10. **notifications** - User notifications
11. **audit_logs** - System audit trails

## API Endpoints Summary

### Authentication (Public)
- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/change-password` - Change password

### Student (Protected - Role: student)
- `POST /api/v1/students/register-face` - Register face
- `POST /api/v1/students/mark-attendance` - Mark attendance
- `GET /api/v1/students/attendance-history` - Get history
- `GET /api/v1/students/attendance-percentage` - Get percentage

### Faculty (Protected - Role: faculty)
- `POST /api/v1/faculty/create-session` - Create session
- `POST /api/v1/faculty/start-session` - Start session
- `POST /api/v1/faculty/end-session` - End session
- `GET /api/v1/faculty/sessions` - Get sessions
- `GET /api/v1/faculty/session/{id}/attendance` - Get attendance

## Deployment Architecture

```
                         Internet
                            ↓
                    ┌────────────────┐
                    │ DNS / Domain   │
                    └────────────────┘
                            ↓
                    ┌────────────────┐
                    │ SSL Certificate│
                    │ (Let's Encrypt)│
                    └────────────────┘
                            ↓
                    ┌────────────────┐
                    │  Nginx Proxy   │
                    │ (Port 80/443)  │
                    └────────────────┘
                            ↓
            ┌───────────────┴───────────────┐
            ↓                               ↓
    ┌───────────────┐              ┌──────────────┐
    │  Frontend     │              │  Backend     │
    │  (Port 3000)  │              │ (Port 8000)  │
    │  Docker       │              │  Docker      │
    │  Container    │              │  Container   │
    └───────────────┘              └──────────────┘
            ↓                               ↓
            └───────────────┬───────────────┘
                            ↓
            ┌──────────────────────────────┐
            │    Docker Network            │
            ├──────────────────────────────┤
            │ ┌────────────┐ ┌──────────┐  │
            │ │ MongoDB    │ │  Redis   │  │
            │ │ Container  │ │ Container│  │
            │ └────────────┘ └──────────┘  │
            └──────────────────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────┐
│         HTTPS/TLS Layer                 │
│    (SSL Certificate - Let's Encrypt)    │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│         CORS Configuration              │
│   (Allowed Origins Whitelist)           │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│         JWT Token Validation            │
│    (Authentication & Authorization)    │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│      Input Validation (Pydantic)        │
│        Schema Validation                │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│     Database Authentication             │
│   (MongoDB & Redis Credentials)         │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│         Audit Logging                   │
│    (All Actions Tracked)                │
└─────────────────────────────────────────┘
```

## Performance Optimization

1. **Caching Strategy**
   - Student embeddings cached in Redis
   - Session details cached in Redis
   - TTL: 1 hour (configurable)

2. **Database Indexing**
   - Indexes on frequently queried fields
   - Compound indexes for common queries
   - TTL index for automatic cleanup

3. **Async Processing**
   - All database operations are async
   - Non-blocking I/O throughout

4. **Connection Pooling**
   - MongoDB connection pool
   - Redis connection pool

5. **Frontend Optimization**
   - Code splitting with React lazy loading
   - Vite for fast builds
   - CSS minification

## Scalability

### Horizontal Scaling

```
Load Balancer (Nginx)
        ↓
    ┌───┴───┐
    ↓       ↓
Backend-1 Backend-2 ... Backend-n
    ↓       ↓
MongoDB Replica Set
    ↓
Redis Cluster
```

### Vertical Scaling

- Increase server resources (CPU, RAM)
- Increase MongoDB memory allocation
- Increase Redis memory limit
- Optimize database indexes

## Monitoring & Logging

1. **Application Logging**
   - File-based logging
   - Console logging
   - Structured logging format

2. **Metrics**
   - Request count
   - Response time
   - Error rate
   - Face verification success rate
   - Attendance marking success rate

3. **Health Checks**
   - `/health` endpoint
   - Database connectivity
   - Redis connectivity
   - API responsiveness

4. **Error Tracking**
   - Sentry integration (optional)
   - Error logs in MongoDB
   - Alert notifications
