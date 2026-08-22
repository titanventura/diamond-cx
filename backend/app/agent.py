import logging
import os
from typing import Any

from google.adk.agents import Agent
from google.adk.runners import InMemoryRunner

from app.config import get_settings

logger = logging.getLogger(__name__)


def create_customer_agent() -> Agent:
    """Create and configure the primary customer experience ADK agent."""
    settings = get_settings()
    
    # Ensure API key is in environment if provided in settings
    if settings.GEMINI_API_KEY and not os.environ.get("GEMINI_API_KEY"):
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

    agent = Agent(
        name="diamond_cx_agent",
        description="Diamond CX Intelligent Customer Experience Assistant",
        model=settings.GEMINI_MODEL,
        instruction=(
            "You are the Diamond CX customer experience agent. "
            "You provide helpful, concise, and professional assistance to customers."
        ),
    )
    return agent


class AgentRunner:
    """Wrapper around Google ADK Runner for executing agent interactions."""

    def __init__(self, agent: Agent | None = None) -> None:
        self.agent = agent or create_customer_agent()
        self.runner = InMemoryRunner(agent=self.agent)

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

        # If no GEMINI_API_KEY is configured in dev/testing, provide a structured mock response
        if not settings.GEMINI_API_KEY and not os.environ.get("GEMINI_API_KEY"):
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
            # Run via ADK InMemoryRunner
            # ADK InMemoryRunner.run yields events/steps
            response_text = ""
            events = []
            async for event in self.runner.run_async(
                user_id="user",
                session_id=sid,
                new_message=message,
            ):
                events.append(str(event))
                if hasattr(event, "content") and event.content:
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
agent_runner = AgentRunner()
