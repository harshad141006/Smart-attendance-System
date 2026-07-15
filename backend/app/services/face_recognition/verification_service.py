import numpy as np
from typing import Tuple
import logging
from app.core.config import settings
from app.services.face_recognition.utils import cosine_similarity, similarity_to_confidence

logger = logging.getLogger(__name__)


class FaceVerificationService:
    """Service for verifying faces using cosine similarity"""

    def __init__(self, threshold: float = settings.face_similarity_threshold):
        self.threshold = threshold
        logger.info(f"FaceVerificationService initialized with threshold: {threshold}")

    def calculate_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """
        Calculate cosine similarity between two embeddings
        
        Args:
            embedding1: First face embedding
            embedding2: Second face embedding
        
        Returns:
            Similarity score between 0 and 1
        """
        try:
            similarity = cosine_similarity(embedding1, embedding2)
            
            logger.debug(f"Calculated similarity: {similarity:.4f}")
            return float(similarity)
        except Exception as e:
            logger.error(f"Failed to calculate similarity: {e}")
            raise

    def verify_face(self, registered_embeddings: list, current_embedding: np.ndarray) -> Tuple[bool, float, float]:
        """
        Verify if current embedding matches any of the stored embeddings (1:N)
        
        Args:
            registered_embeddings: List of stored face embeddings (or a single embedding for backwards compatibility)
            current_embedding: Current face embedding to verify
        
        Returns:
            Tuple of (is_verified: bool, max_similarity_score: float, max_confidence: float)
        """
        try:
            if not isinstance(registered_embeddings, list):
                # Backwards compatibility for single embedding
                registered_embeddings = [registered_embeddings]
                
            max_sim = -1.0
            
            for reg_emb in registered_embeddings:
                # Ensure it's a numpy array
                if not isinstance(reg_emb, np.ndarray):
                    reg_emb = np.array(reg_emb, dtype=np.float32)
                    
                similarity = self.calculate_similarity(reg_emb, current_embedding)
                if similarity > max_sim:
                    max_sim = similarity
                    
            is_verified = max_sim >= self.threshold
            confidence = similarity_to_confidence(max_sim, self.threshold)
            
            logger.info(
                "Face verification result - Verified: %s, Max Similarity: %.4f, Max Confidence: %.4f",
                is_verified,
                max_sim,
                confidence,
            )
            return is_verified, max_sim, confidence
        except Exception as e:
            logger.error(f"Failed to verify face: {e}")
            raise

    def find_best_match(self, query_embedding: np.ndarray, stored_embeddings: list) -> Tuple[int, float]:
        """
        Find best matching embedding from a list
        
        Args:
            query_embedding: Query face embedding
            stored_embeddings: List of stored embeddings
        
        Returns:
            Tuple of (best_match_index, best_similarity_score)
        """
        try:
            best_similarity = -1
            best_index = -1
            
            for idx, stored_emb in enumerate(stored_embeddings):
                similarity = self.calculate_similarity(query_embedding, stored_emb)
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_index = idx
            
            logger.debug(f"Best match found at index {best_index} with similarity {best_similarity:.4f}")
            return best_index, best_similarity
        except Exception as e:
            logger.error(f"Failed to find best match: {e}")
            raise

    def set_threshold(self, threshold: float):
        """Update similarity threshold"""
        if 0 <= threshold <= 1:
            self.threshold = threshold
            logger.info(f"Threshold updated to {threshold}")
        else:
            raise ValueError("Threshold must be between 0 and 1")
