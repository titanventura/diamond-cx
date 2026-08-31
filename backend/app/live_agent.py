"""Gemini Live Agent Facade and Session Management.

Provides the Google ADK Live Agent, Runner, Session Lifecycle Manager,
and configuration builders for bidirectional multimodal (Audio + Video + Text) streaming.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator

from fastapi import WebSocket
from google.adk.agents import Agent
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import errors as genai_errors
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

logger = logging.getLogger("diamond_cx.live")

APP_NAME = "diamond-cx-live"


def _ignore_normal_live_close(record: logging.LogRecord) -> bool:
    """Filter out expected normal WebSocket / API close errors (code 1000)."""
    exc = record.exc_info[1] if record.exc_info else None
    if isinstance(exc, genai_errors.APIError) and exc.code == 1000:
        return False
    return True


logging.getLogger("google_adk.google.adk.flows.llm_flows.base_llm_flow").addFilter(
    _ignore_normal_live_close
)

LIVE_ROOT_INSTRUCTION = (
    "You are the Diamond CX unified primary concierge and technical diagnostic specialist. "
    "You communicate in real-time through bidirectional live voice and camera video with zero handoffs.\n\n"
    "================================================================================\n"
    "1. OBSERVANT MULTIMODAL VERIFICATION & COMPLIANCE MONITORING PROTOCOL\n"
    "================================================================================\n"
    "You must be observant, watchful, careful, and vigilant. You NEVER assume the customer has performed a step without verification.\n\n"
    "A. Multimodal Camera Vision & Live Visual Grounding:\n"
    "   - You continuously receive live camera video frames. Actively inspect the user's physical actions and hardware.\n"
    "   - Check for: finger placement on control buttons, LED displays (e.g. 'rST', 'E01', 'HOT', 'E04', numeric height values), "
    "     cable seating into the control box, motor alignment, and physical damage.\n"
    "   - Verbally reference what you see in the video frames to confirm compliance: "
    "     'I can see your control panel. Please point the camera closer to the LED display while you press the buttons.'\n"
    "   - If the user claims they performed a physical step (e.g. re-plugged cable, held buttons, cleared obstruction), "
    "     inspect the video frame to visually verify before proceeding.\n\n"
    "B. Strict Step-by-Step Isolation (One Action at a Time):\n"
    "   - NEVER give multiple troubleshooting instructions in a single turn.\n"
    "   - Deliver EXACTLY ONE action at a time (e.g. 'Step 1: Unplug the main power cable from the wall outlet and wait 10 seconds. Let me know when it\'s unplugged.').\n"
    "   - Wait for explicit user confirmation or visual evidence before giving Step 2.\n\n"
    "C. Active Verification Questions & Ground-Truth Probing:\n"
    "   - If camera vision is not clear or if user gives brief answers like 'I did it' or 'it didn't work', probe with specific hardware checks:\n"
    "     * 'What exact letters or digits flashed on the 7-segment display when you held Up + Down?'\n"
    "     * 'Did you hear the single audible relay click inside the control box when you reconnected power?'\n"
    "     * 'Did the desk lower completely to 60 cm and beep before stopping?'\n"
    "   - If their answer contradicts the actual hardware specifications, gently ask them to repeat the step while watching the result.\n\n"
    "D. Anti-Bypass & Redressal Integrity:\n"
    "   - Do NOT immediately issue refunds or technician dispatches if a customer simply demands one without diagnostic evidence.\n"
    "   - Guide them through the short verified procedure first: 'I want to resolve this for you right away. To ensure our records "
    "     and warranty system authorize the redressal properly, let\'s run this 15-second diagnostic check together.'\n"
    "   - Once legitimate hardware failure is verified (persistent grinding noise, unrecoverable motor burn, structural frame crack, "
    "     or failed calibration after verified rST reset), IMMEDIATELY execute `issue_order_refund_or_replacement`.\n\n"
    "================================================================================\n"
    "2. CORE CAPABILITIES & TOOLS\n"
    "================================================================================\n"
    "1. Order & Serial Recognition: When the customer points at or shows ANY item on camera (desk, keyboard, mouse, jewelry, receipt, box) "
    "   or asks about their order/warranty, identify the item and call `lookup_order_or_serial`.\n"
    "2. Knowledge Retrieval: Call `search_product_knowledge_base` or `lookup_component_instructions` for exact button mappings, "
    "   error code meanings, anti-collision sensitivity (S-1 to S-5), and component guides.\n"
    "3. Decisive Redressal & Refund Action: When an irreparable hardware defect is verified under warranty, call "
    "   `issue_order_refund_or_replacement` with the order ID and reason. State the refund amount, reference ID, and explain return arrangements.\n"
    "4. Field Technician Dispatch: If the customer requests an in-person field technician rather than a refund, or if on-site repair is needed, "
    "   call `escalate_to_human_technician`.\n"
    "5. Spoken Voice Style: Natural, concise, luxury concierge tone, and adaptable to customer language."
)


def create_live_agent() -> Agent:
    """Create and configure the real-time multimodal Gemini Live unified agent."""
    settings = get_settings()

    # Ensure API key is in environment if valid
    if is_api_key_configured(settings.GEMINI_API_KEY):
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

    agent = Agent(
        name="diamond_cx_live_agent",
        description="Diamond CX Real-time Multimodal Live Concierge and Technical Diagnostic Specialist",
        model=settings.GEMINI_LIVE_MODEL,
        instruction=LIVE_ROOT_INSTRUCTION,
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


@dataclass
class SessionState:
    """Per-session state tracking for active live streams and client WebSockets."""

    session_id: str
    user_id: str | None = None
    created_at: float = field(default_factory=time.time)
    last_active_at: float = field(default_factory=time.time)
    client_ws: WebSocket | None = None
    active_queue: LiveRequestQueue | None = None
    resumption_handle: str | None = None

    def touch(self) -> None:
        """Update last active timestamp."""
        self.last_active_at = time.time()


class LiveSessionManager:
    """Thread-safe session state registry for active live WebSocket connections."""

    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}
        self._lock = asyncio.Lock()

    async def get_or_create(
        self, session_id: str, user_id: str | None = None
    ) -> SessionState:
        async with self._lock:
            state = self._sessions.get(session_id)
            if state is None:
                state = SessionState(session_id=session_id, user_id=user_id)
                self._sessions[session_id] = state
                logger.info("Created Live session state: %s (user: %s)", session_id, user_id)
            elif user_id is not None:
                state.user_id = user_id
            state.touch()
            return state

    async def get(self, session_id: str) -> SessionState | None:
        async with self._lock:
            return self._sessions.get(session_id)

    async def cleanup(self, session_id: str) -> None:
        async with self._lock:
            state = self._sessions.get(session_id)
            if state:
                if state.active_queue:
                    try:
                        state.active_queue.close()
                    except Exception:
                        pass
                self._sessions.pop(session_id, None)
                logger.info("Cleaned up Live session state: %s", session_id)

    def active_count(self) -> int:
        return len(self._sessions)


class LiveAgentRunner:
    """Facade for the Google ADK Live Runner managing streaming sessions."""

    def __init__(self, agent: Agent | None = None) -> None:
        self.agent = agent or create_live_agent()
        self.session_service = InMemorySessionService()
        self.runner = Runner(
            app_name=APP_NAME,
            agent=self.agent,
            session_service=self.session_service,
        )
        self.session_manager = LiveSessionManager()

    def build_run_config(
        self,
        modality: str | None = None,
        voice_name: str | None = None,
        resumption_handle: str | None = None,
    ) -> RunConfig:
        """Construct ADK RunConfig for BIDI streaming with audio/video/text."""
        settings = get_settings()
        selected_modality = (modality or settings.LIVE_RESPONSE_MODALITY).upper()
        selected_voice = voice_name or settings.LIVE_VOICE_NAME

        speech_config = types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=selected_voice
                )
            )
        )

        resumption_cfg = (
            types.SessionResumptionConfig(handle=resumption_handle)
            if resumption_handle
            else types.SessionResumptionConfig()
        )

        return RunConfig(
            streaming_mode=StreamingMode.BIDI,
            response_modalities=[selected_modality],
            speech_config=speech_config,
            session_resumption=resumption_cfg,
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
        )

    async def ensure_session(self, user_id: str, session_id: str) -> None:
        """Ensure an ADK session exists in the session service."""
        existing = await self.session_service.get_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )
        if not existing:
            await self.session_service.create_session(
                app_name=APP_NAME, user_id=user_id, session_id=session_id
            )

    async def run_live(
        self,
        user_id: str,
        session_id: str,
        queue: LiveRequestQueue,
        run_config: RunConfig | None = None,
    ) -> AsyncGenerator[Any, None]:
        """Stream events from the live agent session."""
        config = run_config or self.build_run_config()
        await self.ensure_session(user_id=user_id, session_id=session_id)

        async for event in self.runner.run_live(
            user_id=user_id,
            session_id=session_id,
            live_request_queue=queue,
            run_config=config,
        ):
            yield event


def is_disconnect_error(exc: Exception) -> bool:
    """Check if exception represents a normal disconnect event."""
    if isinstance(exc, RuntimeError) and "disconnect message has been received" in str(exc):
        return True
    if isinstance(exc, genai_errors.APIError) and exc.code == 1000:
        return True
    return False


# Global singleton Live Agent Runner
live_agent_runner = LiveAgentRunner()
