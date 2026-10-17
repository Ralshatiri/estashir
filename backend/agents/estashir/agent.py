"""ADK entry point. Keep model configuration separate from behavior and tools."""

import os
from pathlib import Path

from google.adk.agents import Agent

from .tools import get_intake, record_consent, record_medical_number, record_symptom, submit_routing

def create_agent(model: str) -> Agent:
    """Share instructions/tools between text and native-audio runtimes."""
    return Agent(
    name="estashir",
    model=model,
    description="Saudi Arabic patient intake and care routing assistant.",
    instruction=Path(__file__).with_name("instructions.md").read_text(encoding="utf-8"),
    tools=[get_intake, record_consent, record_medical_number, record_symptom, submit_routing],
    )


root_agent = create_agent(os.getenv("ESTASHIR_MODEL", "gemini-flash-latest"))
live_agent = create_agent(os.getenv("ESTASHIR_LIVE_MODEL", "gemini-3.8-live"))
