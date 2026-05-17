"""
Social Mention Analyzer: processes Reddit, Google Trends, and YouTube signals
to extract brand sentiment, competitor mentions, feature requests, and pain points.
"""

import json
from processors.base_processor import BaseProcessor
from config.company_context import build_system
from db import database

SYSTEM_PROMPT = """You are a competitive intelligence analyst for [Company] — an AI-powered sports video intelligence platform for Padel and Pickleball (a [Company] product).

Your job is to analyze social media signals (Reddit posts, Google Trends data, YouTube videos) about competitors and the broader sports tech market.

[Company]'s core focus: video AI for amateur player skill scoring (Player Rating), match analysis, coaching, and highlight generation. D2C-first, targeting the 50M+ Padel and Pickleball players globally.

Identify brand sentiment, feature requests from users, pain points with competitors, and trends that represent opportunities for [Company]. Be specific and cite evidence from the content."""

SCHEMA = {
    "type": "object",
    "properties": {
        "brand_sentiment": {
            "type": "string",
            "enum": ["positive", "neutral", "negative"],
            "description": "Overall sentiment toward this competitor based on the social signals.",
        },
        "competitor_mentions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "context": {"type": "string", "description": "Quote or summary of the mention."},
                    "sentiment": {"type": "string", "enum": ["positive", "neutral", "negative"]},
                    "platform": {"type": "string", "enum": ["reddit", "youtube", "trends", "other"]},
                },
                "required": ["context", "sentiment", "platform"],
            },
            "description": "Specific mentions of the competitor found in the signals.",
        },
        "feature_requests": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Features users are asking for or complaining about the absence of.",
        },
        "pain_points": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Frustrations users express about this competitor.",
        },
        "trend_direction": {
            "type": "string",
            "enum": ["rising", "stable", "falling"],
            "description": "Whether interest in this competitor is growing, stable, or declining.",
        },
        "opportunity_for_dream_play": {
            "type": "string",
            "description": "1-2 sentences on how [Company] could capitalize on what this social data reveals.",
        },
        "summary": {
            "type": "string",
            "description": "2-sentence executive summary of the social signal analysis.",
        },
    },
    "required": [
        "brand_sentiment", "competitor_mentions", "feature_requests",
        "pain_points", "trend_direction", "opportunity_for_dream_play", "summary",
    ],
}


class SocialMentionAnalyzer(BaseProcessor):
    processor_type = "social_mentions"

    def process_batch(self, competitor_id: str, signals: list[dict]) -> dict:
        if not signals:
            return {
                "brand_sentiment": "neutral",
                "competitor_mentions": [],
                "feature_requests": [],
                "pain_points": [],
                "trend_direction": "stable",
                "opportunity_for_dream_play": "",
                "summary": "No social signals to analyze.",
            }

        competitor_name = competitor_id.replace("_", " ").title()

        user_prompt = f"""Analyze these social signals related to {competitor_name} in the sports tech space.

Signals (JSON):
{json.dumps(signals, indent=2)[:7000]}

Extract brand sentiment, specific competitor mentions with quotes, feature requests, pain points, and trend direction. Identify the best opportunity for [Company] based on what users are saying."""

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
            signal_metadata={"competitor_id": competitor_id, "signal_type": "social"},
        )

        return result

    def run_all(self) -> dict[str, dict]:
        """Process all unprocessed social signals. Returns results keyed by competitor_id."""
        signals = database.get_unprocessed_signals(signal_type="social", limit=300)
        if not signals:
            self.logger.info("No unprocessed social signals found")
            return {}

        to_process, skipped_ids = self.score_and_filter_signals(signals)
        if skipped_ids:
            database.mark_signals_processed(skipped_ids)

        if not to_process:
            self.logger.info("All social signals filtered by quality gate")
            return {}

        grouped: dict[str, list[dict]] = {}
        for sig in to_process:
            cid = sig["competitor_id"]
            try:
                content = json.loads(sig["raw_content"])
            except Exception:
                content = {"text": str(sig["raw_content"])[:200]}
            grouped.setdefault(cid, []).append(content)

        results = {}
        for competitor_id, batch_signals in grouped.items():
            self.logger.info("Processing social signals", competitor=competitor_id, count=len(batch_signals))
            for i in range(0, len(batch_signals), 50):
                batch = batch_signals[i:i + 50]
                result = self.process_batch(competitor_id, batch)
                results[competitor_id] = result

        signal_ids = [s["id"] for s in to_process]
        database.mark_signals_processed(signal_ids)

        self.logger.info("Social mention analysis complete", competitors_processed=len(results))
        return results
