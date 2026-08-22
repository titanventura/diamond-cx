import logging

from fastapi import APIRouter, HTTPException, status

from app.agent import agent_runner, is_api_key_configured
from app.config import get_settings
from app.models import (
    AgentInfoResponse,
    AgentMessageRequest,
    AgentMessageResponse,
    HealthResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="System Health & Readiness Probe",
    tags=["System"],
)
async def health_check() -> HealthResponse:
    """Return health status and system metadata."""
    settings = get_settings()
    return HealthResponse(
        status="ok",
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )


@router.get(
    "/agent/info",
    response_model=AgentInfoResponse,
    summary="Get Active Agent Information",
    tags=["Agent"],
)
async def get_agent_info() -> AgentInfoResponse:
    """Retrieve metadata about the currently configured Google ADK agent."""
    settings = get_settings()
    return AgentInfoResponse(
        name=agent_runner.agent.name,
        description=agent_runner.agent.description or "",
        model=settings.GEMINI_MODEL,
        api_key_configured=is_api_key_configured(settings.GEMINI_API_KEY),
    )


@router.post(
    "/agent/chat",
    response_model=AgentMessageResponse,
    summary="Send Message to Google ADK Agent",
    tags=["Agent"],
)
async def chat_with_agent(payload: AgentMessageRequest) -> AgentMessageResponse:
    """Send a message/task to the Google ADK agent and receive the response."""
    try:
        result = await agent_runner.run(
            message=payload.message,
            session_id=payload.session_id,
            context=payload.context,
        )
        return AgentMessageResponse(**result)
    except Exception as exc:
        logger.error("Failed processing agent request: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent workflow error: {exc!s}",
        ) from exc
