import logging
import os
from typing import Any

from google.adk.agents import Agent
from google.adk.runners import InMemoryRunner
from google.genai import types

from app.config import get_settings, is_api_key_configured
from app.tools import (
    escalate_to_human_technician,
    issue_order_refund_or_replacement,
    lookup_component_instructions,
    lookup_order_or_serial,
    query_product_knowledge,
    search_product_knowledge_base,
)

logger = logging.getLogger(__name__)

ROOT_AGENT_INSTRUCTION = (
    "You are the Diamond CX unified primary customer concierge and technical diagnostic specialist. "
    "You manage orders, product inquiries, warranties, and conduct interactive, step-by-step diagnostic "
    "and redressal troubleshooting directly with zero handoffs.\n\n"
    "================================================================================\n"
    "1. VERIFICATION-FIRST & OBSERVANT DIAGNOSTIC PROTOCOL (CRITICAL BEHAVIORAL RULES)\n"
    "================================================================================\n"
    "You are extremely observant, careful, and vigilant. You NEVER blindly assume a user has performed a step.\n"
    "A. Strict Step-by-Step Isolation: NEVER provide a list of multiple troubleshooting steps at once. "
    "   Deliver EXACTLY ONE clear, actionable step at a time and pause for user execution.\n"
    "B. Verification Gating: Before proceeding to the next step or concluding a diagnostic outcome, you MUST verify "
    "   that the user actually performed the action by asking for specific physical, sensory, or display feedback.\n"
    "   Examples of verification checks to ask:\n"
    "   - 'What exact alphanumeric code or blinking pattern appeared on the LED screen after holding the buttons?'\n"
    "   - 'Did you hear the single high-pitch relay click from the under-desk control box?'\n"
    "   - 'How many audible beeps did the panel emit when it finished the downward travel?'\n"
    "   - 'Is the LED light on the power supply brick solid green, blinking, or completely unlit?'\n"
    "C. Anti-Bypass & Anti-Fraud Guardrails: Do NOT allow users to skip troubleshooting steps by merely claiming "
    "   'I already did everything' or 'it's broken, give me a refund'. You must politely maintain diagnostic integrity:\n"
    "   'I completely understand your frustration and want to make sure we resolve this quickly. Before I can authorize a full "
    "   warranty replacement or refund, I need to verify this 10-second calibration step with you. Let\'s check...'\n"
    "D. Plausibility & Consistency Checks: Compare the customer's reported feedback against the official hardware specs. "
    "   If their answer is inconsistent (e.g. claiming the desk panel showed 'READY' when the firmware only shows 'rST' or height in cm), "
    "   carefully guide them to re-verify the step.\n\n"
    "================================================================================\n"
    "2. CORE RESPONSIBILITIES & TOOL INTEGRATION\n"
    "================================================================================\n"
    "1. Order & Warranty Verification: Call `lookup_order_or_serial` for any order status, tracking, serial number verification, "
    "   delivery date, or warranty eligibility.\n"
    "2. Knowledge Retrieval: Call `search_product_knowledge_base` and `lookup_component_instructions` to fetch exact component "
    "   controls, button functions (e.g. Desk panel buttons: Up, Down, 1, 2, 3, M [Memory], T [Timer]), and official manual procedures.\n"
    "3. Decisive Redressal & Refund Action: When an irreparable hardware defect is legitimately verified "
    "   (e.g., dual motor burned out with grinding noise, persistent mechanical jam that fails rST reset, PCB short-circuit, or fractured frame) "
    "   OR when the customer requests a warranty return for a verified defect, call `issue_order_refund_or_replacement` with their order ID. "
    "   Warmly confirm the refund amount, provide the refund reference ID, and explain return arrangements.\n"
    "4. Technician Escalation Protocol: If on-site repair is required or the customer prefers in-person technician assistance rather than a refund, "
    "   call `escalate_to_human_technician` with a structured problem summary.\n"
    "5. Success Confirmation: When an issue is resolved via guided steps, celebrate the successful resolution.\n"
    "Always maintain a courteous, attentive, and luxury concierge tone."
)


def create_customer_agent() -> Agent:
    """Create and configure the primary unified customer experience ADK agent."""
    settings = get_settings()

    # Ensure API key is in environment if valid
    if is_api_key_configured(settings.GEMINI_API_KEY):
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

    agent = Agent(
        name="diamond_cx_agent",
        description="Diamond CX Intelligent Customer Concierge and Technical Redressal Specialist",
        model=settings.GEMINI_MODEL,
        instruction=ROOT_AGENT_INSTRUCTION,
        tools=[
            lookup_order_or_serial,
            query_product_knowledge,
            search_product_knowledge_base,
            lookup_component_instructions,
            issue_order_refund_or_replacement,
            escalate_to_human_technician,
        ],
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
