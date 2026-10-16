"""
Attendance Session Service for backend_v2.
Manages classroom session lifecycle, timetables, active windows, and expiration.
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from ..db import get_connection

logger = logging.getLogger("backend_v2.session_service")

class SessionService:
    @staticmethod
    def create_session(data: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            session_id = data.get("id") or f"sess_{uuid.uuid4().hex[:8]}"
            period_number = data.get("periodNumber") or data.get("period_number") or 1
            subject_code = data.get("subjectCode") or data.get("subject_code") or "GEN101"
            subject_name = data.get("subjectName") or data.get("subject_name") or "Lecture"
            faculty_id = data.get("facultyId") or data.get("faculty_id") or "FAC-01"
            faculty_name = data.get("facultyName") or data.get("faculty_name") or "Faculty"
            room = data.get("room", "Room 101")
            
            now_dt = datetime.now(timezone.utc)
            duration_minutes = int(data.get("durationMinutes", 60))
            expires_dt = now_dt + timedelta(minutes=duration_minutes)
            
            date_str = data.get("date") or now_dt.strftime("%Y-%m-%d")
            started_at = now_dt.isoformat()
            expires_at = expires_dt.isoformat()
            
            cursor.execute("""
            INSERT INTO attendance_sessions (id, period_number, subject_code, subject_name, faculty_id, faculty_name, room, date, started_at, expires_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """, (session_id, period_number, subject_code, subject_name, faculty_id, faculty_name, room, date_str, started_at, expires_at))
            
            conn.commit()
            return SessionService.get_session(session_id) # type: ignore
        finally:
            conn.close()

    @staticmethod
    def get_session(session_id: str) -> Optional[Dict[str, Any]]:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT id, period_number, subject_code, subject_name, faculty_id, faculty_name, room, date, started_at, expires_at, is_active
            FROM attendance_sessions
            WHERE id = ?
            """, (session_id,))
            r = cursor.fetchone()
            if not r:
                return None
            
            # Check expiration dynamically
            now_dt = datetime.now(timezone.utc)
            try:
                expires_dt = datetime.fromisoformat(r["expires_at"])
                is_expired = now_dt > expires_dt
            except Exception:
                is_expired = False
                
            is_active = bool(r["is_active"]) and not is_expired
            
            return {
                "id": r["id"],
                "periodNumber": r["period_number"],
                "period_number": r["period_number"],
                "subjectCode": r["subject_code"],
                "subject_code": r["subject_code"],
                "subjectName": r["subject_name"],
                "subject_name": r["subject_name"],
                "facultyId": r["faculty_id"],
                "faculty_id": r["faculty_id"],
                "facultyName": r["faculty_name"],
                "faculty_name": r["faculty_name"],
                "room": r["room"],
                "date": r["date"],
                "started_at": r["started_at"],
                "expires_at": r["expires_at"],
                "is_active": is_active,
                "isActive": is_active,
                "is_expired": is_expired
            }
        finally:
            conn.close()

    @staticmethod
    def get_or_create_default_session(period_number: int = 1, date_str: Optional[str] = None) -> Dict[str, Any]:
        """Provides a valid session for the given period and date if none exists."""
        conn = get_connection()
        try:
            cursor = conn.cursor()
            today = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
            cursor.execute("""
            SELECT id FROM attendance_sessions
            WHERE period_number = ? AND date = ? AND is_active = 1
            ORDER BY started_at DESC LIMIT 1
            """, (period_number, today))
            r = cursor.fetchone()
            if r:
                sess = SessionService.get_session(r["id"])
                if sess and sess["is_active"]:
                    return sess
                    
            # Create a session for this period
            return SessionService.create_session({
                "periodNumber": period_number,
                "subjectCode": f"CS40{period_number}",
                "subjectName": f"Classroom Period {period_number}",
                "facultyId": "FAC-01",
                "facultyName": "Dr. Sharma",
                "room": "Room 302",
                "durationMinutes": 120,
                "date": today
            })
        finally:
            conn.close()
