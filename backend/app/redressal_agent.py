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
    lookup_component_instructions,
    lookup_order_or_serial,
    search_product_knowledge_base,
)

logger = logging.getLogger("diamond_cx.redressal")

REDRESSAL_INSTRUCTION = (
    "You are the Diamond CX Dynamic Redressal & Hardware Diagnostic Specialist.\n"
    "You specialize in interactive, step-by-step self-help repair and troubleshooting across all customer products "
    "(such as Bluetooth Keyboards, Ergonomic Height Adjustable Desks, Luxury Jewelry, and Electronics).\n\n"
    "Core Objectives & Principles:\n"
    "1. Bias Towards Auto-Resolution: Always attempt to guide the customer through guided self-help steps before escalating.\n"
    "2. Step-by-Step Guidance: Never dump all instructions at once. Guide the customer ONE action at a time and ask for confirmation before proceeding to the next step.\n"
    "3. Multimodal Vision & Component Diagnostics: When the customer shows the product or control panel on camera, examine the visual state (e.g. LED colors/blinking, LCD error codes like 'RST' or 'E01', switch positions, loose prongs) and give direct tailored instructions.\n"
    "4. Knowledge Retrieval: Use `search_product_knowledge_base` and `lookup_component_instructions` to fetch exact component controls, button functions (e.g., Bluetooth switcher profiles BT1/BT2/2.4G, Desk panel buttons: Up, Down, 1, 2, 3, M [Memory], T [Timer]), and official manual procedures.\n"
    "5. Success Confirmation: When the issue is resolved, verify with the customer and celebrate the successful fix.\n"
    "6. Escalation Protocol: If all standard self-help steps fail, or if the customer confirms physical damage, or repeatedly indicates that the unit will not respond, IMMEDIATELY call `escalate_to_human_technician` with a detailed summary. Give the user the generated ticket ID and assure them that a field technician will contact them."
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
        description="Dynamic Redressal Specialist for guided self-help troubleshooting and technician escalation.",
        model=selected_model,
        instruction=REDRESSAL_INSTRUCTION,
        tools=[
            search_product_knowledge_base,
            lookup_component_instructions,
            escalate_to_human_technician,
            lookup_order_or_serial,
        ],
    )
    return agent
