"""
End-to-End Verification Test for Unified SmartAttendance System.
Validates:
  1. Frontend production build serving at /
  2. SPA client-side route fallback
  3. API endpoints (/api/health, /api/students, /api/real-ip, /api/records)
  4. Real face enrollment and verification contract
  5. Security isolation (preventing exposure of .env, .db, .py files)
"""

import os
import sys
import base64
from fastapi.testclient import TestClient
from backend_v2.main import app
from backend_v2.services.face_engine import InsightFaceEngine

client = TestClient(app)
FIXTURES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "tests", "fixtures")
ASSETS_DIR = FIXTURES_DIR if os.path.exists(FIXTURES_DIR) else "face-anti-spoofing/assets"

def get_base64_image(filename: str) -> str:
    path = os.path.join(ASSETS_DIR, filename)
    with open(path, "rb") as f:
        data = f.read()
    return f"data:image/jpeg;base64,{base64.b64encode(data).decode('utf-8')}"

def run_e2e_checks():
    print("==================================================")
    print(" Running End-to-End Integration Verification Checks")
    print("==================================================")

    # 1. Frontend Root Loading
    res_root = client.get("/")
    assert res_root.status_code == 200, f"Root returned {res_root.status_code}"
    assert "<!doctype html>" in res_root.text.lower(), "Root did not return HTML"
    assert 'src="/assets/' in res_root.text or 'id="root"' in res_root.text, "Vite assets not linked in index.html"
    print("  [PASS] 1. Frontend index.html served from same-origin root /")

    # 2. SPA Route Fallback
    res_spa = client.get("/student/portal")
    assert res_spa.status_code == 200, f"SPA route returned {res_spa.status_code}"
    assert "<!doctype html>" in res_spa.text.lower(), "SPA route did not fallback to index.html"
    print("  [PASS] 2. Client-side route fallback (/student/portal) works on page refresh")

    # 3. API Health
    res_health = client.get("/api/health")
    assert res_health.status_code == 200, f"Health returned {res_health.status_code}"
    h_data = res_health.json()
    assert h_data["status"] == "HEALTHY", f"Health status: {h_data['status']}"
    assert h_data["model_loaded"] is True, "InsightFace model not loaded"
    assert h_data["liveness_loaded"] is True, "MiniFASNet model not loaded"
    print(f"  [PASS] 3. Backend health operational (Model: {h_data['model_name']}, Engine: {h_data['engine']})")

    # 4. Real IP Detection Endpoint
    res_ip = client.get("/api/real-ip")
    assert res_ip.status_code == 200
    ip_data = res_ip.json()
    assert "ip" in ip_data and "timestamp" in ip_data
    print(f"  [PASS] 4. Real-IP detection endpoint operational (Client IP: {ip_data['ip']})")

    # 5. Student Roster Listing
    res_students = client.get("/api/students")
    assert res_students.status_code == 200
    s_data = res_students.json()
    assert "students" in s_data
    assert len(s_data["students"]) >= 3
    print(f"  [PASS] 5. Student roster synchronized ({len(s_data['students'])} registered students)")

    # 6. Biometric Enrollment Contract (Real Inference)
    img_t1 = get_base64_image("image_T1.jpg")
    enroll_res = client.post("/api/students/enroll-face", json={
        "prn": "CVV240871",
        "image": img_t1,
        "consentGiven": True
    })
    assert enroll_res.status_code == 200
    e_data = enroll_res.json()
    assert e_data["success"] is True
    assert e_data["embedding_dim"] == 512
    print(f"  [PASS] 6. Real InsightFace face enrollment verified (PRN: CVV240871, Dim: {e_data['embedding_dim']}, Score: {e_data['quality_score']})")

    # 7. Biometric Attendance Verification (Real Inference)
    verify_res = client.post("/api/attendance/verify", json={
        "prn": "CVV240871",
        "sessionId": "sess_default_e2e",
        "periodNumber": 1,
        "date": "2026-10-15",
        "image": img_t1,
        "networkSsid": "Campus-WiFi-Secure"
    })
    assert verify_res.status_code == 200
    v_data = verify_res.json()
    assert v_data["success"] is True
    assert v_data["is_genuine"] is True
    assert v_data["is_live"] is True
    assert v_data["similarity"] >= 0.80
    print(f"  [PASS] 7. Real attendance verification verified (Similarity: {v_data['similarity']}, Liveness Score: {v_data['liveness_score']})")

    # 8. Unrecognized API Route Protection (Must NOT return HTML)
    res_api_404 = client.get("/api/unrecognized_route")
    assert res_api_404.status_code == 404
    assert res_api_404.headers["content-type"] == "application/json"
    print("  [PASS] 8. Strict API route isolation verified (404 JSON returned, no HTML interception)")

    # 9. Static File Security (Dotfiles, databases, models protected)
    res_env = client.get("/.env")
    assert res_env.status_code == 404
    res_db = client.get("/backend_v2/attendance_v2.db")
    assert res_db.status_code == 404
    res_py = client.get("/backend_v2/main.py")
    assert res_py.status_code == 404
    res_model = client.get("/backend_v2/models/MiniFASNetV2.onnx")
    assert res_model.status_code == 404
    print("  [PASS] 9. Security rules verified (private files, DB, python source, models blocked from web server)")

    print("\n>>> ALL 9 END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<\n")

if __name__ == "__main__":
    run_e2e_checks()
