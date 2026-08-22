"""FastAPI WebSocket Transport Layer for Gemini Live Multimodal Streaming."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.genai import types

from app.agent import is_api_key_configured
from app.config import get_settings
from app.live_agent import (
    SessionState,
    is_disconnect_error,
    live_agent_runner,
)

logger = logging.getLogger("diamond_cx.live.routes")

router = APIRouter(prefix="/live", tags=["Gemini Live"])


async def client_to_agent(
    ws: WebSocket,
    session: SessionState,
    queue: LiveRequestQueue,
) -> None:
    """Upstream handler: Reads client audio, video, and text frames and pushes to ADK queue."""
    while True:
        message = await ws.receive()
        session.touch()

        # Handle client WebSocket disconnect
        if message.get("type") == "websocket.disconnect":
            logger.info("Client WebSocket disconnected in upstream loop for session: %s", session.session_id)
            break

        # Handle raw binary frames (16kHz 16-bit PCM mono audio)
        if "bytes" in message and message["bytes"]:
            queue.send_realtime(
                types.Blob(
                    mime_type="audio/pcm;rate=16000",
                    data=message["bytes"],
                )
            )
            continue

        # Handle JSON text frames (text chat, video/camera frames, control signals)
        if "text" in message and message["text"]:
            try:
                payload: dict[str, Any] = json.loads(message["text"])
            except json.JSONDecodeError:
                logger.warning("Received invalid non-JSON text frame from client")
                continue

            msg_type = payload.get("type", "")

            # Text input
            if msg_type == "text" and "text" in payload:
                text_val = str(payload["text"]).strip()
                if text_val:
                    logger.info("Received user text message for session %s: %r", session.session_id, text_val)
                    queue.send_content(
                        types.Content(
                            parts=[types.Part.from_text(text=text_val)],
                        )
                    )
                continue

            # Real-time Video / Camera Snapshot frame
            if msg_type == "image" and "data" in payload:
                raw_b64 = payload["data"]
                # Strip data URL prefix if present (e.g. 'data:image/jpeg;base64,...')
                if "," in raw_b64:
                    raw_b64 = raw_b64.split(",", 1)[1]

                try:
                    img_bytes = base64.b64decode(raw_b64)
                    mime_type = payload.get("mimeType", "image/jpeg")
                    queue.send_realtime(
                        types.Blob(
                            mime_type=mime_type,
                            data=img_bytes,
                        )
                    )
                except Exception as exc:
                    logger.warning("Failed to decode video/image frame: %s", exc)
                continue

            # Activity signaling (optional manual turn taking)
            if msg_type == "activity_start":
                queue.send_activity_start()
                continue

            if msg_type == "activity_end":
                queue.send_activity_end()
                continue

            if msg_type == "close":
                logger.info("Client requested graceful close for session %s", session.session_id)
                queue.close()
                break


async def agent_to_client(
    ws: WebSocket,
    user_id: str,
    session_id: str,
    session: SessionState,
    queue: LiveRequestQueue,
    modality: str | None = None,
    voice: str | None = None,
) -> None:
    """Downstream handler: Streams ADK Live Events (audio chunks, text transcripts, tool calls) to WebSocket."""
    settings = get_settings()

    # If no valid API key is present in local dev, provide simulated streaming
    if not is_api_key_configured(settings.GEMINI_API_KEY):
        logger.warning(
            "GEMINI_API_KEY not configured. Live session %s operating in mock mode.",
            session_id,
        )
        await ws.send_json(
            {
                "type": "system",
                "message": "Connected in simulated mode (GEMINI_API_KEY not set). Set API key in .env for live Gemini LLM audio/video.",
                "model": settings.GEMINI_LIVE_MODEL,
            }
        )
        while True:
            await asyncio.sleep(5)
            session.touch()
        return

    run_config = live_agent_runner.build_run_config(
        modality=modality,
        voice_name=voice,
        resumption_handle=session.resumption_handle,
    )

    async for event in live_agent_runner.run_live(
        user_id=user_id,
        session_id=session_id,
        queue=queue,
        run_config=run_config,
    ):
        session.touch()

        # Update session resumption handle if provided by the event
        if hasattr(event, "session_resumption_update") and event.session_resumption_update:
            session.resumption_handle = getattr(
                event.session_resumption_update, "handle", session.resumption_handle
            )

        # Serialize ADK event directly to JSON for frontend consumption
        event_json = event.model_dump_json(exclude_none=True, by_alias=True)
        try:
            await ws.send_text(event_json)
        except Exception as exc:
            logger.debug("Failed sending event to client WebSocket (likely disconnected): %s", exc)
            break


@router.websocket("/ws/{user_id}/{session_id}")
async def live_websocket_endpoint(
    ws: WebSocket,
    user_id: str,
    session_id: str,
    modality: str | None = Query(default=None, description="Response modality: AUDIO or TEXT"),
    voice: str | None = Query(default=None, description="Voice name: Puck, Charon, Aoede, Kore, Fenrir"),
) -> None:
    """Bidirectional full-duplex live streaming endpoint supporting Audio, Video, Text and Tools."""
    await ws.accept()

    session_manager = live_agent_runner.session_manager
    session = await session_manager.get_or_create(session_id=session_id, user_id=user_id)
    session.client_ws = ws

    queue = LiveRequestQueue()
    session.active_queue = queue

    logger.info(
        "Live WebSocket connected: user_id=%s, session_id=%s, modality=%s, voice=%s",
        user_id,
        session_id,
        modality,
        voice,
    )

    try:
        await asyncio.gather(
            client_to_agent(ws=ws, session=session, queue=queue),
            agent_to_client(
                ws=ws,
                user_id=user_id,
                session_id=session_id,
                session=session,
                queue=queue,
                modality=modality,
                voice=voice,
            ),
        )
    except WebSocketDisconnect:
        logger.info("Client disconnected from Live session: %s", session_id)
    except Exception as exc:
        if is_disconnect_error(exc):
            logger.debug("Normal disconnection for Live session: %s", session_id)
        else:
            logger.error("Live streaming error in session %s: %s", session_id, exc, exc_info=True)
    finally:
        queue.close()
        session.client_ws = None
        session.active_queue = None
        await session_manager.cleanup(session_id)


@router.get("/info", summary="Gemini Live Service Info")
async def get_live_info() -> dict[str, Any]:
    """Retrieve runtime metadata and status of the Gemini Live streaming service."""
    settings = get_settings()
    return {
        "live_model": settings.GEMINI_LIVE_MODEL,
        "default_voice": settings.LIVE_VOICE_NAME,
        "default_modality": settings.LIVE_RESPONSE_MODALITY,
        "active_sessions_count": live_agent_runner.session_manager.active_count(),
        "api_key_configured": is_api_key_configured(settings.GEMINI_API_KEY),
        "supported_modalities": ["AUDIO", "TEXT"],
        "supported_voices": ["Puck", "Charon", "Aoede", "Kore", "Fenrir"],
        "tools": [t.__name__ for t in live_agent_runner.agent.tools],
    }
