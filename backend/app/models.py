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


class StoreProduct(BaseModel):
    id: str = Field(..., description="Unique product ID (e.g. PROD-DESK-JHT8)")
    name: str = Field(..., description="Product title")
    tagline: str = Field(default="", description="Catchy sub-headline")
    category: str = Field(default="Ergonomic Furniture")
    price: float = Field(..., description="Product retail price in USD")
    currency: str = Field(default="USD")
    rating: float = Field(default=4.9)
    review_count: int = Field(default=128)
    in_stock: bool = Field(default=True)
    images: list[str] = Field(default_factory=list)
    description: str = Field(default="")
    features: list[str] = Field(default_factory=list)
    specs: dict[str, str] = Field(default_factory=dict)
    warranty_years: int = Field(default=2)


class CheckoutRequest(BaseModel):
    product_id: str = Field(..., description="Product ID being purchased")
    quantity: int = Field(default=1, ge=1)
    customer_name: str = Field(default="Aswath S")
    customer_email: str = Field(default="aswath@diamondcx.com")
    user_id: str = Field(default="user-demo-01")
    shipping_address: str = Field(default="742 Evergreen Terrace, San Jose, CA 95112")
    payment_method: str = Field(default="card_test_sandbox")
    test_card_number: str | None = Field(default="•••• 4242")


class CheckoutResponse(BaseModel):
    success: bool
    order_id: str
    serial_number: str
    product_id: str
    product_name: str
    amount_paid: float
    currency: str
    payment_id: str
    payment_status: str
    status: str
    order_date: str
    warranty_status: str
    message: str


class OrderRecord(BaseModel):
    order_id: str
    user_id: str
    customer_name: str
    customer_email: str
    product_id: str
    product_name: str
    serial_number: str
    price: str
    amount_paid: float
    currency: str = "USD"
    status: str = "Delivered"
    order_date: str
    delivery_date: str
    warranty_status: str
    payment_id: str
    payment_method: str
    payment_status: str = "captured"
    shipping_address: str
    refund_status: str | None = None
    refund_id: str | None = None
    refund_amount: str | None = None
    refund_date: str | None = None
    refund_reason: str | None = None
    image_url: str | None = None


class RefundRequest(BaseModel):
    order_id: str
    reason: str
    action: str = Field(default="refund", description="'refund' or 'replacement'")
    notes: str = ""


class RefundResponse(BaseModel):
    success: bool
    refund_id: str
    order_id: str
    product_name: str
    refund_amount: str
    original_payment_id: str
    status: str
    action: str
    message: str


class SupportTicketCreate(BaseModel):
    order_id: str
    user_id: str
    subject: str
    description: str
    priority: str = "high"


class SupportTicket(BaseModel):
    ticket_id: str
    order_id: str
    user_id: str
    subject: str
    description: str
    status: str = "Open"
    created_at: str
    priority: str = "high"
