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


class KnowledgeChunk(BaseModel):
    id: str = Field(..., description="Unique chunk identifier")
    product_id: str = Field(..., description="Product SKU or ID (e.g. PROD-KB-001)")
    product_name: str = Field(..., description="Human-readable product name")
    category: str = Field(default="General", description="Product category")
    component_name: str | None = Field(default=None, description="Specific component or part (e.g. bluetooth switcher, control panel)")
    content_type: str = Field(default="procedure", description="Type: text, image, procedure, spec, faq")
    title: str = Field(..., description="Chunk title or step heading")
    text_content: str = Field(..., description="Text content or procedure instruction")
    image_path: str | None = Field(default=None, description="Relative or absolute path to associated image file")
    step_number: int | None = Field(default=None, description="Step number if sequential instruction")
    possible_states_or_options: list[str] = Field(default_factory=list, description="Supported states, button options, or indicator behaviors")
    instructions: list[str] = Field(default_factory=list, description="Step-by-step actionable instructions")
    embedding: list[float] | None = Field(default=None, description="Vector embedding values")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional arbitrary metadata")


class VectorSearchResult(BaseModel):
    chunk: KnowledgeChunk
    similarity_score: float
    matched_modality: str = Field(default="hybrid", description="text, image, or hybrid")


class ComponentInstruction(BaseModel):
    product_name: str
    component_name: str
    options_and_controls: list[str]
    step_by_step_guide: list[str]
    troubleshooting_tips: list[str]


class EscalationTicket(BaseModel):
    ticket_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    product_name: str
    issue_summary: str
    attempted_steps: list[str]
    status: str = "Escalated to Field Technician"
    assigned_dispatch: str = "Level 2 Diamond CX Technician Team"
