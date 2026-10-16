"""
Attendance Verification and Records Service for backend_v2.
Enforces strict multi-stage verification:
  1. Active session validation and expiration check
  2. Student identity & biometric enrollment check
  3. Duplicate attendance prevention (DB-level unique constraint)
  4. Presentation-Attack / Liveness detection (MiniFASNetV2)
  5. 1:1 ArcFace 512-D deep biometric comparison (InsightFace)
  6. Final attendance commit to SQLite
"""

import logging
import uuid
import sqlite3
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import numpy as np
from ..db import get_connection, get_config_value
from ..config import settings
from .face_engine import InsightFaceEngine, FaceEngineError
from .liveness_engine import MiniFASNetLivenessEngine
from .session_service import SessionService
from .enrollment_service import EnrollmentService

logger = logging.getLogger("backend_v2.attendance_service")

class AttendanceService:
    @staticmethod
    def verify_and_mark_attendance(params: Dict[str, Any]) -> Dict[str, Any]:
        prn = params["prn"].strip().upper()
        session_id = params.get("sessionId") or params.get("session_id")
        period_number = params.get("periodNumber") or params.get("period_number") or 1
        date_str = params.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        image_base64 = params["image"]
        network_ssid = params.get("networkSsid") or params.get("network_ssid")
        ip_address = params.get("ipAddress") or params.get("ip_address")
        
        # 1. Active Session Validation
        session = SessionService.get_session(session_id)
        if not session:
            # Fall back to default period session if provided session_id was a placeholder
            session = SessionService.get_or_create_default_session(period_number, date_str)
            session_id = session["id"]

        if not session["is_active"]:
            logger.warning("Attendance attempt on expired/inactive session %s by %s", session_id, prn)
            return {
                "success": False,
                "is_genuine": False,
                "is_live": False,
                "error_code": "SESSION_EXPIRED",
                "message": "Attendance session has ended or is inactive. Marking closed."
            }

        # 2. Student Enrollment Check
        student = EnrollmentService.get_student_by_prn(prn)
        if not student:
            return {
                "success": False,
                "is_genuine": False,
                "is_live": False,
                "error_code": "STUDENT_NOT_FOUND",
                "message": f"Student with PRN {prn} is not registered in the institutional roster."
            }

        enrolled_emb = EnrollmentService.get_enrolled_embedding(prn)
        if enrolled_emb is None:
            return {
                "success": False,
                "is_genuine": False,
                "is_live": False,
                "error_code": "NOT_ENROLLED",
                "message": f"Biometric template missing for PRN {prn}. Please complete face enrollment first."
            }

        # 3. Face Detection & Image Validation (InsightFace)
        face_engine = InsightFaceEngine.get_instance()
        try:
            img = face_engine.decode_image(image_base64)
            candidate_emb, face, bbox, det_score = face_engine.extract_face_and_embedding(image_base64)
        except FaceEngineError as fee:
            logger.warning("Face analysis rejected for %s: %s (%s)", prn, fee.message, fee.error_code)
            return {
                "success": False,
                "is_genuine": False,
                "is_live": False,
                "error_code": fee.error_code,
                "message": fee.message
            }

        # 4. Anti-Spoofing / Presentation Attack Detection (MiniFASNetV2)
        liveness_engine = MiniFASNetLivenessEngine.get_instance()
        liveness = liveness_engine.evaluate_liveness(img, bbox)
        
        if not liveness.is_live:
            logger.warning("Anti-spoofing alert for PRN %s: Attack Type: %s, Score: %.4f",
                           prn, liveness.attack_type, liveness.score)
            return {
                "success": False,
                "is_genuine": False,
                "is_live": False,
                "attack_type": liveness.attack_type,
                "liveness_score": round(liveness.score, 4),
                "error_code": "SPOOF_ATTACK_DETECTED",
                "message": f"Presentation attack detected ({liveness.attack_type}). Attendance verification blocked."
            }

        # 5. Biometric Identity Verification (InsightFace ArcFace 512-D Cosine Match)
        similarity = face_engine.compute_cosine_similarity(candidate_emb, enrolled_emb)
        configured_threshold = float(get_config_value("similarity_threshold", str(settings.SIMILARITY_THRESHOLD)))
        confidence = round(max(0.0, min(100.0, similarity * 100)), 2)

        if similarity < configured_threshold:
            logger.warning("Biometric mismatch for %s: similarity %.4f < threshold %.4f", prn, similarity, configured_threshold)
            return {
                "success": False,
                "is_genuine": False,
                "is_live": True,
                "similarity": round(similarity, 4),
                "confidence": confidence,
                "threshold": configured_threshold,
                "error_code": "FACE_MISMATCH",
                "message": f"Face does not match registered biometric profile (Cosine similarity: {similarity:.2f} < {configured_threshold:.2f})."
            }

        # 6. Database Attendance Check & Commit
        now_iso = datetime.now(timezone.utc).isoformat()
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT id, status, timestamp, similarity_score, liveness_score
            FROM attendance_records
            WHERE session_id = ? AND UPPER(student_prn) = UPPER(?)
            """, (session_id, prn))
            existing_record = cursor.fetchone()
            if existing_record:
                logger.info("Student %s already marked for session %s (status: %s). Updating with fresh InsightFace verification.", prn, session_id, existing_record["status"])
                cursor.execute("""
                UPDATE attendance_records
                SET timestamp = ?, similarity_score = ?, liveness_score = ?, verification_method = 'FACIAL_INSIGHTFACE'
                WHERE id = ?
                """, (now_iso, similarity, liveness.score, existing_record["id"]))
                conn.commit()

                return {
                    "success": True,
                    "is_genuine": True,
                    "is_live": True,
                    "already_marked": True,
                    "similarity": round(similarity, 4),
                    "confidence": confidence,
                    "threshold": configured_threshold,
                    "liveness_score": round(liveness.score, 4),
                    "message": f"Attendance is already recorded as {existing_record['status']} for this period (Re-verified with InsightFace ArcFace 512-D).",
                    "record": {
                        "id": existing_record["id"],
                        "sessionId": session_id,
                        "periodNumber": period_number,
                        "date": date_str,
                        "studentPrn": prn,
                        "studentName": student["name"],
                        "status": existing_record["status"],
                        "verificationMethod": "FACIAL_INSIGHTFACE",
                        "similarityScore": round(similarity, 4),
                        "livenessScore": round(liveness.score, 4),
                        "timestamp": now_iso
                    }
                }

            # 7. Commit New Record as PRESENT
            record_id = f"att_{uuid.uuid4().hex[:8]}"
            cursor.execute("""
            INSERT INTO attendance_records (
                id, session_id, period_number, date, student_prn, student_name, status,
                verification_method, similarity_score, liveness_score, threshold_used,
                network_ssid, ip_address, notes, timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?, 'PRESENT', 'FACIAL_INSIGHTFACE', ?, ?, ?, ?, ?, ?, ?)
            """, (
                record_id, session_id, period_number, date_str, prn, student["name"],
                similarity, liveness.score, configured_threshold, network_ssid, ip_address,
                "Verified via InsightFace 512D + MiniFASNetV2", now_iso
            ))
            conn.commit()
            logger.info("Successfully marked attendance PRESENT for %s in session %s (Similarity: %.2f, Liveness: %.2f)",
                        prn, session_id, similarity, liveness.score)
            
            record_dict = {
                "id": record_id,
                "sessionId": session_id,
                "periodNumber": period_number,
                "date": date_str,
                "studentPrn": prn,
                "studentName": student["name"],
                "status": "PRESENT",
                "verificationMethod": "FACIAL_INSIGHTFACE",
                "similarityScore": round(similarity, 4),
                "livenessScore": round(liveness.score, 4),
                "thresholdUsed": configured_threshold,
                "networkSsid": network_ssid,
                "ipAddress": ip_address,
                "timestamp": now_iso
            }

            return {
                "success": True,
                "is_genuine": True,
                "is_live": True,
                "similarity": round(similarity, 4),
                "confidence": confidence,
                "threshold": configured_threshold,
                "liveness_score": round(liveness.score, 4),
                "already_marked": False,
                "message": f"Identity verified successfully for {student['name']}. Attendance recorded.",
                "record": record_dict
            }
        except sqlite3.IntegrityError as ie:
            conn.rollback()
            logger.warning("Integrity error on attendance commit (likely duplicate): %s", ie)
            return {
                "success": True,
                "already_marked": True,
                "is_genuine": True,
                "is_live": True,
                "message": "Attendance record already committed for this session."
            }
        except Exception as e:
            conn.rollback()
            logger.error("Database failure while committing attendance record: %s", e, exc_info=True)
            return {
                "success": False,
                "error_code": "DATABASE_ERROR",
                "message": f"Failed to record attendance: {str(e)}"
            }
        finally:
            conn.close()

    @staticmethod
    def get_records(session_id: Optional[str] = None, date_str: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            query = """
            SELECT id, session_id, period_number, date, student_prn, student_name,
                   status, verification_method, similarity_score, liveness_score,
                   threshold_used, network_ssid, ip_address, notes, timestamp
            FROM attendance_records
            WHERE 1=1
            """
            params = []
            if session_id:
                query += " AND session_id = ?"
                params.append(session_id)
            if date_str:
                query += " AND date = ?"
                params.append(date_str)
            query += " ORDER BY timestamp DESC"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            records = []
            for r in rows:
                records.append({
                    "id": r["id"],
                    "sessionId": r["session_id"],
                    "session_id": r["session_id"],
                    "periodNumber": r["period_number"],
                    "period_number": r["period_number"],
                    "date": r["date"],
                    "studentPrn": r["student_prn"],
                    "student_prn": r["student_prn"],
                    "studentName": r["student_name"],
                    "student_name": r["student_name"],
                    "status": r["status"],
                    "verificationMethod": r["verification_method"],
                    "similarityScore": r["similarity_score"],
                    "livenessScore": r["liveness_score"],
                    "thresholdUsed": r["threshold_used"],
                    "networkSsid": r["network_ssid"],
                    "ipAddress": r["ip_address"],
                    "notes": r["notes"],
                    "timestamp": r["timestamp"]
                })
            return records
        finally:
            conn.close()
