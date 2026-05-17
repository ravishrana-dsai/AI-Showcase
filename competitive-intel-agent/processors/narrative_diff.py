"""
Narrative Diff Engine: compares competitor messaging vs [Company] positioning.
"""

import json
from processors.base_processor import BaseProcessor
from config.competitors import DREAM_PLAY_PROFILE
from config.company_context import build_system
from db import database

SYSTEM_PROMPT = """You are a brand strategist for [Company] — an AI sports video platform for Padel and Pickleball.

Analyze competitor marketing copy and messaging, then compare it to [Company]'s positioning.

[Company]'s positioning: "We turn raw match footage into structured performance intelligence — giving amateur players a scientific skill rating, game analysis, coaching insights, and personalised content."

Key [Company] narratives:
- Player Rating as the performance currency of the ecosystem
- Video AI as the foundation of a new Sports Intelligence Engine
- D2C consumer intelligence (Strava of racquet sports), not just B2B court infrastructure
- Data moat: 18 months + 1,000+ matches to build
- Market timing: Padel/Pickleball at inflection point"""

SCHEMA = {
    "type": "object",
    "properties": {
        "their_positioning": {
            "type": "string",
            "description": "Their core positioning statement in 1-2 sentences",
        },
        "primary_audience": {
            "type": "string",
            "enum": ["consumer_players", "club_owners", "coaches", "facility_operators", "broadcasters", "mixed"],
        },
        "messaging_themes": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Key messaging themes they use (e.g. 'performance improvement', 'court management')",
        },
        "overlap_with_dream_play": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Areas where messaging overlaps with [Company] (potential direct competition)",
        },
        "differentiation_from_dream_play": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Where they position differently from [Company]",
        },
        "claims_to_counter": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim": {"type": "string"},
                    "counter": {"type": "string", "description": "How [Company] should counter this claim"},
                },
                "required": ["claim", "counter"],
            },
        },
        "borrowed_narrative_opportunities": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Messaging angles they use that [Company] could adopt or improve on",
        },
        "summary": {"type": "string"},
    },
    "required": ["their_positioning", "primary_audience", "messaging_themes",
                 "overlap_with_dream_play", "differentiation_from_dream_play", "summary"],
}


class NarrativeDiffEngine(BaseProcessor):
    processor_type = "narrative"

    def process(self, competitor_id: str, competitor_name: str, web_content: str) -> dict:
        user_prompt = f"""Analyze {competitor_name}'s marketing messaging and compare it to [Company]'s positioning.

{competitor_name} website/marketing content:
{web_content[:5000]}

How do they position themselves? Where do they overlap with [Company]? What claims should [Company] counter?"""

        result = self.llm.complete(
            system=build_system(SYSTEM_PROMPT),
            user=user_prompt,
            schema=SCHEMA,
        )

        analysis_json = json.dumps(result)
        intel_id = database.insert_processed_intelligence(
            competitor_id=competitor_id,
            processor_type=self.processor_type,
            analysis_json=analysis_json,
            summary=result.get("summary", ""),
        )
        self.eval_after_insert(
            intelligence_id=intel_id,
            processor_type=self.processor_type,
            analysis_json=analysis_json,
            signal_metadata={"competitor_id": competitor_id, "signal_type": "web_page"},
        )

        return result

    def run_all(self) -> dict[str, dict]:
        signals = database.get_unprocessed_signals(signal_type="web_page", limit=100)
        if not signals:
            self.logger.info("No unprocessed web page signals found for narrative diff")
            return {}

        # Quality gate: score and filter before LLM processing
        to_process, skipped_ids = self.score_and_filter_signals(signals)
        if skipped_ids:
            database.mark_signals_processed(skipped_ids)

        if not to_process:
            self.logger.info("All web page signals filtered by quality gate (narrative diff)")
            return {}

        results = {}
        for sig in to_process:
            competitor_id = sig["competitor_id"]
            try:
                content = json.loads(sig["raw_content"])
                text = content.get("text", "") or content.get("content", "") or str(content)
                name = content.get("name", competitor_id)
            except Exception:
                text = sig["raw_content"]
                name = competitor_id

            self.logger.info("Processing narrative diff", competitor=competitor_id)
            results[competitor_id] = self.process(competitor_id, name, text)

        signal_ids = [s["id"] for s in to_process]
        database.mark_signals_processed(signal_ids)
        return results
