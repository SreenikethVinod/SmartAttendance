"""
Pydantic schemas and request/response models for backend_v2.
Maintains exact compatibility with the React frontend TypeScript interfaces.
"""

from typing import Optional, Any
from pydantic import BaseModel, Field

# ----------------- Health -----------------
class HealthResponse(BaseModel):
    status: str
    engine: str
    model_loaded: bool
    model_name: str
    liveness_loaded: bool
    init_error: Optional[str] = None
    similarity_threshold: float
    liveness_threshold: float
    timestamp: str

# ----------------- Threshold -----------------
class ThresholdConfigResponse(BaseModel):
    similarity_threshold: float
    model_name: str
    recommended_threshold: float
    far_benchmark: str
    description: str

class ThresholdUpdateRequest(BaseModel):
    threshold: float = Field(..., ge=0.20, le=0.95)
    facultyId: Optional[str] = "faculty-admin"
    faculty_id: Optional[str] = None
    reason: Optional[str] = "Calibrated threshold update"

# ----------------- Students -----------------
class StudentCreateRequest(BaseModel):
    id: Optional[str] = None
    prn: str
    rollNo: Optional[int] = None
    roll_no: Optional[int] = None
    name: str
    email: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[str] = None
    batch: Optional[str] = None
    avatarUrl: Optional[str] = None
    avatar_url: Optional[str] = None

class StudentResponse(BaseModel):
    id: str
    prn: str
    rollNo: int
    roll_no: int
    name: str
    email: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[str] = None
    batch: Optional[str] = None
    avatarUrl: Optional[str] = None
    avatar_url: Optional[str] = None
    is_face_enrolled: bool
    isFaceEnrolled: bool
    enrolled_at: Optional[str] = None
    created_at: str

class StudentListResponse(BaseModel):
    students: list[dict[str, Any]]

# ----------------- Biometric Enrollment -----------------
class FaceEnrollRequest(BaseModel):
    prn: str
    image: str # Base64 data URL or raw base64
    consentGiven: Optional[bool] = True
    consent_given: Optional[bool] = None
    auditNote: Optional[str] = "Student camera enrollment via web client"

class FaceEnrollResponse(BaseModel):
    success: bool
    message: str
    prn: Optional[str] = None
    model: Optional[str] = None
    embedding_dim: Optional[int] = None
    quality_score: Optional[float] = None
    error_code: Optional[str] = None
    matched_prn: Optional[str] = None
    matched_name: Optional[str] = None
    similarity: Optional[float] = None

class FaceDeleteRequest(BaseModel):
    prn: str

class FaceDetectRequest(BaseModel):
    image: str

class FaceDetectResponse(BaseModel):
    success: bool
    detected: bool
    face_count: int
    det_score: Optional[float] = None
    bbox: Optional[list[float]] = None
    quality_score: Optional[float] = None
    message: str

# ----------------- Attendance Session -----------------
class SessionCreateRequest(BaseModel):
    periodNumber: int = Field(..., ge=1, le=10)
    period_number: Optional[int] = None
    subjectCode: str
    subject_code: Optional[str] = None
    subjectName: str
    subject_name: Optional[str] = None
    facultyId: str
    faculty_id: Optional[str] = None
    facultyName: str
    faculty_name: Optional[str] = None
    room: Optional[str] = "Classroom"
    date: Optional[str] = None
    durationMinutes: Optional[int] = 60

# ----------------- Attendance Verification -----------------
class FaceVerifyAttendanceRequest(BaseModel):
    prn: str
    sessionId: str
    session_id: Optional[str] = None
    periodNumber: int
    period_number: Optional[int] = None
    date: str
    image: str # Base64 captured frame
    networkSsid: Optional[str] = None
    network_ssid: Optional[str] = None
    ipAddress: Optional[str] = None
    ip_address: Optional[str] = None

class FaceVerifyAttendanceResponse(BaseModel):
    success: bool
    is_genuine: bool = False
    is_live: bool = False
    attack_type: Optional[str] = None
    liveness_score: Optional[float] = None
    message: str
    similarity: Optional[float] = None
    confidence: Optional[float] = None
    threshold: Optional[float] = None
    already_marked: bool = False
    error_code: Optional[str] = None
    record: Optional[dict[str, Any]] = None

# ----------------- Override & Audit -----------------
class AttendanceOverrideRequest(BaseModel):
    sessionId: str
    session_id: Optional[str] = None
    periodNumber: int
    period_number: Optional[int] = None
    date: str
    studentPrn: str
    student_prn: Optional[str] = None
    studentName: str
    student_name: Optional[str] = None
    newStatus: str # 'PRESENT' or 'ABSENT'
    teacherId: str
    teacher_id: Optional[str] = None
    teacherName: str
    teacher_name: Optional[str] = None
    reason: str
    customNote: Optional[str] = None
    custom_note: Optional[str] = None
