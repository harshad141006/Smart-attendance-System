import logging
import threading
from functools import lru_cache
from typing import Dict, Optional

import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis

from app.core.config import settings
from app.services.face_recognition.utils import l2_normalize

logger = logging.getLogger(__name__)


class ArcFaceService:
    """Singleton-style ArcFace + SCRFD service wrapper."""

    def __init__(self) -> None:
        providers = ort.get_available_providers()
        ordered = []
        if "CUDAExecutionProvider" in providers:
            ordered.append("CUDAExecutionProvider")
        ordered.append("CPUExecutionProvider")

        self.providers = ordered
        self.ctx_id = 0 if "CUDAExecutionProvider" in ordered else -1
        self._lock = threading.Lock()

        logger.info(
            "Initializing InsightFace FaceAnalysis with providers=%s model=%s",
            self.providers,
            settings.arcface_model_name,
        )

        self.app = FaceAnalysis(name=settings.arcface_model_name, providers=self.providers)
        self.app.prepare(ctx_id=self.ctx_id, det_size=(settings.arcface_det_size, settings.arcface_det_size))

    def extract_best_face(self, image_bgr: np.ndarray) -> Optional[Dict[str, object]]:
        """Detect faces via SCRFD and return normalized ArcFace embedding for best face."""
        with self._lock:
            faces = self.app.get(image_bgr)

        if not faces:
            return None

        best = max(
            faces,
            key=lambda f: float((f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]) * max(float(f.det_score), 0.1)),
        )

        embedding = np.asarray(best.embedding, dtype=np.float32)
        embedding = l2_normalize(embedding)

        return {
            "embedding": embedding,
            "det_score": float(best.det_score),
            "bbox": [float(x) for x in best.bbox],
        }


@lru_cache(maxsize=1)
def get_arcface_service() -> ArcFaceService:
    return ArcFaceService()
