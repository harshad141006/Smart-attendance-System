import numpy as np
from typing import Optional
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase as AsyncDatabase
from bson import ObjectId
from app.services.face_recognition.embedding_service import FaceEmbeddingService
from app.core.config import settings
from datetime import datetime

logger = logging.getLogger(__name__)


class FaceRegistrationService:
    """Service for registering and managing face embeddings"""

    def __init__(self, db: AsyncDatabase, embedding_service: FaceEmbeddingService):
        self.db = db
        self.embedding_service = embedding_service

    async def register_student_face(self, student_id: str, embedding: np.ndarray, confidence_score: float, image_metadata: Optional[dict] = None) -> str:
        """
        Register a student's face embedding
        
        Args:
            student_id: Student ID
            embedding: Face embedding (512-dimensional)
            confidence_score: Confidence score of face detection
            image_metadata: Optional metadata about the image (without storing raw image)
        
        Returns:
            ID of the registered embedding
        """
        try:
            # Verify embedding dimension
            if not self.embedding_service.verify_embedding_dimension(embedding):
                raise ValueError(f"Invalid embedding dimension. Expected {settings.face_embedding_dimension}, got {len(embedding)}")
            
            # Prepare document
            face_embedding_doc = {
                "student_id": student_id,
                "embedding": embedding.tolist(),  # Convert numpy array to list for MongoDB
                "image_metadata": image_metadata or {},
                "confidence_score": float(confidence_score),
                "registered_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            # Insert into database
            result = await self.db["face_embeddings"].insert_one(face_embedding_doc)
            embedding_id = str(result.inserted_id)
            
            logger.info(f"Registered face for student {student_id} with embedding ID {embedding_id}")
            return embedding_id
        except Exception as e:
            logger.error(f"Failed to register face: {e}")
            raise

    async def get_student_embeddings(self, student_id: str) -> list:
        """Get all registered embeddings for a student"""
        try:
            embeddings = await self.db["face_embeddings"].find({"student_id": student_id}).to_list(None)
            logger.debug(f"Retrieved {len(embeddings)} embeddings for student {student_id}")
            return embeddings
        except Exception as e:
            logger.error(f"Failed to get student embeddings: {e}")
            raise

    async def get_latest_embedding(self, student_id: str) -> Optional[dict]:
        """Get the latest registered embedding for a student (utilizing Redis cache)"""
        try:
            from app.cache.redis_cache import cache
            from app.services.attendance.attendance_service import serialize_mongo_doc, deserialize_mongo_doc
            
            cached_emb = await cache.get(f"student:embeddings:{student_id}")
            if cached_emb is not None:
                logger.debug(f"Student embedding {student_id} retrieved from Redis cache")
                return deserialize_mongo_doc(cached_emb)

            embedding = await self.db["face_embeddings"].find_one(
                {"student_id": student_id},
                sort=[("registered_at", -1)]
            )
            if embedding:
                await cache.set(
                    f"student:embeddings:{student_id}", 
                    serialize_mongo_doc(embedding),
                    expiry=3600
                )
            return embedding
        except Exception as e:
            logger.error(f"Failed to get latest embedding: {e}")
            raise

    async def update_embedding(self, embedding_id: str, embedding: np.ndarray, confidence_score: float) -> bool:
        """Update an existing embedding"""
        try:
            from app.cache.redis_cache import cache
            db_emb = await self.db["face_embeddings"].find_one({"_id": ObjectId(embedding_id)})
            
            result = await self.db["face_embeddings"].update_one(
                {"_id": ObjectId(embedding_id)},
                {
                    "$set": {
                        "embedding": embedding.tolist(),
                        "confidence_score": float(confidence_score),
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count > 0 and db_emb:
                # Invalidate student cache
                await cache.delete(f"student:embeddings:{db_emb['student_id']}")
                
            logger.info(f"Updated embedding {embedding_id}")
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to update embedding: {e}")
            raise

    async def delete_embedding(self, embedding_id: str) -> bool:
        """Delete an embedding"""
        try:
            from app.cache.redis_cache import cache
            db_emb = await self.db["face_embeddings"].find_one({"_id": ObjectId(embedding_id)})
            
            result = await self.db["face_embeddings"].delete_one({"_id": ObjectId(embedding_id)})
            
            if result.deleted_count > 0 and db_emb:
                # Invalidate student cache
                await cache.delete(f"student:embeddings:{db_emb['student_id']}")
                
            logger.info(f"Deleted embedding {embedding_id}")
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Failed to delete embedding: {e}")
            raise

    async def embedding_exists(self, student_id: str) -> bool:
        """Check if a student has registered face"""
        try:
            emb = await self.get_latest_embedding(student_id)
            return emb is not None
        except Exception as e:
            logger.error(f"Failed to check embedding existence: {e}")
            raise
