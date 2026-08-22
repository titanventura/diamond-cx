from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    PROJECT_NAME: str = "Diamond CX Backend"
    VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: list[str] = ["*"]

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    # Google Agent Development Kit & Gemini API
    GEMINI_API_KEY: str | None = Field(default=None, description="Google Gemini / GenAI API key")
    GEMINI_MODEL: str = "gemini-3.5-flash"


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
