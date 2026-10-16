"""
Face Engine Service for backend_v2.
Handles InsightFace model lifecycle, face detection, landmark alignment,
and 512-D ArcFace embedding extraction on CPU.
"""

import base64
import logging
import threading
from typing import Optional, Tuple, Any
import cv2
import numpy as np
import insightface
from insightface.app import FaceAnalysis
from ..config import settings

logger = logging.getLogger("backend_v2.face_engine")

class FaceEngineError(Exception):
    def __init__(self, error_code: str, message: str):
        super().__init__(message)
        self.error_code = error_code
        self.message = message

class InsightFaceEngine:
    _instance: Optional["InsightFaceEngine"] = None
    _lock = threading.Lock()

    def __init__(self):
        self.model_name = settings.INSIGHTFACE_MODEL
        self.is_loaded = False
        self.init_error: Optional[str] = None
        self.app: Optional[FaceAnalysis] = None
        self._load_model()

    def _load_model(self):
        try:
            logger.info("Initializing InsightFace FaceAnalysis (model: %s, CPU provider)...", self.model_name)
            self.app = FaceAnalysis(name=self.model_name, providers=["CPUExecutionProvider"])
            self.app.prepare(ctx_id=0, det_size=(640, 640))
            self.is_loaded = True
            self.init_error = None
            logger.info("InsightFace FaceAnalysis engine initialized successfully.")
        except Exception as e:
            self.is_loaded = False
            self.init_error = str(e)
            logger.error("Failed to initialize InsightFace FaceAnalysis: %s", e, exc_info=True)

    @classmethod
    def get_instance(cls) -> "InsightFaceEngine":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    @staticmethod
    def decode_image(image_input: str | bytes) -> np.ndarray:
        """Decodes base64 string or bytes into a BGR numpy array."""
        try:
            if isinstance(image_input, str):
                if "," in image_input:
                    # Strip data:image/...;base64, header
                    image_input = image_input.split(",", 1)[1]
                raw_bytes = base64.b64decode(image_input)
            elif isinstance(image_input, bytes):
                raw_bytes = image_input
            else:
                raise ValueError("Unsupported image input type")

            if len(raw_bytes) == 0:
                raise FaceEngineError("INVALID_IMAGE_PAYLOAD", "Image buffer is empty")

            nparr = np.frombuffer(raw_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise FaceEngineError("IMAGE_DECODING_FAILED", "Could not decode image bytes into valid pixel array")

            h, w = img.shape[:2]
            if h < 80 or w < 80:
                raise FaceEngineError("IMAGE_TOO_SMALL", f"Image resolution ({w}x{h}) is too small for biometric analysis")
            if h > 4096 or w > 4096:
                # Downsample overly large images for CPU performance
                img = cv2.resize(img, (1280, int(1280 * h / w)))

            return img
        except FaceEngineError:
            raise
        except Exception as e:
            raise FaceEngineError("INVALID_IMAGE_PAYLOAD", f"Failed to parse image: {str(e)}")

    def extract_face_and_embedding(self, image_input: str | bytes) -> Tuple[np.ndarray, Any, list[float], float]:
        """
        Detects faces in frame and extracts a 512-D L2-normalized ArcFace embedding.
        Enforces single-face constraint and confidence threshold.
        Returns: (embedding_512, face_obj, bbox_xyxy, det_score)
        """
        if not self.is_loaded or self.app is None:
            raise FaceEngineError("MODEL_NOT_INITIALIZED", f"InsightFace model failed to load: {self.init_error}")

        img = self.decode_image(image_input)
        faces = self.app.get(img)

        if len(faces) == 0:
            raise FaceEngineError("NO_FACE_DETECTED", "No face detected in camera frame. Please position face clearly in view.")

        if len(faces) > 1:
            raise FaceEngineError("MULTIPLE_FACES", f"Multiple faces ({len(faces)}) detected in camera frame. Exactly one face allowed.")

        face = faces[0]
        det_score = float(face.det_score)
        if det_score < settings.MIN_DETECTION_CONFIDENCE:
            raise FaceEngineError("LOW_CONFIDENCE_DETECTION", f"Face detection confidence ({det_score:.2f}) below required threshold ({settings.MIN_DETECTION_CONFIDENCE:.2f}).")

        raw_emb = face.embedding
        if raw_emb is None or len(raw_emb) != 512:
            raise FaceEngineError("EMBEDDING_EXTRACTION_FAILED", "Failed to extract 512-dimensional face embedding.")

        # Ensure unit L2 normalization
        norm = np.linalg.norm(raw_emb)
        if norm == 0:
            raise FaceEngineError("ZERO_NORM_EMBEDDING", "Extracted biometric vector has zero magnitude.")
        normalized_emb = (raw_emb / norm).astype(np.float32)

        bbox = [float(c) for c in face.bbox[:4]]
        return normalized_emb, face, bbox, det_score

    @staticmethod
    def compute_cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Computes cosine similarity between two 512-D float32 vectors."""
        n1 = np.linalg.norm(emb1)
        n2 = np.linalg.norm(emb2)
        if n1 == 0 or n2 == 0:
            return 0.0
        return float(np.dot(emb1, emb2) / (n1 * n2))

    @staticmethod
    def serialize_embedding(emb: np.ndarray) -> bytes:
        """Serializes 512-D float32 array to raw 2048-byte binary blob."""
        return emb.astype(np.float32).tobytes()

    @staticmethod
    def deserialize_embedding(blob: bytes) -> np.ndarray:
        """Deserializes binary blob into 512-D float32 numpy array."""
        return np.frombuffer(blob, dtype=np.float32)
