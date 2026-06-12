# Development Guide

## Code Structure Best Practices

### Backend File Organization

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app initialization
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── students.py
│   │       └── faculty.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── face_recognition/
│   │   │   ├── embedding_service.py
│   │   │   ├── verification_service.py
│   │   │   └── registration_service.py
│   │   ├── attendance/
│   │   │   └── attendance_service.py
│   │   └── auth/
│   │       └── auth_service.py
│   ├── core/
│   │   ├── config.py        # Settings
│   │   ├── database.py      # MongoDB connection
│   │   └── security.py      # JWT & hashing
│   ├── schemas/
│   │   └── schemas.py       # Pydantic models
│   ├── cache/
│   │   └── redis_cache.py
│   └── utils/
│       └── logger.py
├── requirements.txt
├── run.py                   # Entry point
└── .env.example
```

### Frontend File Organization

```
frontend/
├── src/
│   ├── App.jsx              # Root component
│   ├── main.jsx             # Entry point
│   ├── index.css            # Global styles
│   ├── pages/               # Page components
│   │   ├── LoginPage.jsx
│   │   ├── Student/
│   │   ├── Faculty/
│   │   └── ...
│   ├── components/          # Reusable components
│   ├── layouts/             # Layout components
│   ├── services/            # API services
│   │   ├── api.js          # Axios instance
│   │   └── index.js        # Service exports
│   ├── hooks/              # Custom hooks
│   │   ├── useAuth.js
│   │   ├── useCamera.js
│   │   └── useGeolocation.js
│   ├── store/              # Redux store
│   │   ├── index.js
│   │   └── authSlice.js
│   ├── routes/             # Route configuration
│   │   ├── AppRoutes.jsx
│   │   └── ProtectedRoute.jsx
│   └── utils/              # Utility functions
├── package.json
├── vite.config.js
└── index.html
```

## Coding Standards

### Python Backend

**Style Guide**: PEP 8

```python
# Good
async def get_attendance_percentage(student_id: str) -> float:
    """Get attendance percentage for a student."""
    try:
        total = await db.attendance.count_documents({"student_id": student_id})
        return (present / total) * 100
    except Exception as e:
        logger.error(f"Error: {e}")
        raise

# Bad
async def getAttendancePercentage(student_id):
    try:
        total = db.attendance.count_documents({"student_id": student_id})
        return (present / total) * 100
    except:
        pass
```

**Docstrings**: Use Google-style docstrings

```python
def calculate_similarity(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    """
    Calculate cosine similarity between two embeddings.
    
    Args:
        embedding1: First face embedding
        embedding2: Second face embedding
    
    Returns:
        Similarity score between 0 and 1
    
    Raises:
        ValueError: If embedding dimensions don't match
    """
    pass
```

### JavaScript/React Frontend

**Style Guide**: Airbnb JavaScript Style Guide

```javascript
// Good
const StudentDashboard = () => {
  const [sessions, setSessions] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleMarkAttendance = async () => {
    try {
      const result = await studentService.markAttendance(sessionId, embedding);
      setSessions(result);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return <div>{/* JSX */}</div>;
};

export default StudentDashboard;

// Bad
function studentDashboard() {
  var sessions = [];
  return (
    <div>
      {/* ... */}
    </div>
  );
}
```

## Testing Guidelines

### Backend Testing

```python
# test_auth_service.py
import pytest
from app.services.auth.auth_service import AuthService
from app.core.security import verify_password

@pytest.mark.asyncio
async def test_register_user(db):
    """Test user registration."""
    auth_service = AuthService(db)
    
    user_id = await auth_service.register_user(
        email="test@example.com",
        password="Test@123",
        first_name="Test",
        last_name="User",
        role="student"
    )
    
    assert user_id is not None
    
    # Verify user exists
    user = await auth_service.get_user(user_id)
    assert user["email"] == "test@example.com"
    assert user["first_name"] == "Test"

@pytest.mark.asyncio
async def test_authenticate_user(db):
    """Test user authentication."""
    auth_service = AuthService(db)
    
    # Register user first
    user_id = await auth_service.register_user(
        email="test@example.com",
        password="Test@123",
        first_name="Test",
        last_name="User",
        role="student"
    )
    
    # Authenticate
    user = await auth_service.authenticate_user("test@example.com", "Test@123")
    assert user is not None
    assert user["email"] == "test@example.com"
```

### Frontend Testing

```javascript
// App.test.jsx
import { render, screen } from '@testing-library/react';
import LoginPage from './pages/LoginPage';

describe('LoginPage', () => {
  test('renders login form', () => {
    render(<LoginPage />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  test('handles login submission', async () => {
    const { user } = render(<LoginPage />);
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password');
    await user.click(screen.getByRole('button', { name: /login/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/logged in/i)).toBeInTheDocument();
    });
  });
});
```

## Git Workflow

### Branch Naming Convention

```
feature/feature-name           # New feature
bugfix/bug-description         # Bug fix
hotfix/critical-issue          # Critical production fix
refactor/refactoring-scope     # Code refactoring
docs/documentation-scope       # Documentation
```

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>

Example:
feat(authentication): add JWT token validation

- Implement token expiration check
- Add refresh token mechanism
- Update auth middleware

Fixes #123
```

### Pull Request Checklist

- [ ] Branch created from latest main
- [ ] Code follows project standards
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console errors/warnings
- [ ] Performance tested
- [ ] Security review completed

## Debugging

### Backend Debugging

```python
# Using print for quick debugging
print(f"User data: {user}")

# Using logging for production
import logging
logger = logging.getLogger(__name__)
logger.debug(f"User data: {user}")
logger.info(f"User {user_id} authenticated")
logger.warning(f"Invalid attempt from {ip_address}")
logger.error(f"Database error: {error}")
```

### Frontend Debugging

```javascript
// React DevTools
// - Install React DevTools browser extension
// - Use Component profiler
// - Check component props and state

// Console logging
console.log('Data:', data);
console.error('Error:', error);

// Debugger
debugger;  // Or set breakpoint in browser

// Redux DevTools
// - Install Redux DevTools browser extension
// - Track action dispatch
// - Time-travel debug
```

## Performance Optimization

### Backend Optimization

```python
# Use async operations
async def get_sessions():
    return await db.sessions.find({}).to_list(None)

# Add caching
@cache.cached(key="active_sessions", ttl=300)
async def get_active_sessions():
    return await db.sessions.find({"status": "active"}).to_list(None)

# Use indexes
db.users.create_index([("email", 1)], unique=True)
db.attendance.create_index([("session_id", 1), ("student_id", 1)], unique=True)

# Batch operations
await db.attendance.insert_many(records)  # Not one by one
```

### Frontend Optimization

```javascript
// Code splitting
const StudentDashboard = lazy(() => import('./pages/Student/Dashboard'));

// Memoization
const StudentCard = memo(({ student }) => {
  return <div>{student.name}</div>;
});

// useCallback for expensive operations
const handleMarkAttendance = useCallback(() => {
  // expensive operation
}, [dependency]);

// Conditional rendering
{isLoading ? <Spinner /> : <Content />}

// Image optimization
<img src={image} alt="description" loading="lazy" />
```

## Security Best Practices

### Backend Security

```python
# Password hashing
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"])
hashed = pwd_context.hash(password)

# SQL Injection prevention
# Use parameterized queries (automatic with Motor/PyMongo)
db.users.find_one({"email": email})  # Parameterized

# Input validation
from pydantic import BaseModel, EmailStr
class UserCreate(BaseModel):
    email: EmailStr
    password: str

# CORS configuration
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# JWT security
from datetime import timedelta
ACCESS_TOKEN_EXPIRE_MINUTES = 30
```

### Frontend Security

```javascript
// XSS Prevention
// React escapes by default, but be careful with dangerouslySetInnerHTML
<div>{user.name}</div>  // Safe

// CSRF Protection
// Include CSRF token in requests
const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

// Secure storage
// Don't store sensitive data in localStorage
localStorage.setItem('access_token', token);  // Tokens OK
// localStorage.setItem('password', password);  // Never do this

// Content Security Policy
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline'">
```

## Documentation Standards

### Docstring Examples

```python
def verify_face(registered_embedding: np.ndarray, current_embedding: np.ndarray) -> Tuple[bool, float]:
    """
    Verify if two embeddings belong to the same person.
    
    This function uses cosine similarity to compare two face embeddings.
    The embeddings should be 512-dimensional vectors normalized to unit length.
    
    Args:
        registered_embedding: The stored face embedding (512-dim)
        current_embedding: The current face embedding to verify (512-dim)
    
    Returns:
        A tuple containing:
        - is_verified (bool): True if embeddings match above threshold
        - similarity (float): Cosine similarity score (0-1)
    
    Raises:
        ValueError: If embeddings have invalid dimensions
        TypeError: If inputs are not numpy arrays
    
    Example:
        >>> registered = np.random.rand(512)
        >>> current = np.random.rand(512)
        >>> is_match, score = verify_face(registered, current)
        >>> print(f"Match: {is_match}, Score: {score:.4f}")
        Match: False, Score: 0.1234
    
    Note:
        The similarity threshold is configurable in settings.
        Current threshold: 0.6
    """
    pass
```

## Troubleshooting Common Issues

### Import Errors

```python
# Problem: ModuleNotFoundError: No module named 'app'
# Solution: Run from correct directory
cd backend
python run.py

# Or add to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:/path/to/backend"
```

### Async Errors

```python
# Problem: "no running event loop"
# Solution: Use async functions properly
async def main():
    result = await some_async_function()

asyncio.run(main())
```

### React Hook Errors

```javascript
// Problem: "can't perform a React state update on an unmounted component"
// Solution: Cleanup effect
useEffect(() => {
  let isMounted = true;
  
  fetchData().then(data => {
    if (isMounted) {
      setData(data);
    }
  });
  
  return () => {
    isMounted = false;
  };
}, []);
```

## Resources

- FastAPI Docs: https://fastapi.tiangolo.com/
- React Docs: https://react.dev/
- MongoDB Docs: https://docs.mongodb.com/
- PEP 8: https://www.python.org/dev/peps/pep-0008/
- MDN Web Docs: https://developer.mozilla.org/

## Getting Help

1. Check existing documentation
2. Search GitHub issues
3. Ask in team discussions
4. Create detailed issue with:
   - Error message/screenshot
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
