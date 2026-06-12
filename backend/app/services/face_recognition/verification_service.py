import numpy as np
from typing import Tuple
import logging
from app.core.config import settings

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
            # Normalize embeddings
            emb1 = embedding1 / (np.linalg.norm(embedding1) + 1e-8)
            emb2 = embedding2 / (np.linalg.norm(embedding2) + 1e-8)
            
            # Calculate cosine similarity
            similarity = np.dot(emb1, emb2)
            
            logger.debug(f"Calculated similarity: {similarity:.4f}")
            return float(similarity)
        except Exception as e:
            logger.error(f"Failed to calculate similarity: {e}")
            raise

    def verify_face(self, registered_embedding: np.ndarray, current_embedding: np.ndarray) -> Tuple[bool, float]:
        """
        Verify if two embeddings belong to the same person
        
        Args:
            registered_embedding: Stored face embedding
            current_embedding: Current face embedding to verify
        
        Returns:
            Tuple of (is_verified: bool, similarity_score: float)
        """
        try:
            similarity = self.calculate_similarity(registered_embedding, current_embedding)
            is_verified = similarity >= self.threshold
            
            logger.info(f"Face verification result - Verified: {is_verified}, Similarity: {similarity:.4f}")
            return is_verified, similarity
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
