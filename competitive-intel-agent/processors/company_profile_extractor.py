"""
Competitor profile extractor.

Reads already-collected web_page and pricing raw_signals for each competitor,
combines the content, and uses an LLM to extract a structured profile including:
description, pricing model, availability, court/venue count, funding, key differentiators,
and a threat summary relative to [Company].

Runs weekly (Monday 3:30pm IST). Profiles are stored in competitor_profiles table
and change-detected via content hash.

Signal type read: web_page, pricing (raw_signals)
Output: competitor_profiles table
"""
from __future__ import annotations

import json
import hashlib
from datetime import datetime, timezone
from db import database
from utils.llm_client import LLMClient
from config.company_context import build_system
from utils.logger import get_logger

logger = get_logger(__name__)

PROFILE_SCHEMA = {
    "type": "object",
    "properties": {
        "description": {"type": "string", "description": "2-3 sentence description of what the company does"},
        "pricing_model": {"type": "string", "enum": ["freemium", "subscription", "pay_per_use", "hardware", "marketplace", "enterprise", "unknown"]},
        "pricing_details": {"type": "string", "description": "Specific pricing tiers or amounts if visible"},
        "availability": {"type": "string", "description": "Geographic reach or platform availability"},
        "venue_count": {"type": "string", "description": "Number of courts, venues, or partner locations. Use 'N/A' for pure software"},
        "key_sports": {"type": "array", "items": {"type": "string"}, "description": "Sports the product covers"},
        "funding_stage": {"type": "string", "description": "Funding stage if mentioned (e.g. Series B, bootstrapped, unknown)"},
        "founded_year": {"type": "string", "description": "Year founded as a string, or 'unknown'"},
        "employee_count_range": {"type": "string", "description": "Approximate employee count if visible"},
        "key_differentiators": {"type": "array", "items": {"type": "string"}, "description": "Up to 4 key product differentiators"},
        "threat_summary": {"type": "string", "description": "1 sentence on how this competitor threatens [Company] (AI padel/pickleball video platform)"},
    },
    "required": ["description", "pricing_model", "availability", "key_differentiators", "threat_summary"],
}

SYSTEM_PROMPT = """You are a competitive intelligence analyst for [Company], an AI video analysis platform for padel and pickleball.

Analyze the provided competitor website and pricing page content to extract a structured profile.
Be concise and factual. If information is not present in the content, use "unknown" or null.
For venue_count, look for mentions of partner courts, venues, clubs, or locations.
For threat_summary, focus specifically on how they compete with an AI sports video analysis platform."""


class CompanyProfileExtractor:
    """Extracts structured competitor profiles from collected web/pricing signals."""

    def __init__(self):
        self.llm = LLMClient()

    def extract_profile(self, competitor_id: str, competitor_config: dict) -> bool:
        """
        Pull latest web_page + pricing signals, combine, call LLM, upsert to DB.
        Returns True if profile was new or updated.
        """
        conn = database.get_connection()
        rows = conn.execute(
            """SELECT raw_content, signal_type, collected_at
               FROM raw_signals
               WHERE competitor_id=? AND signal_type IN ('web_page','pricing')
               ORDER BY collected_at DESC LIMIT 6""",
            (competitor_id,),
        ).fetchall()

        if not rows:
            logger.debug("No web/pricing signals for profile extraction", competitor=competitor_id)
            return False

        # Combine content, truncate to ~6000 chars
        combined_parts = []
        for row in rows:
            try:
                content = json.loads(row[0]) if row[0].startswith('{') else {"text": row[0]}
                text = content.get("text") or content.get("content") or content.get("raw_text") or str(row[0])
                combined_parts.append(f"[{row[1].upper()} - {row[2]}]\n{text[:1500]}")
            except Exception:
                combined_parts.append(str(row[0])[:1500])

        combined = "\n\n---\n\n".join(combined_parts)[:6000]
        comp_name = competitor_config.get("name", competitor_id)

        user_prompt = f"""Competitor: {comp_name}
Website: {competitor_config.get('website', 'unknown')}

Collected content:
{combined}

Extract the structured profile for this competitor."""

        try:
            profile = self.llm.complete(
                system=build_system(SYSTEM_PROMPT),
                user=user_prompt,
                schema=PROFILE_SCHEMA,
                max_tokens=1024,
            )
            if not isinstance(profile, dict):
                logger.warning("Profile extraction returned non-dict", competitor=competitor_id)
                return False

            profile_json = json.dumps(profile, sort_keys=True)
            content_hash = hashlib.sha256(profile_json.encode()).hexdigest()
            changed = database.upsert_competitor_profile(competitor_id, profile_json, content_hash)
            if changed:
                logger.info("Competitor profile updated", competitor=competitor_id)
            return changed

        except Exception as e:
            logger.error("Profile LLM extraction failed", competitor=competitor_id, error=str(e))
            return False


def run_all_profile_extractions(competitors: dict) -> int:
    """Run profile extraction for all active competitors. Returns count of new/updated profiles."""
    extractor = CompanyProfileExtractor()
    updated = 0
    for comp_id, cfg in competitors.items():
        if not cfg.get("active", True):
            continue
        try:
            if extractor.extract_profile(comp_id, cfg):
                updated += 1
        except Exception as e:
            logger.error("Profile extraction failed", competitor=comp_id, error=str(e))
    logger.info("Profile extraction complete", updated=updated, total=len(competitors))
    return updated
