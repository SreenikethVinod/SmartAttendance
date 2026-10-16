"""
MiniFASNetV2 Anti-Spoofing / Presentation Attack Detection Service for backend_v2.
Runs ONNX Runtime CPU inference on cropped face frames with scale 2.7.
Fails closed: errors or invalid tensors never pass liveness.
"""

import logging
import os
import threading
from typing import Optional, Tuple
import cv2
import numpy as np
import onnxruntime as ort
from ..config import settings

logger = logging.getLogger("backend_v2.liveness_engine")

class LivenessResult:
    def __init__(self, is_live: bool, score: float, attack_type: str, details: dict):
        self.is_live = is_live
        self.score = score
        self.attack_type = attack_type
        self.details = details

class MiniFASNetLivenessEngine:
    _instance: Optional["MiniFASNetLivenessEngine"] = None
    _lock = threading.Lock()

    def __init__(self):
        self.model_path = settings.MINIFASNET_MODEL_PATH
        self.is_loaded = False
        self.init_error: Optional[str] = None
        self.session: Optional[ort.InferenceSession] = None
        self.input_name: Optional[str] = None
        self.output_name: Optional[str] = None
        self._load_model()

    def _load_model(self):
        try:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"MiniFASNet model checkpoint not found at {self.model_path}")

            logger.info("Loading MiniFASNetV2 ONNX model from %s on CPU...", self.model_path)
            self.session = ort.InferenceSession(self.model_path, providers=["CPUExecutionProvider"])
            self.input_name = self.session.get_inputs()[0].name
            self.output_name = self.session.get_outputs()[0].name
            self.is_loaded = True
            self.init_error = None
            logger.info("MiniFASNetV2 anti-spoofing engine loaded successfully.")
        except Exception as e:
            self.is_loaded = False
            self.init_error = str(e)
            logger.error("Failed to load MiniFASNetV2 model: %s", e, exc_info=True)

    @classmethod
    def get_instance(cls) -> "MiniFASNetLivenessEngine":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    @staticmethod
    def _crop_face(image: np.ndarray, bbox: list[float] | np.ndarray, scale: float = 2.7) -> np.ndarray:
        """Crops face with contextual margin (scale 2.7) and resizes to 80x80."""
        src_h, src_w = image.shape[:2]
        x1, y1, x2, y2 = bbox[:4]
        box_w = x2 - x1
        box_h = y2 - y1

        s = min((src_h - 1) / box_h, (src_w - 1) / box_w, scale)
        new_w = box_w * s
        new_h = box_h * s

        cx = x1 + box_w / 2
        cy = y1 + box_h / 2

        nx1 = max(0, int(cx - new_w / 2))
        ny1 = max(0, int(cy - new_h / 2))
        nx2 = min(src_w - 1, int(cx + new_w / 2))
        ny2 = min(src_h - 1, int(cy + new_h / 2))

        cropped = image[ny1 : ny2 + 1, nx1 : nx2 + 1]
        return cv2.resize(cropped, (80, 80))

    @staticmethod
    def _softmax(x: np.ndarray) -> np.ndarray:
        e_x = np.exp(x - np.max(x, axis=1, keepdims=True))
        return e_x / e_x.sum(axis=1, keepdims=True)

    def evaluate_liveness(self, image: np.ndarray, bbox: list[float] | np.ndarray) -> LivenessResult:
        """
        Evaluates whether the detected face is a live human or presentation attack.
        Class 1 is Real. Class 0 and 2 are Presentation Attacks (Photo / Replay).
        Fails closed on any exception or uninitialized model.
        """
        if not self.is_loaded or self.session is None:
            logger.error("Liveness check failed-closed: Model not loaded (%s)", self.init_error)
            return LivenessResult(
                is_live=False,
                score=0.0,
                attack_type="LIVENESS_MODEL_UNAVAILABLE",
                details={"error": self.init_error or "Model uninitialized"}
            )

        try:
            face_crop = self._crop_face(image, bbox, scale=2.7)
            # MiniFASNet input format: NCHW float32 [0, 255]
            blob = face_crop.astype(np.float32).transpose(2, 0, 1)[np.newaxis, :]
            
            outputs = self.session.run([self.output_name], {self.input_name: blob})
            logits = outputs[0]
            probs = self._softmax(logits)
            
            pred_class = int(np.argmax(probs))
            real_score = float(probs[0, 1])
            threshold = settings.LIVENESS_THRESHOLD

            if pred_class == 1 and real_score >= threshold:
                is_live = True
                attack_type = "REAL_HUMAN"
            else:
                is_live = False
                if pred_class == 0:
                    attack_type = "PHOTO_ATTACK"
                elif pred_class == 2:
                    attack_type = "SCREEN_REPLAY"
                else:
                    attack_type = "SUSPECTED_SPOOF"

            details = {
                "predicted_class": pred_class,
                "real_score": round(real_score, 4),
                "threshold": threshold,
                "class_probs": [round(float(p), 4) for p in probs[0]]
            }
            return LivenessResult(is_live=is_live, score=real_score, attack_type=attack_type, details=details)

        except Exception as e:
            logger.error("Liveness inference threw unexpected exception: %s", e, exc_info=True)
            return LivenessResult(
                is_live=False,
                score=0.0,
                attack_type="INFERENCE_EXCEPTION",
                details={"error": str(e)}
            )
