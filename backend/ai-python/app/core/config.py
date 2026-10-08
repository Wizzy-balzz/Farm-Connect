import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
NODE_ENV_PATH = ROOT_DIR.parent / ".env"
PYTHON_ENV_PATH = ROOT_DIR / ".env"

if NODE_ENV_PATH.exists():
    load_dotenv(NODE_ENV_PATH)
if PYTHON_ENV_PATH.exists():
    load_dotenv(PYTHON_ENV_PATH)


class Settings(BaseSettings):
    """Central configuration for FarmConnect Python AI/NLP Service."""
    model_config = SettingsConfigDict(extra="allow", case_sensitive=True)

    # Server settings
    PYTHON_AI_PORT: int = Field(default=8000, alias="PYTHON_AI_PORT")
    PYTHON_AI_HOST: str = Field(default="127.0.0.1", alias="PYTHON_AI_HOST")
    DEBUG: bool = Field(default=False, alias="DEBUG")
    LOG_LEVEL: str = Field(default="INFO", alias="LOG_LEVEL")

    # Internal Authentication Header
    INTERNAL_API_SECRET: str = Field(default="farmconnect_internal_ai_secret_dev_key", alias="INTERNAL_API_SECRET")
    INTERNAL_AUTH_HEADER_NAME: str = "X-Internal-Service-Key"

    # Node.js Application Gateway URL
    NODE_BACKEND_URL: str = Field(default="http://127.0.0.1:5000", alias="NODE_BACKEND_URL")

    def __getattr__(self, item: str):
        if item.startswith("GEMINI_"):
            return ""
        raise AttributeError(f"'{self.__class__.__name__}' object has no attribute '{item}'")

    # Database settings (MySQL with SQLite compatibility)
    DB_HOST: str = Field(default="127.0.0.1", alias="DB_HOST")
    DB_PORT: int = Field(default=3306, alias="DB_PORT")
    DB_USER: str = Field(default="root", alias="DB_USER")
    DB_PASSWORD: str = Field(default="", alias="DB_PASSWORD")
    DB_NAME: str = Field(default="farmconnect", alias="DB_NAME")
    DB_POOL_SIZE: int = Field(default=5, alias="DB_POOL_SIZE")

    # Voice & Multimodal Providers
    STT_PROVIDER: str = Field(default="python", alias="STT_PROVIDER")
    TTS_PROVIDER: str = Field(default="python", alias="TTS_PROVIDER")
    MAX_VOICE_FILE_SIZE_MB: int = Field(default=10, alias="MAX_VOICE_FILE_SIZE_MB")
    MAX_IMAGE_FILE_SIZE_MB: int = Field(default=10, alias="MAX_IMAGE_FILE_SIZE_MB")


settings = Settings()
