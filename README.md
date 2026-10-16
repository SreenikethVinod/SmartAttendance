# SmartAttendance

SmartAttendance is an institutional facial biometric attendance verification system designed for universities and colleges. It combines deep neural face recognition and presentation attack detection (anti-spoofing) with classroom Wi-Fi verification.

---

## Key Features

- **InsightFace ArcFace 512-D Biometrics**: Fast and highly accurate single-face detection (SCRFD) and 512-dimensional facial embedding extraction (`buffalo_s`) running on CPU with ONNX Runtime.
- **Silent Face Anti-Spoofing (MiniFASNetV2)**: Passive Presentation Attack Detection (PAD) that prevents proxy attendance using smartphone screen replays or printed photographs without requiring awkward user gestures.
- **Campus Wi-Fi Verification**: Validates that check-ins originate from the authorized classroom Wi-Fi network and gateway IP address.
- **Real-Time Student Portal & Faculty Dashboard**: Interactive portals for students to view timetable periods, verify their identity, and generate verified digital attendance passes.
- **Biometric Duplicate Detection**: Checks against registered biometric profiles in SQLite to prevent the same individual from enrolling multiple student accounts.
- **Audit Trails**: Full logging of overrides, verification scores, and timestamps.

---

## Architecture & Project Structure

```text
SmartAttendance/
├── backend_v2/           # FastAPI backend with InsightFace & MiniFASNetV2
│   ├── api/              # REST routers (students, attendance, sessions, audit)
│   ├── models/           # MiniFASNetV2 ONNX weights
│   ├── services/         # Biometrics, FaceEngine, Anti-spoofing, and Attendance services
│   ├── tests/            # Integration & unit test suites (15 tests)
│   └── requirements.txt  # Pinned Python dependencies
├── frontend/             # React 19 + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/   # UI modals, portals, dashboards
│   │   ├── context/      # AttendanceContext state management
│   │   └── utils/        # InsightFace client API & network detector
│   └── package.json
├── face-anti-spoofing/   # Upstream MiniFASNet reference repository
├── insightface/          # Upstream InsightFace reference repository
├── run.ps1               # PowerShell startup script
├── setup.ps1             # PowerShell automated environment installer
└── package.json          # Root scripts
```

---

## Quickstart

### Prerequisites
- **Python**: 3.12 (64-bit)
- **Node.js**: v18+ & npm
- **OS**: Windows 10/11, Linux, or macOS

### 1. Installation
Run the automated PowerShell setup script:
```powershell
.\setup.ps1
```
Or manually:
```powershell
# Python environment
py -3.12 -m venv .venv
.\.venv\Scripts\pip install -r backend_v2\requirements.txt

# Frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Running the Application
Launch both backend and frontend:
```powershell
.\run.ps1
```
Or run separately:
- **Backend (Port 8000)**:
  ```powershell
  $env:PYTHONPATH="."
  .\.venv\Scripts\python -m uvicorn backend_v2.main:app --host 127.0.0.1 --port 8000
  ```
- **Frontend (Port 3000)**:
  ```powershell
  cd frontend
  npm run dev
  ```

### 3. Automated Testing
Run the complete test suite:
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\python -m pytest -v backend_v2/tests
```

---

## License
Institutional distribution. See [LICENSING.md](backend_v2/LICENSING.md) for third-party upstream credits (InsightFace / DeepInsight and Silent-Face-Anti-Spoofing / Minivision).
