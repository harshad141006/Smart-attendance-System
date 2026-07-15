import logging
from typing import List, Optional, Tuple

import numpy as np

from app.core.config import settings
from app.services.face_recognition.arcface_service import get_arcface_service
from app.services.face_recognition.utils import decode_base64_to_bgr

logger = logging.getLogger(__name__)


class FaceEmbeddingService:
    """ArcFace embedding service adapter used by API routes and registration logic."""

    def __init__(self) -> None:
        self.arcface = get_arcface_service()

    def preprocess_image(self, base64_image: str, strict_detection: bool = False) -> Optional[np.ndarray]:
        del strict_detection  # SCRFD detection is always enforced during embedding extraction.
        return decode_base64_to_bgr(base64_image)

    def extract_embedding_with_score(self, image_bgr: np.ndarray) -> Optional[Tuple[np.ndarray, float]]:
        result = self.arcface.extract_best_face(image_bgr)
        if not result:
            return None
        return result["embedding"], result["det_score"]

    def get_faces(self, image_bgr: np.ndarray) -> list:
        with self.arcface._lock:
            return self.arcface.app.get(image_bgr)

    def extract_embedding(self, image_bgr: np.ndarray) -> np.ndarray:
        result = self.extract_embedding_with_score(image_bgr)
        if not result:
            raise ValueError("No face detected in image")
        embedding, _ = result
        return embedding

    def extract_embedding_from_base64(self, base64_image: str) -> Optional[Tuple[np.ndarray, float]]:
        image_bgr = self.preprocess_image(base64_image)
        if image_bgr is None:
            return None
        return self.extract_embedding_with_score(image_bgr)

    def extract_batch_embeddings(self, images_bgr: List[np.ndarray]) -> np.ndarray:
        embeddings = []
        for image_bgr in images_bgr:
            result = self.extract_embedding_with_score(image_bgr)
            if result is None:
                raise ValueError("One or more images do not contain a detectable face")
            embedding, _ = result
            embeddings.append(embedding)

        return np.asarray(embeddings, dtype=np.float32)

    def verify_embedding_dimension(self, embedding: np.ndarray) -> bool:
        return len(embedding) == settings.face_embedding_dimension
