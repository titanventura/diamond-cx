"""Dynamic Redressal Sub-Agent for Diamond CX.

Provides interactive step-by-step guided troubleshooting, self-help repair,
component state diagnostics, and automatic technician escalation.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from google.adk.agents import Agent

from app.config import get_settings, is_api_key_configured
from app.tools import (
    escalate_to_human_technician,
    issue_order_refund_or_replacement,
    lookup_component_instructions,
    lookup_order_or_serial,
    search_product_knowledge_base,
)

logger = logging.getLogger("diamond_cx.redressal")

REDRESSAL_INSTRUCTION = (
    "You are the Diamond CX Dynamic Redressal & Hardware Diagnostic Specialist.\n"
    "You specialize in interactive, step-by-step self-help repair, troubleshooting, and decisive customer redressal "
    "across customer products (especially the JIN OFFICE Electric Sit-Stand Desk, Bluetooth Keyboards, and Electronics).\n\n"
    "Core Objectives & Principles:\n"
    "1. Bias Towards Auto-Resolution: Always attempt to guide the customer through guided self-help steps before escalating.\n"
    "2. Step-by-Step Guidance: Never dump all instructions at once. Guide the customer ONE action at a time and ask for confirmation before proceeding to the next step.\n"
    "3. Multimodal Vision & Component Diagnostics: When the customer shows the product or control panel on camera, examine the visual state (e.g. LED colors/blinking, LCD error codes like 'rST', 'E01', 'HOT', 'E04', loose cables, switch positions) and give direct tailored instructions.\n"
    "4. Knowledge Retrieval: Use `search_product_knowledge_base` and `lookup_component_instructions` to fetch exact component controls, button functions (e.g. Desk panel buttons: Up, Down, 1, 2, 3, M [Memory], T [Timer]), and official manual procedures.\n"
    "5. Decisive Refund & Redressal Action: When the customer experiences an irreparable hardware defect (e.g. dual motor burned out, persistent mechanical grind/jam, PCB failure that fails reset, physical frame fracture) OR explicitly requests a refund for their purchase under warranty, IMMEDIATELY call `issue_order_refund_or_replacement` with the customer's order ID and reason. Confirm the full refund amount credited to their card, provide the refund reference ID, and explain the return label arrangements warmly.\n"
    "6. Escalation Protocol: If the customer requests an in-person field technician rather than a refund, or if on-site repair is required, call `escalate_to_human_technician` with a detailed summary.\n"
    "7. Success Confirmation: When an issue is resolved via guided steps, verify with the customer and celebrate the successful fix."
)


def create_redressal_subagent(model: str | None = None, is_live: bool = False) -> Agent:
    """Instantiate the dynamic redressal subagent for guided troubleshooting.
    
    Args:
        model: Custom Gemini model name to use.
        is_live: If True, uses GEMINI_LIVE_MODEL so the subagent supports bidiGenerateContent.
    """
    settings = get_settings()

    if is_api_key_configured(settings.GEMINI_API_KEY):
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

    # Use live model if is_live=True or if specified; otherwise fallback to standard model
    selected_model = model or (settings.GEMINI_LIVE_MODEL if is_live else settings.GEMINI_MODEL)

    agent = Agent(
        name="dynamic_redressal_agent",
        description="Dynamic Redressal Specialist for guided self-help troubleshooting, refund actions, and technician escalation.",
        model=selected_model,
        instruction=REDRESSAL_INSTRUCTION,
        tools=[
            search_product_knowledge_base,
            lookup_component_instructions,
            issue_order_refund_or_replacement,
            escalate_to_human_technician,
            lookup_order_or_serial,
        ],
    )
    return agent
