import logging
import os
from typing import Any

from google.adk.agents import Agent
from google.adk.runners import InMemoryRunner
from google.genai import types

from app.config import get_settings, is_api_key_configured
from app.redressal_agent import create_redressal_subagent
from app.tools import (
    escalate_to_human_technician,
    lookup_component_instructions,
    lookup_order_or_serial,
    query_product_knowledge,
    search_product_knowledge_base,
)

logger = logging.getLogger(__name__)


def create_customer_agent() -> Agent:
    """Create and configure the primary customer experience ADK agent with subagent delegation."""
    settings = get_settings()

    # Ensure API key is in environment if valid
    if is_api_key_configured(settings.GEMINI_API_KEY):
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

    redressal_subagent = create_redressal_subagent()

    agent = Agent(
        name="diamond_cx_agent",
        description="Diamond CX Intelligent Customer Experience Concierge",
        model=settings.GEMINI_MODEL,
        instruction=(
            "You are the Diamond CX primary customer experience concierge. "
            "You handle orders, product questions, warranties, and delegate technical troubleshooting to specialized sub-agents.\n\n"
            "Responsibilities:\n"
            "1. Order & Serial Lookup: Call `lookup_order_or_serial` for any order status, tracking, serial number verification, or warranty dates.\n"
            "2. Jewelry & Product FAQs: Call `query_product_knowledge` for diamond care, certificates (GIA/IGI), resizing, and warranties.\n"
            "3. Manuals & Knowledge Base: Call `search_product_knowledge_base` or `lookup_component_instructions` to find product specifications.\n"
            "4. Troubleshooting & Redressal Delegation: If the customer is experiencing a technical issue, malfunction, connection failure, or hardware problem with ANY product (such as a keyboard, standing desk, electronic device, or loose diamond prong), IMMEDIATELY transfer the conversation to your sub-agent `dynamic_redressal_agent`.\n"
            "5. Technician Escalation Response: If the redressal subagent fails to resolve the problem and escalates, warmly confirm to the customer that a field technician has been dispatched and will contact them shortly.\n"
            "Always maintain a courteous, luxury concierge tone."
        ),
        tools=[
            lookup_order_or_serial,
            query_product_knowledge,
            search_product_knowledge_base,
            lookup_component_instructions,
            escalate_to_human_technician,
        ],
        sub_agents=[redressal_subagent],
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
