import base64
from io import BytesIO
from typing import Optional

import cv2
import numpy as np
from PIL import Image


def decode_base64_to_bgr(base64_image: str) -> Optional[np.ndarray]:
    """Decode a base64 image payload (with or without data-URI prefix) into a BGR ndarray."""
    try:
        if "," in base64_image:
            base64_image = base64_image.split(",", 1)[1]
        image_bytes = base64.b64decode(base64_image)
        image_pil = Image.open(BytesIO(image_bytes)).convert("RGB")
        rgb = np.array(image_pil)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:
        return None


def l2_normalize(vector: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vector) + 1e-8
    return vector / norm


def cosine_similarity(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    e1 = l2_normalize(embedding1.astype(np.float32))
    e2 = l2_normalize(embedding2.astype(np.float32))
    return float(np.dot(e1, e2))
