from app.core.config import settings


def test_internal_auth_header_protection(client):
    """Verifies that protected AI endpoints reject requests without internal service header."""
    settings.INTERNAL_API_SECRET = "strong_production_internal_key_xyz"
    try:
        response = client.post(
            "/api/ai/chat",
            json={"prompt": "Hello"}
        )
        assert response.status_code == 401
        assert "UNAUTHORIZED_INTERNAL_SERVICE" in response.json()["detail"]

        auth_response = client.post(
            "/api/ai/chat",
            json={"prompt": "Hello"},
            headers={"X-Internal-Service-Key": "strong_production_internal_key_xyz"}
        )
        assert auth_response.status_code == 200
        assert auth_response.json()["success"] is True
    finally:
        settings.INTERNAL_API_SECRET = "farmconnect_internal_ai_secret_dev_key"
