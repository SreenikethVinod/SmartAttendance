"""
Student and Biometric Enrollment Service for backend_v2.
Handles student persistence, biometric template storage in SQLite,
and cross-database duplicate face identity prevention.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any, List
import numpy as np
from ..db import get_connection
from ..config import settings
from .face_engine import InsightFaceEngine, FaceEngineError

logger = logging.getLogger("backend_v2.enrollment_service")

class EnrollmentService:
    @staticmethod
    def get_all_students() -> List[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT id, prn, roll_no, name, email, department, semester, batch, avatar_url,
                   is_face_enrolled, enrolled_at, created_at
            FROM students
            ORDER BY roll_no ASC, prn ASC
            """)
            rows = cursor.fetchall()
            students = []
            for r in rows:
                is_enrolled = bool(r["is_face_enrolled"])
                students.append({
                    "id": r["id"],
                    "prn": r["prn"],
                    "rollNo": r["roll_no"],
                    "roll_no": r["roll_no"],
                    "name": r["name"],
                    "email": r["email"],
                    "department": r["department"],
                    "semester": r["semester"],
                    "batch": r["batch"],
                    "avatarUrl": r["avatar_url"],
                    "avatar_url": r["avatar_url"],
                    "is_face_enrolled": is_enrolled,
                    "isFaceEnrolled": is_enrolled,
                    "enrolled_at": r["enrolled_at"],
                    "created_at": r["created_at"]
                })
            return students
        finally:
            conn.close()

    @staticmethod
    def get_student_by_prn(prn: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT id, prn, roll_no, name, email, department, semester, batch, avatar_url,
                   is_face_enrolled, enrolled_at, created_at
            FROM students
            WHERE UPPER(prn) = UPPER(?)
            """, (prn.strip(),))
            r = cursor.fetchone()
            if not r:
                return None
            is_enrolled = bool(r["is_face_enrolled"])
            return {
                "id": r["id"],
                "prn": r["prn"],
                "rollNo": r["roll_no"],
                "roll_no": r["roll_no"],
                "name": r["name"],
                "email": r["email"],
                "department": r["department"],
                "semester": r["semester"],
                "batch": r["batch"],
                "avatarUrl": r["avatar_url"],
                "avatar_url": r["avatar_url"],
                "is_face_enrolled": is_enrolled,
                "isFaceEnrolled": is_enrolled,
                "enrolled_at": r["enrolled_at"],
                "created_at": r["created_at"]
            }
        finally:
            conn.close()

    @staticmethod
    def create_or_update_student(student_data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            prn = student_data["prn"].strip().upper()
            roll_no = student_data.get("rollNo") or student_data.get("roll_no") or 99
            name = student_data["name"].strip()
            email = student_data.get("email")
            department = student_data.get("department", "Computer Science")
            semester = student_data.get("semester", "Sem 4")
            batch = student_data.get("batch", "Batch A")
            avatar_url = student_data.get("avatarUrl") or student_data.get("avatar_url")
            
            existing = EnrollmentService.get_student_by_prn(prn)
            now_iso = datetime.now(timezone.utc).isoformat()
            
            if existing:
                cursor.execute("""
                UPDATE students
                SET roll_no = ?, name = ?, email = ?, department = ?, semester = ?, batch = ?, avatar_url = ?
                WHERE UPPER(prn) = UPPER(?)
                """, (roll_no, name, email, department, semester, batch, avatar_url, prn))
                student_id = existing["id"]
            else:
                student_id = student_data.get("id") or f"std_{uuid.uuid4().hex[:8]}"
                cursor.execute("""
                INSERT INTO students (id, prn, roll_no, name, email, department, semester, batch, avatar_url, is_face_enrolled, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                """, (student_id, prn, roll_no, name, email, department, semester, batch, avatar_url, now_iso))
            
            conn.commit()
            return EnrollmentService.get_student_by_prn(prn) # type: ignore
        finally:
            conn.close()

    @staticmethod
    def delete_student(prn: str) -> bool:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            prn_upper = prn.strip().upper()
            cursor.execute("DELETE FROM students WHERE UPPER(prn) = UPPER(?)", (prn_upper,))
            deleted = cursor.rowcount > 0
            conn.commit()
            return deleted
        finally:
            conn.close()

    @staticmethod
    def check_duplicate_face(candidate_emb: np.ndarray, exclude_prn: str) -> Optional[Dict[str, Any]]:
        """
        Scans all stored student biometrics in SQLite to detect whether the face
        already belongs to another registered individual.
        """
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT b.student_prn, b.embedding, s.name
            FROM biometrics b
            JOIN students s ON UPPER(b.student_prn) = UPPER(s.prn)
            WHERE UPPER(b.student_prn) != UPPER(?)
            """, (exclude_prn.strip(),))
            rows = cursor.fetchall()
            
            threshold = float(settings.DUPLICATE_SIMILARITY_THRESHOLD)
            highest_sim = -1.0
            highest_match = None
            
            for row in rows:
                stored_emb = InsightFaceEngine.deserialize_embedding(row["embedding"])
                sim = InsightFaceEngine.compute_cosine_similarity(candidate_emb, stored_emb)
                if sim > highest_sim:
                    highest_sim = sim
                    highest_match = row
                    
            if highest_match and highest_sim >= threshold:
                return {
                    "matched_prn": highest_match["student_prn"],
                    "matched_name": highest_match["name"],
                    "similarity": round(highest_sim, 4),
                    "threshold": threshold
                }
            return None
        finally:
            conn.close()

    @staticmethod
    def enroll_face(prn: str, image_base64: str, consent_given: bool = True) -> Dict[str, Any]:
        """
        Complete enrollment pipeline:
          1. Verify student exists (or create stub)
          2. Extract 512-D normalized embedding via InsightFace
          3. Check duplicate across entire database
          4. Persist in SQLite biometrics table
          5. Update student status to face-enrolled
        """
        prn_upper = prn.strip().upper()
        student = EnrollmentService.get_student_by_prn(prn_upper)
        if not student:
            # Auto-create student record with sensible defaults if student doesn't exist
            EnrollmentService.create_or_update_student({
                "prn": prn_upper,
                "rollNo": 99,
                "name": f"Student {prn_upper}",
            })
            student = EnrollmentService.get_student_by_prn(prn_upper)

        face_engine = InsightFaceEngine.get_instance()
        try:
            embedding, face, bbox, det_score = face_engine.extract_face_and_embedding(image_base64)
        except FaceEngineError as fee:
            logger.warning("Face extraction failed during enrollment for %s: %s (%s)", prn_upper, fee.message, fee.error_code)
            return {
                "success": False,
                "error_code": fee.error_code,
                "message": fee.message
            }
        except Exception as e:
            logger.error("Unexpected error during face extraction for %s: %s", prn_upper, e)
            return {
                "success": False,
                "error_code": "IMAGE_PROCESSING_ERROR",
                "message": f"Failed to process image: {str(e)}"
            }
        
        # Check for duplicates across registered roster
        dup_match = EnrollmentService.check_duplicate_face(embedding, exclude_prn=prn_upper)
        if dup_match:
            logger.warning("Duplicate enrollment blocked: PRN %s matches %s with similarity %.4f",
                           prn_upper, dup_match["matched_prn"], dup_match["similarity"])
            return {
                "success": False,
                "error_code": "DUPLICATE_IDENTITY_DETECTED",
                "message": f"Biometric profile closely matches registered student {dup_match['matched_name']} ({dup_match['matched_prn']}) with similarity {dup_match['similarity']:.2f}. Duplicate registration blocked.",
                "matched_prn": dup_match["matched_prn"],
                "matched_name": dup_match["matched_name"],
                "similarity": dup_match["similarity"]
            }

        conn = get_connection()
        try:
            cursor = conn.cursor()
            now_iso = datetime.now(timezone.utc).isoformat()
            emb_blob = InsightFaceEngine.serialize_embedding(embedding)
            bio_id = f"bio_{uuid.uuid4().hex[:8]}"

            # Upsert into biometrics table
            cursor.execute("""
            INSERT INTO biometrics (id, student_prn, embedding, embedding_dim, model_name, quality_score, consent_given, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_prn) DO UPDATE SET
                embedding = excluded.embedding,
                quality_score = excluded.quality_score,
                consent_given = excluded.consent_given,
                updated_at = excluded.updated_at
            """, (bio_id, prn_upper, emb_blob, 512, face_engine.model_name, det_score, int(consent_given), now_iso, now_iso))

            # Update students table
            cursor.execute("""
            UPDATE students
            SET is_face_enrolled = 1, enrolled_at = ?
            WHERE UPPER(prn) = UPPER(?)
            """, (now_iso, prn_upper))

            conn.commit()
            logger.info("Successfully enrolled biometric embedding for PRN %s (dim: 512, score: %.2f)", prn_upper, det_score)
            return {
                "success": True,
                "message": "Face enrolled successfully with InsightFace deep biometric pipeline",
                "prn": prn_upper,
                "model": face_engine.model_name,
                "embedding_dim": 512,
                "quality_score": round(det_score, 4)
            }
        except Exception as e:
            conn.rollback()
            logger.error("Database failure during biometric enrollment for %s: %s", prn_upper, e, exc_info=True)
            return {
                "success": False,
                "error_code": "DATABASE_ERROR",
                "message": f"Failed to persist biometric template: {str(e)}"
            }
        finally:
            conn.close()

    @staticmethod
    def delete_face(prn: str) -> bool:
        """Deletes biometric template in compliance with biometric data retention policy."""
        prn_upper = prn.strip().upper()
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM biometrics WHERE UPPER(student_prn) = UPPER(?)", (prn_upper,))
            cursor.execute("""
            UPDATE students
            SET is_face_enrolled = 0, enrolled_at = NULL
            WHERE UPPER(prn) = UPPER(?)
            """, (prn_upper,))
            conn.commit()
            logger.info("Deleted biometric template for student %s", prn_upper)
            return True
        except Exception as e:
            conn.rollback()
            logger.error("Error deleting face template for %s: %s", prn_upper, e)
            return False
        finally:
            conn.close()

    @staticmethod
    def get_enrolled_embedding(prn: str) -> Optional[np.ndarray]:
        """Fetches stored 512-D float32 embedding for student PRN."""
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT embedding FROM biometrics
            WHERE UPPER(student_prn) = UPPER(?)
            """, (prn.strip(),))
            row = cursor.fetchone()
            if not row or not row["embedding"]:
                return None
            return InsightFaceEngine.deserialize_embedding(row["embedding"])
        finally:
            conn.close()
