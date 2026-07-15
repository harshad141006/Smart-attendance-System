import logging
import os
import threading
from functools import lru_cache
from typing import Dict, Optional

import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis

from services.face_recognition.utils import l2_normalize

logger = logging.getLogger(__name__)

_MODEL_NAME = os.getenv("ARCFACE_MODEL_NAME", "buffalo_l")
_DET_SIZE = int(os.getenv("ARCFACE_DET_SIZE", "640"))


class ArcFaceService:
    """Singleton ArcFace + SCRFD wrapper. Loaded once; thread-safe."""

    def __init__(self) -> None:
        providers = ort.get_available_providers()
        ordered = []
        if "CUDAExecutionProvider" in providers:
            ordered.append("CUDAExecutionProvider")
        ordered.append("CPUExecutionProvider")

        self.providers = ordered
        self.ctx_id = 0 if "CUDAExecutionProvider" in ordered else -1
        self._lock = threading.Lock()

        logger.info("Loading InsightFace FaceAnalysis — model=%s providers=%s", _MODEL_NAME, ordered)
        self.app = FaceAnalysis(name=_MODEL_NAME, providers=ordered)
        self.app.prepare(ctx_id=self.ctx_id, det_size=(_DET_SIZE, _DET_SIZE))
        logger.info("ArcFace model ready")

    def get_faces(self, image_bgr: np.ndarray):
        """Return raw InsightFace face objects for the given BGR image."""
        with self._lock:
            return self.app.get(image_bgr)


@lru_cache(maxsize=1)
def get_arcface_service() -> ArcFaceService:
    return ArcFaceService()
