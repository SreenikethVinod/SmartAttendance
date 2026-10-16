"""
Pytest configuration and test database isolation fixture for backend_v2.
Ensures tests run on a separate test SQLite database without touching development data.
"""

import os
import pytest
from pathlib import Path
from backend_v2.config import settings
from backend_v2.db import init_db

TEST_DB_PATH = str(Path(__file__).resolve().parent / "test_attendance.db")

@pytest.fixture(autouse=True, scope="session")
def setup_test_environment():
    # Force test database path
    settings.DB_PATH = TEST_DB_PATH
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except Exception:
            pass
            
    init_db(TEST_DB_PATH)
    yield
    
    # Cleanup after test session
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except Exception:
            pass
