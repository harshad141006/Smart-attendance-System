# Setup Guide

## Quick Start

### Option 1: Using Docker Compose (Recommended)

1. **Prerequisites**
   - Docker installed
   - Docker Compose installed

2. **Clone and Setup**
   ```bash
   cd smart-attendance-system
   cp backend/.env.example backend/.env
   ```

3. **Start Services**
   ```bash
   docker-compose up -d
   ```

4. **Access Applications**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Option 2: Local Development Setup

#### Backend Setup

1. **Install Python 3.11+**
   ```bash
   python --version
   ```

2. **Navigate to Backend**
   ```bash
   cd backend
   ```

3. **Create Virtual Environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

4. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

5. **Setup MongoDB**
   - Option A: Local MongoDB
     ```bash
     mongod
     ```
   - Option B: MongoDB Atlas (Cloud)
     - Create account at https://www.mongodb.com/cloud/atlas
     - Create cluster and get connection string
     - Update MONGODB_URL in .env

6. **Setup Redis**
   ```bash
   # macOS with Homebrew
   brew install redis
   redis-server

   # Linux
   sudo apt-get install redis-server
   redis-server

   # Windows - Download from https://github.com/microsoftarchive/redis/releases
   redis-server.exe
   ```

7. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

8. **Run Backend**
   ```bash
   python run.py
   ```

   Backend will be available at `http://localhost:8000`

#### Frontend Setup

1. **Install Node.js 18+**
   ```bash
   node --version
   npm --version
   ```

2. **Navigate to Frontend**
   ```bash
   cd frontend
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

   Frontend will be available at `http://localhost:3000`

## Configuration

### Backend Configuration

Edit `backend/.env`:

```env
# API Settings
DEBUG=True
API_TITLE=Smart Attendance System API

# Database
MONGODB_URL=mongodb://localhost:27017/smart_attendance_db
MONGODB_DB_NAME=smart_attendance_db

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=your-super-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# Face Recognition
FACE_SIMILARITY_THRESHOLD=0.6

# Geofencing
COLLEGE_LATITUDE=28.7041
COLLEGE_LONGITUDE=77.1025
GEOFENCE_RADIUS_METERS=500

# WiFi
COLLEGE_BSSID=AA:BB:CC:DD:EE:FF
FACULTY_HOTSPOT_BSSID=11:22:33:44:55:66

# Attendance
MIN_ATTENDANCE_PERCENTAGE=75
MAX_OD_REQUESTS_PER_SEMESTER=5
```

### Frontend Configuration

Environment variables are set in `frontend/.env` (create if doesn't exist):

```env
REACT_APP_API_URL=http://localhost:8000/api/v1
REACT_APP_DEBUG=true
```

## Database Setup

### Initialize MongoDB Collections

```bash
# Connect to MongoDB
mongosh

# Create database
use smart_attendance_db

# Create collections with validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "password_hash", "role"],
      properties: {
        email: { bsonType: "string" },
        password_hash: { bsonType: "string" },
        role: { enum: ["student", "faculty", "advisor", "admin"] }
      }
    }
  }
})

# Create indexes
db.users.createIndex({ "email": 1 }, { unique: true })
db.students.createIndex({ "user_id": 1 }, { unique: true })
db.students.createIndex({ "enrollment_number": 1 }, { unique: true })
db.faculty.createIndex({ "user_id": 1 }, { unique: true })
db.attendance_records.createIndex({ "session_id": 1, "student_id": 1 }, { unique: true })
db.face_embeddings.createIndex({ "student_id": 1 })
db.attendance_sessions.createIndex({ "faculty_id": 1, "status": 1 })
```

## Testing

### Backend Tests

```bash
cd backend

# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest

# Run with coverage
pytest --cov=app
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

## Verification

### Check Backend
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

### Test API Endpoint
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123",
    "first_name": "Test",
    "last_name": "User",
    "role": "student"
  }'
```

### Check Frontend
Open browser and navigate to `http://localhost:3000`

You should see the login page.

## Common Issues & Solutions

### 1. MongoDB Connection Failed

**Error**: `Failed to connect to MongoDB`

**Solution**:
```bash
# Check if MongoDB is running
mongosh

# If not running, start it
mongod

# Verify connection string in .env
# Should be: mongodb://localhost:27017/smart_attendance_db
```

### 2. Redis Connection Failed

**Error**: `Failed to connect to Redis`

**Solution**:
```bash
# Check if Redis is running
redis-cli ping

# If not running, start it
redis-server

# Verify connection string in .env
# Should be: redis://localhost:6379/0
```

### 3. Port Already in Use

**Error**: `Address already in use`

**Solution**:
```bash
# Find process using port 8000
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### 4. Module Not Found

**Error**: `ModuleNotFoundError: No module named 'app'`

**Solution**:
```bash
# Make sure you're in backend directory
cd backend

# Reinstall dependencies
pip install -r requirements.txt

# Run with correct path
python run.py
```

### 5. CORS Error in Frontend

**Error**: `Access to XMLHttpRequest blocked by CORS`

**Solution**:
- Check backend ALLOWED_HOSTS in .env
- Should include frontend URL: `http://localhost:3000`

```env
ALLOWED_HOSTS=["http://localhost:3000"]
```

### 6. Face Recognition Model Download Fails

**Error**: `Failed to load face embedding model`

**Solution**:
```bash
# Download model manually
python -c "import timm; timm.create_model('hf_hub:gaunernst/vit_small_patch8_gap_112.cosface_ms1mv3', pretrained=True)"

# Check internet connection
ping huggingface.co
```

## Development Workflow

### Backend Development

1. Create feature branch
   ```bash
   git checkout -b feature/feature-name
   ```

2. Make changes

3. Run tests
   ```bash
   pytest
   ```

4. Format code
   ```bash
   black app/
   ```

5. Commit and push
   ```bash
   git add .
   git commit -m "Add feature"
   git push origin feature/feature-name
   ```

### Frontend Development

1. Create feature branch
   ```bash
   git checkout -b feature/feature-name
   ```

2. Make changes

3. Run tests
   ```bash
   npm test
   ```

4. Format code
   ```bash
   npm run lint
   ```

5. Build to check
   ```bash
   npm run build
   ```

6. Commit and push
   ```bash
   git add .
   git commit -m "Add feature"
   git push origin feature/feature-name
   ```

## Next Steps

1. **Configure Your Settings**
   - Update .env files with production settings
   - Setup real MongoDB and Redis instances
   - Configure SMTP for emails (optional)

2. **Add Sample Data**
   - Create admin user
   - Add departments and subjects
   - Register faculty members

3. **Customize Branding**
   - Update app name and logos
   - Customize color theme in Material-UI

4. **Setup Monitoring**
   - Configure logging
   - Setup error tracking (e.g., Sentry)
   - Monitor performance

5. **Deploy to Production**
   - Follow DEPLOYMENT.md guide
   - Setup SSL certificates
   - Configure domain name

## Getting Help

- Check API documentation at `http://localhost:8000/docs`
- Review code comments and docstrings
- Check GitHub issues
- Create new issue with details
