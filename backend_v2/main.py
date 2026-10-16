"""
SmartAttendance backend_v2 Main FastAPI Application.
Exposes clean REST API compatible with React frontend proxy at /api/*.
Integrates official InsightFace (buffalo_s/buffalo_l) and MiniFASNetV2 anti-spoofing on CPU.
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .config import settings
from .db import init_db, get_config_value, set_config_value
from .schemas import (
    HealthResponse,
    ThresholdConfigResponse,
    ThresholdUpdateRequest,
    StudentCreateRequest,
    StudentListResponse,
    FaceEnrollRequest,
    FaceEnrollResponse,
    FaceDeleteRequest,
    FaceDetectRequest,
    FaceDetectResponse,
    SessionCreateRequest,
    FaceVerifyAttendanceRequest,
    FaceVerifyAttendanceResponse,
    AttendanceOverrideRequest
)
from .services.face_engine import InsightFaceEngine
from .services.liveness_engine import MiniFASNetLivenessEngine
from .services.enrollment_service import EnrollmentService
from .services.session_service import SessionService
from .services.attendance_service import AttendanceService
from .services.audit_service import AuditService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("backend_v2.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB and load neural networks
    logger.info("Initializing SQLite database tables and seed data...")
    init_db()
    
    logger.info("Warming up InsightFace FaceAnalysis engine...")
    face_engine = InsightFaceEngine.get_instance()
    
    logger.info("Warming up MiniFASNetV2 Anti-Spoofing engine...")
    liveness_engine = MiniFASNetLivenessEngine.get_instance()
    
    yield
    # Shutdown logic if any
    logger.info("Shutting down backend_v2 application.")

app = FastAPI(
    title="SmartAttendance Biometric Backend v2",
    description="Deterministic face recognition and presentation-attack defense with InsightFace and MiniFASNetV2",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration for local React / Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Health Diagnostics -----------------
@app.get("/api/health", response_model=HealthResponse)
def health_check():
    face_engine = InsightFaceEngine.get_instance()
    liveness_engine = MiniFASNetLivenessEngine.get_instance()
    sim_thresh = float(get_config_value("similarity_threshold", str(settings.SIMILARITY_THRESHOLD)))
    live_thresh = float(get_config_value("liveness_threshold", str(settings.LIVENESS_THRESHOLD)))
    
    return HealthResponse(
        status="HEALTHY" if (face_engine.is_loaded and liveness_engine.is_loaded) else "DEGRADED",
        engine="InsightFace + MiniFASNetV2",
        model_loaded=face_engine.is_loaded,
        model_name=face_engine.model_name,
        liveness_loaded=liveness_engine.is_loaded,
        init_error=face_engine.init_error or liveness_engine.init_error,
        similarity_threshold=sim_thresh,
        liveness_threshold=live_thresh,
        timestamp=datetime.now(timezone.utc).isoformat()
    )

# ----------------- Threshold Configuration -----------------
@app.get("/api/config/threshold", response_model=ThresholdConfigResponse)
def get_threshold_config():
    face_engine = InsightFaceEngine.get_instance()
    thresh = float(get_config_value("similarity_threshold", str(settings.SIMILARITY_THRESHOLD)))
    return ThresholdConfigResponse(
        similarity_threshold=thresh,
        model_name=face_engine.model_name,
        recommended_threshold=0.50,
        far_benchmark="FAR < 10^-4 at threshold 0.50 for 512D ArcFace",
        description="Calibrated institutional cosine similarity decision threshold."
    )

@app.post("/api/config/threshold")
def update_threshold_config(req: ThresholdUpdateRequest):
    set_config_value("similarity_threshold", str(round(req.threshold, 4)))
    logger.info("Similarity threshold updated to %.4f by faculty %s", req.threshold, req.facultyId)
    return {
        "success": True,
        "message": f"Threshold updated to {req.threshold:.2f}",
        "threshold": req.threshold
    }

# ----------------- Student Roster Management -----------------
@app.get("/api/students", response_model=StudentListResponse)
def list_students():
    students = EnrollmentService.get_all_students()
    return StudentListResponse(students=students)

@app.post("/api/students")
def create_or_update_student(req: StudentCreateRequest):
    data = req.model_dump(exclude_unset=True)
    created = EnrollmentService.create_or_update_student(data)
    return {"success": True, "student": created}

@app.delete("/api/students/{prn}")
def delete_student(prn: str):
    success = EnrollmentService.delete_student(prn)
    if not success:
        raise HTTPException(status_code=404, detail=f"Student {prn} not found")
    return {"success": True, "message": f"Student {prn} removed from roster"}

# ----------------- Biometric Face Enrollment -----------------
@app.post("/api/students/enroll-face", response_model=FaceEnrollResponse)
def enroll_student_face(req: FaceEnrollRequest):
    consent = req.consentGiven if req.consentGiven is not None else (req.consent_given or True)
    result = EnrollmentService.enroll_face(req.prn, req.image, consent_given=consent)
    return FaceEnrollResponse(**result)

@app.post("/api/students/delete-face")
def delete_student_face(req: FaceDeleteRequest):
    success = EnrollmentService.delete_face(req.prn)
    return {"success": success, "message": f"Face template for {req.prn} deleted"}

# ----------------- Real-time InsightFace Face Detection -----------------
@app.post("/api/face/detect", response_model=FaceDetectResponse)
def detect_face(req: FaceDetectRequest):
    face_engine = InsightFaceEngine.get_instance()
    try:
        img = face_engine.decode_image(req.image)
        faces = face_engine.app.get(img)
        if len(faces) == 0:
            return FaceDetectResponse(
                success=True,
                detected=False,
                face_count=0,
                message="No face detected in frame",
                quality_score=0.0
            )
        face = faces[0]
        det_score = float(face.det_score)
        bbox = [float(c) for c in face.bbox[:4]]
        return FaceDetectResponse(
            success=True,
            detected=True,
            face_count=len(faces),
            det_score=det_score,
            bbox=bbox,
            quality_score=round(det_score * 100, 1),
            message=f"InsightFace detected face ({det_score:.0%})" if len(faces) == 1 else f"Multiple faces ({len(faces)}) detected"
        )
    except Exception as e:
        return FaceDetectResponse(
            success=False,
            detected=False,
            face_count=0,
            message=str(e),
            quality_score=0.0
        )

# ----------------- Attendance Sessions -----------------
@app.post("/api/attendance/session")
def create_session(req: SessionCreateRequest):
    data = req.model_dump(exclude_unset=True)
    session = SessionService.create_session(data)
    return session

@app.get("/api/attendance/session/{session_id}")
def get_session(session_id: str):
    session = SessionService.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found")
    return session

# ----------------- Attendance Verification -----------------
@app.post("/api/attendance/verify", response_model=FaceVerifyAttendanceResponse)
def verify_attendance(req: FaceVerifyAttendanceRequest):
    data = req.model_dump(exclude_unset=True)
    result = AttendanceService.verify_and_mark_attendance(data)
    return FaceVerifyAttendanceResponse(**result)

@app.get("/api/attendance/records")
def list_attendance_records(
    sessionId: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None),
    date: Optional[str] = Query(None)
):
    sid = sessionId or session_id
    records = AttendanceService.get_records(session_id=sid, date_str=date)
    return {"records": records}

# ----------------- Faculty Override & Audit -----------------
@app.post("/api/attendance/override")
def submit_attendance_override(req: AttendanceOverrideRequest):
    data = req.model_dump(exclude_unset=True)
    success = AuditService.submit_faculty_override(data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to record faculty override")
    return {"success": True, "message": "Attendance record updated with faculty audit note"}

@app.get("/api/audit/logs")
def list_audit_logs():
    logs = AuditService.get_audit_logs()
    return {"logs": logs}

# ----------------- Client Real IP Detection -----------------
@app.get("/api/real-ip")
def get_real_ip(request: Request):
    forwarded = request.headers.get("x-forwarded-for")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "127.0.0.1")
    return {
        "ip": client_ip,
        "headers": {
            "x-forwarded-for": forwarded,
        },
        "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)
    }

# ----------------- Frontend Production Build Serving -----------------
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

@app.get("/{full_path:path}")
def serve_frontend_spa(full_path: str):
    # Strict API isolation: NEVER serve HTML on /api routes
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail="API route not found")

    # Security rule: NEVER serve dotfiles, sqlite databases, python files, or models
    filename = Path(full_path).name.lower()
    if filename.startswith(".") or filename.endswith((".db", ".py", ".onnx", ".pth", ".log", ".jsonl", ".env")):
        raise HTTPException(status_code=404, detail="Resource not found")

    if FRONTEND_DIST.exists():
        # Check if requesting a direct static file from dist root (e.g. metadata.json, favicon.ico)
        target_file = (FRONTEND_DIST / full_path).resolve()
        # Security check: prevent directory traversal and protect sensitive files
        if str(target_file).startswith(str(FRONTEND_DIST.resolve())) and target_file.is_file():
            if not target_file.name.startswith("."):
                return FileResponse(target_file)
        
        # Fallback to index.html for client-side routing
        index_file = FRONTEND_DIST / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)

    raise HTTPException(
        status_code=404,
        detail="Frontend production build not found. Run 'npm run build' inside frontend/ to generate assets."
    )
