"""
Faculty Override and Audit Log Service for backend_v2.
Provides transparent manual corrections and immutable audit trails for compliance.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from ..db import get_connection

logger = logging.getLogger("backend_v2.audit_service")

class AuditService:
    @staticmethod
    def submit_faculty_override(params: Dict[str, Any]) -> bool:
        session_id = params.get("sessionId") or params.get("session_id")
        period_number = params.get("periodNumber") or params.get("period_number") or 1
        date_str = params.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        student_prn = (params.get("studentPrn") or params.get("student_prn") or "").strip().upper()
        student_name = params.get("studentName") or params.get("student_name") or student_prn
        new_status = (params.get("newStatus") or "PRESENT").strip().upper()
        teacher_id = params.get("teacherId") or params.get("teacher_id") or "faculty-admin"
        teacher_name = params.get("teacherName") or params.get("teacher_name") or "Faculty Officer"
        reason = params.get("reason", "Manual institutional correction")
        custom_note = params.get("customNote") or params.get("custom_note")
        
        now_iso = datetime.now(timezone.utc).isoformat()
        conn = get_connection()
        try:
            cursor = conn.cursor()
            
            # Ensure session exists to satisfy foreign key constraint
            cursor.execute("SELECT id FROM attendance_sessions WHERE id = ?", (session_id,))
            if not cursor.fetchone():
                cursor.execute("""
                INSERT OR IGNORE INTO attendance_sessions (id, period_number, subject_code, subject_name, faculty_id, faculty_name, room, date, started_at, expires_at, is_active)
                VALUES (?, ?, 'OVERRIDE', 'Session', ?, ?, 'Room', ?, ?, ?, 1)
                """, (session_id, period_number, teacher_id, teacher_name, date_str, now_iso, now_iso))

            # Ensure student exists to satisfy foreign key constraint
            cursor.execute("SELECT prn FROM students WHERE UPPER(prn) = UPPER(?)", (student_prn,))
            if not cursor.fetchone():
                cursor.execute("""
                INSERT OR IGNORE INTO students (id, prn, roll_no, name, created_at)
                VALUES (?, ?, 99, ?, ?)
                """, (f"std_{uuid.uuid4().hex[:8]}", student_prn, student_name, now_iso))

            # Upsert into attendance_records
            cursor.execute("""
            INSERT INTO attendance_records (
                id, session_id, period_number, date, student_prn, student_name,
                status, verification_method, notes, timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'FACULTY_OVERRIDE', ?, ?)
            ON CONFLICT(session_id, student_prn) DO UPDATE SET
                status = excluded.status,
                verification_method = 'FACULTY_OVERRIDE',
                notes = excluded.notes,
                timestamp = excluded.timestamp
            """, (
                f"att_{uuid.uuid4().hex[:8]}", session_id, period_number, date_str,
                student_prn, student_name, new_status, f"Override: {reason}", now_iso
            ))
            
            # Insert into audit_logs table
            audit_id = f"aud_{uuid.uuid4().hex[:8]}"
            cursor.execute("""
            INSERT INTO audit_logs (
                id, session_id, period_number, teacher_id, teacher_name,
                student_prn, student_name, reason, custom_note, timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                audit_id, session_id, period_number, teacher_id, teacher_name,
                student_prn, student_name, reason, custom_note, now_iso
            ))
            
            conn.commit()
            logger.info("Faculty override recorded for student %s in session %s by %s -> %s",
                        student_prn, session_id, teacher_name, new_status)
            return True
        except Exception as e:
            conn.rollback()
            logger.error("Failed to record faculty override: %s", e, exc_info=True)
            return False
        finally:
            conn.close()

    @staticmethod
    def get_audit_logs() -> List[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT id, session_id, period_number, teacher_id, teacher_name,
                   student_prn, student_name, reason, custom_note, timestamp
            FROM audit_logs
            ORDER BY timestamp DESC
            """)
            rows = cursor.fetchall()
            logs = []
            for r in rows:
                logs.append({
                    "id": r["id"],
                    "sessionId": r["session_id"],
                    "periodNumber": r["period_number"],
                    "teacherId": r["teacher_id"],
                    "teacherName": r["teacher_name"],
                    "studentPrn": r["student_prn"],
                    "studentName": r["student_name"],
                    "reason": r["reason"],
                    "customNote": r["custom_note"],
                    "timestamp": r["timestamp"]
                })
            return logs
        finally:
            conn.close()
