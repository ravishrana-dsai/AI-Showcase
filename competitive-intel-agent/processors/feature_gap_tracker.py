"""
Feature Gap Tracker: extracts competitor feature lists and scores
completeness vs [Company]'s known feature set.
"""

import json
from processors.base_processor import BaseProcessor
from config.competitors import DREAM_PLAY_PROFILE
from config.company_context import build_system
from db import database

SYSTEM_PROMPT = """You are a product analyst for [Company] — an AI-powered sports video intelligence platform for Padel and Pickleball.

Your job is to extract the feature list from competitor website/marketing content and compare it to [Company]'s known features.

[Company]'s key features: video AI skill rating (Player Rating), shot analysis, match replay, movement heatmaps, rally analysis, coaching insights, highlight generation, skill scoring (TECH/TACT/PHY dimensions), matchmaking, tournament coverage.

Be objective and specific. Extract only features that are explicitly mentioned or strongly implied in the competitor content."""

SCHEMA = {
    "type": "object",
    "properties": {
        "competitor_features": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Features the competitor offers, in plain language",
        },
        "features_only_competitor_has": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Features the competitor has that [Company] does not (gaps for [Company])",
        },
        "features_only_dream_play_has": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Features [Company] has that this competitor does not ([Company] advantages)",
        },
        "shared_features": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Features both products offer",
        },
        "gap_score": {
            "type": "number",
            "description": "0.0-1.0. How complete is the competitor vs [Company]? 1.0 = fully matches [Company].",
        },
        "key_differentiators": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Top 3 ways this competitor differentiates from [Company]",
        },
        "threat_level": {
            "type": "string",
            "enum": ["low", "medium", "high", "critical"],
            "description": "How much of a competitive threat is this to [Company]?",
        },
        "summary": {"type": "string"},
    },
    "required": ["competitor_features", "features_only_competitor_has",
                 "features_only_dream_play_has", "shared_features",
                 "gap_score", "key_differentiators", "threat_level", "summary"],
}


class FeatureGapTracker(BaseProcessor):
    processor_type = "feature_gap"

    def process(self, competitor_id: str, competitor_name: str, web_content: str) -> dict:
        dream_play_features = ", ".join(DREAM_PLAY_PROFILE["features"])

        user_prompt = f"""Analyze the following website content for {competitor_name} and extract their feature set.
Then compare it to [Company]'s features.

[Company] features: {dream_play_features}

{competitor_name} website content:
{web_content[:5000]}

Extract competitor features, identify gaps (what they have that [Company] doesn't and vice versa), score completeness, and assess threat level."""

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
            confidence_score=result.get("gap_score"),
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
            self.logger.info("No unprocessed web page signals found")
            return {}

        # Quality gate: score and filter before LLM processing
        to_process, skipped_ids = self.score_and_filter_signals(signals)
        if skipped_ids:
            database.mark_signals_processed(skipped_ids)

        if not to_process:
            self.logger.info("All web page signals filtered by quality gate")
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

            self.logger.info("Processing web content", competitor=competitor_id)
            results[competitor_id] = self.process(competitor_id, name, text)

        signal_ids = [s["id"] for s in to_process]
        database.mark_signals_processed(signal_ids)
        return results
