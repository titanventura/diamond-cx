import logging
import os
from typing import Any

from google.adk.agents import Agent
from google.adk.runners import InMemoryRunner
from google.genai import types

from app.config import get_settings
from app.tools import lookup_order_or_serial, query_product_knowledge

logger = logging.getLogger(__name__)


def is_api_key_configured(api_key: str | None) -> bool:
    """Check if a valid Gemini API key is configured (not empty or default placeholder)."""
    if not api_key:
        return False
    return "your-gemini-api-key" not in api_key.lower()


def create_customer_agent() -> Agent:
    """Create and configure the primary customer experience ADK agent."""
    settings = get_settings()

    # Ensure API key is in environment if valid
    if is_api_key_configured(settings.GEMINI_API_KEY):
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

    agent = Agent(
        name="diamond_cx_agent",
        description="Diamond CX Intelligent Customer Experience Assistant",
        model=settings.GEMINI_MODEL,
        instruction=(
            "You are the Diamond CX customer experience agent for a luxury jewelry company. "
            "You have access to specialized tools:\n"
            "1. `lookup_order_or_serial`: Use this to look up customer orders, verify serial numbers, check delivery status, and warranty info.\n"
            "2. `query_product_knowledge`: Use this to answer customer questions about jewelry care, diamond certifications (GIA/IGI), resizing, and warranties.\n"
            "Always be professional, concise, and helpful."
        ),
        tools=[lookup_order_or_serial, query_product_knowledge],
    )
    return agent


# Expose root_agent for Google ADK CLI discovery (e.g. `adk web`, `adk run`)
root_agent: Agent = create_customer_agent()


class AgentRunner:
    """Wrapper around Google ADK Runner for executing agent interactions."""

    def __init__(self, agent: Agent | None = None) -> None:
        self.agent = agent or root_agent
        self.runner = InMemoryRunner(agent=self.agent, app_name=self.agent.name)
        self.runner.auto_create_session = True

    async def run(
        self,
        message: str,
        session_id: str | None = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute a message against the agent workflow."""
        settings = get_settings()
        sid = session_id or "default-session"
        ctx = context or {}

        # If no valid GEMINI_API_KEY is configured in dev/testing, provide a simulated response
        if not is_api_key_configured(settings.GEMINI_API_KEY) and not is_api_key_configured(
            os.environ.get("GEMINI_API_KEY")
        ):
            logger.warning("GEMINI_API_KEY not configured. Returning simulated agent response.")
            return {
                "reply": (
                    f"Agent '{self.agent.name}' received: '{message}'. "
                    "(Note: Set GEMINI_API_KEY in .env for live Gemini LLM responses)"
                ),
                "session_id": sid,
                "agent_name": self.agent.name,
                "metadata": {"simulated": True, "context": ctx, "model": settings.GEMINI_MODEL},
            }

        try:
            # Construct Google GenAI Content message object
            user_content = types.Content(
                role="user",
                parts=[types.Part.from_text(text=message)],
            )

            # Run via ADK InMemoryRunner
            response_text = ""
            events = []
            async for event in self.runner.run_async(
                user_id="user",
                session_id=sid,
                new_message=user_content,
            ):
                events.append(str(event))
                if hasattr(event, "content") and event.content:
                    if hasattr(event.content, "parts"):
                        for part in event.content.parts:
                            if hasattr(part, "text") and part.text:
                                response_text += part.text
                    else:
                        response_text += str(event.content)

            reply = response_text.strip() or f"Completed workflow for: {message}"
            return {
                "reply": reply,
                "session_id": sid,
                "agent_name": self.agent.name,
                "metadata": {"model": settings.GEMINI_MODEL, "events_count": len(events)},
            }
        except Exception as e:
            logger.exception("Error executing ADK agent workflow: %s", e)
            raise


# Global singleton agent runner
agent_runner = AgentRunner(agent=root_agent)
