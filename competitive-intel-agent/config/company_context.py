from __future__ import annotations
"""
[Company] company context: single source of truth for all processor system prompts.

Users configure this via the dashboard Inputs tab (text or document upload).
Falls back to DEFAULT_CONTEXT when no custom value is set.
"""

# Aggregated from the hardcoded snippets across all processor system prompts.
# This is the fallback used when no custom context has been saved.
DEFAULT_CONTEXT = """[Company] is an AI-powered sports video intelligence platform for Padel and Pickleball (a [Company] product).

Core product: Video AI skill rating (Player Rating), match analysis, coaching insights, and highlight generation.
Target market: D2C, targeting 50M+ amateur Padel and Pickleball players globally.
Stage: MVP launched Dec 2025, 500+ users, 9 courts, 1,200+ matches in 3 months.

Key features: Player Rating skill rating, shot analysis, match replay, movement heatmaps, rally analysis, coaching insights, highlight generation, skill scoring (TECH/TACT/PHY dimensions), matchmaking, tournament coverage.

Tech stack: 20+ ML models, 10+ DL models, VLMs, proprietary sport-specific training data, court detection, ball tracking, player detection/pose, shot classification, rally segmentation.

Positioning: D2C consumer intelligence (the Strava of racquet sports), NOT B2B court infrastructure.

Key narratives:
- Player Rating as the performance currency of the ecosystem
- Video AI as the foundation of a new Sports Intelligence Engine
- Data moat: 18 months + 1,000+ matches to build ($200M dataset replacement cost)
- Market timing: Padel/Pickleball at inflection point

Pricing model: D2C subscription targeting amateur players."""


def get_company_context() -> str:
    """
    Return the current [Company] context string.
    Reads from the app_settings DB table (key: 'company_context').
    Falls back to DEFAULT_CONTEXT if none is set.
    """
    try:
        from db import database
        value = database.get_setting("company_context")
        if value and value.strip():
            return value.strip()
    except Exception:
        pass
    return DEFAULT_CONTEXT


def build_system(base_prompt: str) -> str:
    """
    Append the current [Company] context block to any system prompt.
    Use this at every LLM call site instead of passing the raw constant directly.

    Example:
        result = self.llm.complete(system=build_system(SYSTEM_PROMPT), ...)
    """
    ctx = get_company_context()
    return (
        base_prompt
        + "\n\n---\n"
        + "## [Company] — Authoritative Company Context (always use this as ground truth):\n"
        + ctx
    )
