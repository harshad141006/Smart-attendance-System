from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from config import settings

security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials

    if not settings.JWT_SECRET:
        raise HTTPException(status_code=500, detail="Server configuration error")

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_roles(*allowed_roles: str):
    def dependency(user: dict = Depends(get_current_user)):
        if not user:
            raise HTTPException(status_code=401, detail="Unauthorized")
        if user.get("role") not in allowed_roles:
            raise HTTPException(status_code=403, detail="Forbidden: Insufficient permissions")
        return user
    return dependency
