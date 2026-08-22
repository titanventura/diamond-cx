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

from app.agent import is_api_key_configured
from app.config import get_settings
from app.tools import lookup_order_or_serial, query_product_knowledge

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


def create_live_agent() -> Agent:
    """Create and configure the real-time multimodal Gemini Live agent."""
    settings = get_settings()

    # Ensure API key is in environment if valid
    if is_api_key_configured(settings.GEMINI_API_KEY):
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

    live_instruction = (
        "You are the Diamond CX intelligent personal concierge and customer experience specialist. "
        "You communicate in real-time through bidirectional live voice and camera video.\n\n"
        "Capabilities & Guidelines:\n"
        "1. Multimodal & Camera Vision: You can hear the customer's speech, read text, and see live camera video frames. "
        "When the customer points at or shows ANY item on camera (such as a keyboard and mouse, electronics, jewelry, certificates, serial numbers, receipts, or boxes) "
        "and asks to find, pull up, or check order details or warranty for that item, IMMEDIATELY identify the item from the camera frame and call `lookup_order_or_serial` "
        "with the identified item name (e.g. 'keyboard', 'mouse', 'solitaire ring', 'necklace') or serial/order number.\n"
        "2. Proactive Order Lookups: Never refuse to look up an order. If the customer asks 'pull up the order details for this' or mentions an item, ALWAYS call `lookup_order_or_serial` to search the orders database.\n"
        "3. Conversational Voice Style: Keep spoken answers natural, concise, warm, and helpful. Mention key details (order ID, customer name, price, status, delivery date, warranty) clearly.\n"
        "4. Product & Care Inquiries: Call `query_product_knowledge` for product specifications, care instructions, diamond certifications (GIA/IGI), resizing rules, and warranties.\n"
        "5. Multilingual: Naturally adapt to the customer's language."
    )

    agent = Agent(
        name="diamond_cx_live_agent",
        description="Diamond CX Real-time Multimodal Live Concierge",
        model=settings.GEMINI_LIVE_MODEL,
        instruction=live_instruction,
        tools=[lookup_order_or_serial, query_product_knowledge],
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
