# SmartAttendance Backend v2: Setup & Troubleshooting Guide

`backend_v2` is an isolated, CPU-only backend implementation for the SmartAttendance facial attendance system. It replaces heuristic JavaScript approximations with deep learning models running on ONNX Runtime:
1. **InsightFace (`buffalo_s` / `buffalo_l`)**: 5-point facial landmark alignment and 512-dimensional ArcFace face embedding extraction.
2. **MiniFASNetV2**: Silent face anti-spoofing and presentation attack defense.
3. **SQLite**: Relational persistence with unique constraints (`session_id, student_prn`) preventing duplicate attendance marks.

---

## Prerequisites
- **Operating System**: Windows 10/11 (64-bit AMD64)
- **Python**: Python 3.12 (64-bit)
- **Node.js**: v18+ (for running the React frontend)
- **Hardware**: Standard x86_64 CPU (No NVIDIA GPU required)

---

## Quickstart Instructions (PowerShell)

### 1. Set Up the Virtual Environment
From the workspace root (`c:\Users\Sreeniketh\Documents\Antigravity\SmartAttendance`):

```powershell
# Create isolated Python 3.12 virtual environment
py -3.12 -m venv .venv

# Activate environment (or use direct python binary)
.\.venv\Scripts\Activate.ps1

# Install pinned dependencies
.\.venv\Scripts\pip.exe install -r backend_v2/requirements.txt
```

### 2. Verify Models and Run Benchmarks (Milestones A & B)
Ensure that the models load cleanly and benchmark CPU latencies:

```powershell
$env:PYTHONPATH = "."
.\.venv\Scripts\python.exe backend_v2/scripts/benchmark_models.py
```

### 3. Run Automated Tests (Unit & Real Integration)
Execute the 12 automated tests covering persistence, duplicate protection, anti-spoofing, and API contracts:

```powershell
$env:PYTHONPATH = "."
.\.venv\Scripts\python.exe -m pytest -v backend_v2/tests
```

### 4. Start the Backend Server (Port 8000)
Run the FastAPI production-grade ASGI server:

```powershell
$env:PYTHONPATH = "."
.\.venv\Scripts\python.exe -m uvicorn backend_v2.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend health endpoint can be verified at:
`http://127.0.0.1:8000/api/health`

### 5. Start the React Frontend (Port 3000)
In a separate terminal, navigate to the frontend directory:

```powershell
cd "c:\Users\Sreeniketh\Documents\Antigravity\Attendance-via-Facial-Recognition--main"
npm run dev
```

Visit `http://localhost:3000` in the browser. The frontend Vite proxy transparently forwards `/api/*` requests to `http://127.0.0.1:8000`.

---

## Troubleshooting & Windows Gotchas

### DLL Load Failed on `onnxruntime_pybind11_state`
- **Symptom**: `ImportError: DLL load failed while importing onnxruntime_pybind11_state: The specified module could not be found.`
- **Cause**: On Windows, ONNX Runtime requires the Microsoft Visual C++ 2015–2022 runtime libraries (`msvcp140.dll`, `vcruntime140.dll`, `vcruntime140_1.dll`).
- **Fix**: The installer or driver repository (`C:\Windows\System32\DriverStore\FileRepository\...`) provides these DLLs. In this project, they have been placed directly in `.\.venv\Lib\site-packages\onnxruntime\capi\` and `.\.venv\Scripts\`, ensuring zero external runtime dependency.

### Model Weights Missing
- **Symptom**: `FileNotFoundError: MiniFASNet model checkpoint not found at ...`
- **Fix**: The `face-anti-spoofing` repository git tree only contains `weights/.gitkeep`. The ONNX weights are hosted at GitHub Releases. Run the automated fetcher or benchmark script:
  `.\.venv\Scripts\python.exe backend_v2/scripts/benchmark_models.py`
  which automatically verifies and downloads `backend_v2/models/MiniFASNetV2.onnx`.

### Duplicate Attendance Blocked
- **Behavior**: If a student attempts to mark attendance twice in the same session, the backend catches the database `UNIQUE(session_id, student_prn)` constraint and responds with `already_marked: true`. This is intentional security behavior.

---

## Directory Structure

```
backend_v2/
├── .env.example              # Environment variables template
├── requirements.txt          # Pinned dependency manifest
├── config.py                 # Configuration loader and defaults
├── db.py                     # SQLite schema, tables, and foreign keys
├── main.py                   # FastAPI application & REST routes
├── schemas.py                # Pantic request and response models
├── models/
│   └── MiniFASNetV2.onnx     # ONNX Runtime CPU anti-spoofing model
├── services/
│   ├── face_engine.py        # InsightFace singleton (detection + ArcFace 512D)
│   ├── liveness_engine.py    # MiniFASNetV2 ONNX liveness analyzer
│   ├── enrollment_service.py # Student CRUD + duplicate face prevention
│   ├── session_service.py    # Attendance timetable & session expiration
│   ├── attendance_service.py # Multi-stage verification pipeline
│   └── audit_service.py      # Faculty overrides & immutable audit logs
├── scripts/
│   └── benchmark_models.py   # Latency & accuracy benchmark script
├── tests/
│   ├── conftest.py           # Isolated test database fixture
│   ├── test_unit_models_mocked.py
│   └── test_real_models_integration.py
├── LICENSING.md              # Model and code license compliance
├── EVALUATION_REPORT.md      # Performance benchmarks and security evaluation
└── README.md                 # Setup & operation guide
```
