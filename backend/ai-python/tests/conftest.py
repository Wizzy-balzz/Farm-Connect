import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings


@pytest.fixture
def internal_headers():
    """Provides internal service authentication headers."""
    return {"X-Internal-Service-Key": settings.INTERNAL_API_SECRET}


@pytest.fixture
def client():
    """Standard TestClient for FastAPI."""
    with TestClient(app) as test_client:
        yield test_client
