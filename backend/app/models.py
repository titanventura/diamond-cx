from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    environment: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AgentInfoResponse(BaseModel):
    name: str
    description: str
    model: str
    api_key_configured: bool


class AgentMessageRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        description="Input message or instruction for the agent",
    )
    session_id: str | None = Field(
        default=None,
        description="Optional session/conversation identifier",
    )
    context: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional context metadata",
    )


class AgentMessageResponse(BaseModel):
    reply: str
    session_id: str | None = None
    agent_name: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None
