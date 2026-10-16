"""
Configuration module for backend_v2.
Manages environment variables, thresholds, and execution paths.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

class Settings:
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "127.0.0.1")
    
    # Isolated SQLite database path (never points to old backend db)
    DB_PATH: str = os.getenv("DB_PATH", str(BASE_DIR / "attendance_v2.db"))
    
    # Models
    INSIGHTFACE_MODEL: str = os.getenv("INSIGHTFACE_MODEL", "buffalo_s")
    MINIFASNET_MODEL_PATH: str = os.getenv("MINIFASNET_MODEL_PATH", str(BASE_DIR / "models" / "MiniFASNetV2.onnx"))
    
    # Biometric & Liveness Thresholds
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.50"))
    LIVENESS_THRESHOLD: float = float(os.getenv("LIVENESS_THRESHOLD", "0.60"))
    DUPLICATE_SIMILARITY_THRESHOLD: float = float(os.getenv("DUPLICATE_SIMILARITY_THRESHOLD", "0.50"))
    
    # Min face detection score
    MIN_DETECTION_CONFIDENCE: float = float(os.getenv("MIN_DETECTION_CONFIDENCE", "0.60"))
    
    # Allowed CORS Origins
    _raw_cors: str = os.getenv("CORS_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000,http://localhost:5173,http://127.0.0.1:5173")
    CORS_ORIGINS: list[str] = [origin.strip() for origin in _raw_cors.split(",") if origin.strip()]

settings = Settings()
