"""
SQLite Database module for backend_v2.
Manages connections, schema creation, transactions, and seeded records.
Belongs exclusively to backend_v2 (never touches original backend's database).
"""

import sqlite3
import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Any
from .config import settings

def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = db_path or settings.DB_PATH
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db(db_path: Optional[str] = None):
    """Initializes SQLite schema and seeds default demonstration records."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    # 1. Students table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        prn TEXT UNIQUE NOT NULL,
        roll_no INTEGER,
        name TEXT NOT NULL,
        email TEXT,
        department TEXT,
        semester TEXT,
        batch TEXT,
        avatar_url TEXT,
        is_face_enrolled INTEGER DEFAULT 0,
        enrolled_at TEXT,
        created_at TEXT NOT NULL
    );
    """)
    
    # 2. Biometrics table (stores 512-D float32 serialized blob)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS biometrics (
        id TEXT PRIMARY KEY,
        student_prn TEXT UNIQUE NOT NULL REFERENCES students(prn) ON DELETE CASCADE,
        embedding BLOB NOT NULL,
        embedding_dim INTEGER NOT NULL DEFAULT 512,
        model_name TEXT NOT NULL,
        quality_score REAL,
        consent_given INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)
    
    # 3. Attendance sessions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attendance_sessions (
        id TEXT PRIMARY KEY,
        period_number INTEGER NOT NULL,
        subject_code TEXT NOT NULL,
        subject_name TEXT NOT NULL,
        faculty_id TEXT NOT NULL,
        faculty_name TEXT NOT NULL,
        room TEXT,
        date TEXT NOT NULL,
        started_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
    );
    """)
    
    # 4. Attendance records table (enforces UNIQUE(session_id, student_prn))
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attendance_records (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES attendance_sessions(id),
        period_number INTEGER NOT NULL,
        date TEXT NOT NULL,
        student_prn TEXT NOT NULL REFERENCES students(prn),
        student_name TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('PRESENT', 'ABSENT', 'FLAGGED')),
        verification_method TEXT NOT NULL,
        similarity_score REAL,
        liveness_score REAL,
        threshold_used REAL,
        network_ssid TEXT,
        ip_address TEXT,
        notes TEXT,
        timestamp TEXT NOT NULL,
        CONSTRAINT uq_session_student UNIQUE (session_id, student_prn)
    );
    """)
    
    # 5. Audit logs table (for faculty overrides and security events)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        period_number INTEGER,
        teacher_id TEXT NOT NULL,
        teacher_name TEXT NOT NULL,
        student_prn TEXT NOT NULL,
        student_name TEXT NOT NULL,
        reason TEXT NOT NULL,
        custom_note TEXT,
        timestamp TEXT NOT NULL
    );
    """)
    
    # 6. System configuration table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)
    
    # Seed default system configs if absent
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
    INSERT OR IGNORE INTO system_config (key, value, updated_at)
    VALUES (?, ?, ?)
    """, ("similarity_threshold", str(settings.SIMILARITY_THRESHOLD), now_iso))
    
    cursor.execute("""
    INSERT OR IGNORE INTO system_config (key, value, updated_at)
    VALUES (?, ?, ?)
    """, ("liveness_threshold", str(settings.LIVENESS_THRESHOLD), now_iso))
    
    # Seed demonstration students if table is empty
    cursor.execute("SELECT COUNT(*) AS count FROM students")
    count = cursor.fetchone()["count"]
    if count == 0:
        seed_students = [
            ("std_001", "CVV240871", 1, "Aarav Patel", "aarav.patel@college.edu", "Computer Science", "Sem 4", "Batch A", None, 0, None, now_iso),
            ("std_002", "CVV240872", 2, "Diya Sharma", "diya.sharma@college.edu", "Computer Science", "Sem 4", "Batch A", None, 0, None, now_iso),
            ("std_003", "CVV240873", 3, "Rohan Iyer", "rohan.iyer@college.edu", "Computer Science", "Sem 4", "Batch B", None, 0, None, now_iso),
        ]
        cursor.executemany("""
        INSERT INTO students (id, prn, roll_no, name, email, department, semester, batch, avatar_url, is_face_enrolled, enrolled_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, seed_students)
        
    conn.commit()
    conn.close()

def get_config_value(key: str, default: str = "") -> str:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_config WHERE key = ?", (key,))
        row = cursor.fetchone()
        return row["value"] if row else default
    finally:
        conn.close()

def set_config_value(key: str, value: str):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        now_iso = datetime.now(timezone.utc).isoformat()
        cursor.execute("""
        INSERT INTO system_config (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        """, (key, value, now_iso))
        conn.commit()
    finally:
        conn.close()
