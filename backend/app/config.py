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
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_LIVE_MODEL: str = "gemini-3.1-flash-live-preview"
    LIVE_VOICE_NAME: str = "Puck"
    LIVE_RESPONSE_MODALITY: Literal["AUDIO", "TEXT"] = "AUDIO"

    # Google Cloud & Vertex AI Vector Search 2.0
    GOOGLE_GENAI_USE_VERTEXAI: bool = Field(default=True, description="Enable Vertex AI mode")
    GOOGLE_CLOUD_PROJECT: str | None = Field(default=None, description="GCP Project ID for Vertex AI")
    GOOGLE_CLOUD_LOCATION: str = Field(default="us-central1", description="GCP Region/Location for Vertex AI")
    VECTOR_SEARCH_COLLECTION_ID: str = Field(default="diamond-cx-knowledge", description="Vector Search 2.0 Collection ID")
    EMBEDDING_MODEL: str = Field(default="gemini-embedding-2-preview", description="Multimodal embedding model")
    EMBEDDING_DIMENSION: int = Field(default=768, description="Output embedding dimension")
    KNOWLEDGE_STORE_PATH: str = Field(default="data/knowledge_store.json", description="Local knowledge vector store path")
    FIRESTORE_STORE_PATH: str = Field(default="data/firestore_db.json", description="Local Firestore JSON database path")


def is_api_key_configured(api_key: str | None) -> bool:
    """Check if a valid Gemini API key is configured (not empty or default placeholder)."""
    if not api_key:
        return False
    return "your-gemini-api-key" not in api_key.lower()


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
