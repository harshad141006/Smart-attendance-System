import torch
import torch.nn.functional as F
import timm
import numpy as np
import base64
import cv2
import logging
from io import BytesIO
from PIL import Image
import torchvision.transforms as transforms
from typing import List, Tuple, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class FaceEmbeddingService:
    """Service for generating face embeddings using ViT model"""

    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.use_mock = False
        self._load_model()

    def _load_model(self):
        """Load the pre-trained ViT model"""
        try:
            logger.info(f"Loading face embedding model on {self.device}")
            self.model = timm.create_model(
                settings.face_detection_model,
                pretrained=True
            ).eval()
            self.model = self.model.to(self.device)
            logger.info("Face embedding model loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load face embedding model from HF Hub: {e}. Falling back to mock embeddings for offline testing.")
            self.use_mock = True

    def preprocess_image(self, base64_image: str, strict_detection: bool = False) -> Optional[torch.Tensor]:
        """
        Decode base64 image, detect/crop face, and preprocess into a normalized PyTorch tensor.
        """
        try:
            # Remove base64 header if present
            if "," in base64_image:
                base64_image = base64_image.split(",")[1]
            
            image_bytes = base64.b64decode(base64_image)
            image_pil = Image.open(BytesIO(image_bytes)).convert("RGB")
            
            # Convert to OpenCV image to run face detection
            image_np = np.array(image_pil)
            image_cv = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
            
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
            
            gray = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            
            if len(faces) == 0:
                # Try profile face
                faces = profile_cascade.detectMultiScale(gray, 1.1, 4)
                if len(faces) == 0:
                    # Try flipped profile face (for the other side)
                    flipped_gray = cv2.flip(gray, 1)
                    faces_flipped = profile_cascade.detectMultiScale(flipped_gray, 1.1, 4)
                    if len(faces_flipped) > 0:
                        faces = []
                        w_img = gray.shape[1]
                        for (x, y, w, h) in faces_flipped:
                            faces.append((w_img - x - w, y, w, h))
            
            if len(faces) > 0:
                # Crop the largest face
                # Convert to list to handle numpy array from detectMultiScale safely
                faces_list = [f[:4] for f in faces]
                best = max(faces_list, key=lambda f: f[2] * f[3])
                x, y, w, h = int(best[0]), int(best[1]), int(best[2]), int(best[3])
                face_crop = image_np[y:y+h, x:x+w]
                image_pil = Image.fromarray(face_crop)
                logger.info("Face detected and cropped successfully on backend")
            else:
                if strict_detection:
                    # Fallback to center crop if user was guided by the UI oval
                    logger.info("No face detected by OpenCV. Falling back to center crop based on UI oval.")
                    h_img, w_img = image_np.shape[:2]
                    # The oval in UI is 60% width and 75% height, centered
                    crop_w = int(w_img * 0.6)
                    crop_h = int(h_img * 0.75)
                    crop_x = int((w_img - crop_w) / 2)
                    crop_y = int((h_img - crop_h) / 2)
                    
                    face_crop = image_np[crop_y:crop_y+crop_h, crop_x:crop_x+crop_w]
                    image_pil = Image.fromarray(face_crop)
                else:
                    # If face detection fails, assume client sent pre-cropped image
                    logger.info("No face detected by OpenCV. Falling back to resizing original image.")
            
            # Resize and normalize
            transform = transforms.Compose([
                transforms.Resize((112, 112)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
            ])
            
            face_tensor = transform(image_pil).unsqueeze(0)  # Shape (1, 3, 112, 112)
            return face_tensor
        except Exception as e:
            logger.error(f"Image preprocessing failed: {e}")
            return None

    def extract_embedding(self, face_tensor: torch.Tensor) -> np.ndarray:
        """
        Extract embedding from face tensor
        
        Args:
            face_tensor: Input face tensor (should be preprocessed)
        
        Returns:
            512-dimensional normalized embedding
        """
        try:
            if self.use_mock:
                # Return dummy L2 normalized 512-dim embedding for testing
                # For reproducibility, we can seed or just return a deterministic embedding,
                # but random is fine.
                mock_emb = np.random.normal(0, 1, settings.face_embedding_dimension)
                mock_emb = mock_emb / (np.linalg.norm(mock_emb) + 1e-8)
                return mock_emb

            with torch.no_grad():
                face_tensor = face_tensor.to(self.device)
                # Generate embedding
                embeddings = self.model(face_tensor)
                # Normalize embeddings
                embeddings = F.normalize(embeddings, dim=1)
                # Convert to numpy
                embedding = embeddings.cpu().numpy()[0]
            
            logger.debug(f"Extracted embedding of shape {embedding.shape}")
            return embedding
        except Exception as e:
            logger.error(f"Failed to extract embedding: {e}")
            raise

    def extract_batch_embeddings(self, face_tensors: torch.Tensor) -> np.ndarray:
        """
        Extract embeddings from multiple face tensors
        
        Args:
            face_tensors: Batch of face tensors
        
        Returns:
            Batch of 512-dimensional normalized embeddings
        """
        try:
            if self.use_mock:
                batch_size = face_tensors.shape[0]
                mock_embs = np.random.normal(0, 1, (batch_size, settings.face_embedding_dimension))
                norms = np.linalg.norm(mock_embs, axis=1, keepdims=True) + 1e-8
                return mock_embs / norms

            with torch.no_grad():
                face_tensors = face_tensors.to(self.device)
                embeddings = self.model(face_tensors)
                embeddings = F.normalize(embeddings, dim=1)
                embeddings = embeddings.cpu().numpy()
            
            logger.debug(f"Extracted batch embeddings of shape {embeddings.shape}")
            return embeddings
        except Exception as e:
            logger.error(f"Failed to extract batch embeddings: {e}")
            raise

    def verify_embedding_dimension(self, embedding: np.ndarray) -> bool:
        """Verify that embedding has correct dimension"""
        return len(embedding) == settings.face_embedding_dimension

