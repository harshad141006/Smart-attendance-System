from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

from config import settings

router = APIRouter()


class VisionRequest(BaseModel):
    image: str  # base64 encoded image


@router.post("/")
async def analyze_vision(body: VisionRequest):
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                settings.PYTHON_VISION_URL,
                json={"image": body.image},
                timeout=30.0,
            )
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Python service unreachable: {str(e)}")

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Python service error: {resp.text}")

    return resp.json()
