"""
Unit Tests with Mocked / Synthetic Validation for backend_v2.
Tests API contracts, input validation, database constraints, session expiry,
and faculty audit logging.
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from backend_v2.main import app
from backend_v2.db import get_connection, set_config_value
from backend_v2.services.session_service import SessionService
from backend_v2.services.audit_service import AuditService

client = TestClient(app)

def test_01_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "model_loaded" in data
    assert "model_name" in data
    assert "similarity_threshold" in data
    assert "liveness_loaded" in data

def test_02_threshold_config():
    # Test GET threshold
    res_get = client.get("/api/config/threshold")
    assert res_get.status_code == 200
    data = res_get.json()
    assert data["similarity_threshold"] == 0.50
    assert data["recommended_threshold"] == 0.50
    assert "ArcFace" in data["far_benchmark"]

    # Test POST update threshold
    res_post = client.post("/api/config/threshold", json={"threshold": 0.55, "facultyId": "FAC-TEST"})
    assert res_post.status_code == 200
    res_updated = client.get("/api/config/threshold").json()
    assert res_updated["similarity_threshold"] == 0.55

    # Reset back to 0.50
    client.post("/api/config/threshold", json={"threshold": 0.50})

def test_03_students_crud():
    # List students
    res_list = client.get("/api/students")
    assert res_list.status_code == 200
    initial_count = len(res_list.json()["students"])

    # Create new student
    test_student = {
        "prn": "UNIT_TEST_PRN",
        "rollNo": 88,
        "name": "Unit Test Student",
        "email": "unit@test.edu",
        "department": "IT",
        "semester": "Sem 5"
    }
    res_create = client.post("/api/students", json=test_student)
    assert res_create.status_code == 200
    created = res_create.json()["student"]
    assert created["prn"] == "UNIT_TEST_PRN"
    assert created["rollNo"] == 88

    # Delete student
    res_delete = client.delete("/api/students/UNIT_TEST_PRN")
    assert res_delete.status_code == 200
    assert res_delete.json()["success"] is True

def test_04_invalid_image_inputs():
    # Empty string image
    res_empty = client.post("/api/students/enroll-face", json={"prn": "CVV240871", "image": ""})
    assert res_empty.status_code == 200
    assert res_empty.json()["success"] is False
    assert "INVALID_IMAGE" in res_empty.json().get("error_code", "")

    # Non-base64 garbage
    res_corrupt = client.post("/api/students/enroll-face", json={"prn": "CVV240871", "image": "NOT_BASE64_DATA_!@#$%"})
    assert res_corrupt.status_code == 200
    assert res_corrupt.json()["success"] is False

def test_05_session_expiration():
    # Create an expired session
    conn = get_connection()
    cursor = conn.cursor()
    past_iso = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    expired_sess_id = "sess_expired_test"
    cursor.execute("""
    INSERT INTO attendance_sessions (id, period_number, subject_code, subject_name, faculty_id, faculty_name, date, started_at, expires_at, is_active)
    VALUES (?, 1, 'TEST101', 'Test Expiry', 'FAC1', 'Prof', '2026-10-15', ?, ?, 1)
    """, (expired_sess_id, past_iso, past_iso))
    conn.commit()
    conn.close()

    # Check that SessionService marks it expired
    sess = SessionService.get_session(expired_sess_id)
    assert sess is not None
    assert sess["is_expired"] is True
    assert sess["is_active"] is False

def test_06_faculty_override_and_audit():
    override_payload = {
        "sessionId": "sess_override_test",
        "periodNumber": 2,
        "date": "2026-10-15",
        "studentPrn": "CVV240871",
        "studentName": "Aarav Patel",
        "newStatus": "PRESENT",
        "teacherId": "FAC_AUDIT",
        "teacherName": "Prof. Rao",
        "reason": "Student attended medical room then rejoined",
        "customNote": "Approved by HOD"
    }
    res_override = client.post("/api/attendance/override", json=override_payload)
    assert res_override.status_code == 200
    assert res_override.json()["success"] is True

    # Check audit log endpoint
    res_logs = client.get("/api/audit/logs")
    assert res_logs.status_code == 200
    logs = res_logs.json()["logs"]
    assert len(logs) > 0
    latest = logs[0]
    assert latest["studentPrn"] == "CVV240871"
    assert latest["teacherName"] == "Prof. Rao"
    assert "medical room" in latest["reason"]

def test_07_real_ip_endpoint():
    res = client.get("/api/real-ip", headers={"x-forwarded-for": "192.168.1.105"})
    assert res.status_code == 200
    data = res.json()
    assert data["ip"] == "192.168.1.105"
    assert "timestamp" in data

def test_08_frontend_spa_and_api_isolation():
    # 1. Root route serves index.html
    res_root = client.get("/")
    assert res_root.status_code == 200
    assert "<!doctype html>" in res_root.text.lower() or "<div id=\"root\">" in res_root.text

    # 2. Client-side route fallback serves index.html on refresh
    res_spa = client.get("/faculty-dashboard")
    assert res_spa.status_code == 200
    assert "<!doctype html>" in res_spa.text.lower() or "<div id=\"root\">" in res_spa.text

    # 3. Unrecognized API route returns 404 JSON, NOT HTML
    res_api_404 = client.get("/api/nonexistent-endpoint")
    assert res_api_404.status_code == 404
    assert res_api_404.headers["content-type"] == "application/json"
    assert "API route not found" in res_api_404.json()["detail"]

def test_09_static_file_security_and_directory_traversal():
    # Attempt to read sensitive files via URL paths
    res_env = client.get("/.env")
    assert res_env.status_code == 404

    res_db = client.get("/backend_v2/attendance_v2.db")
    assert res_db.status_code == 404

    res_py = client.get("/backend_v2/main.py")
    assert res_py.status_code == 404

    res_model = client.get("/backend_v2/models/MiniFASNetV2.onnx")
    assert res_model.status_code == 404
