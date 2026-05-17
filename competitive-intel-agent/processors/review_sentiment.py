"""
Review Sentiment processor: extracts pain points, praise themes, and feature requests
from app store reviews across competitors.
"""

import json
from processors.base_processor import BaseProcessor
from config.company_context import build_system
from db import database

SYSTEM_PROMPT = """You are a product intelligence analyst for [Company] — an AI-powered sports video platform for Padel and Pickleball.

Analyze competitor app reviews to extract:
1. Recurring pain points (frustrations, bugs, missing features)
2. Praise themes (what users love)
3. Feature requests (explicitly requested features)
4. Overall sentiment trend

This data will feed into [Company]'s product roadmap and positioning. Be specific and quote directly from reviews where possible."""

SCHEMA = {
    "type": "object",
    "properties": {
        "pain_points": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "theme": {"type": "string"},
                    "frequency": {"type": "integer", "description": "Approximate number of reviews mentioning this"},
                    "severity": {"type": "string", "enum": ["minor", "moderate", "critical"]},
                    "example_quote": {"type": "string"},
                    "dream_play_opportunity": {"type": "string", "description": "How [Company] could address this gap"},
                },
                "required": ["theme", "frequency", "severity", "example_quote"],
            },
        },
        "praise_themes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "theme": {"type": "string"},
                    "frequency": {"type": "integer"},
                    "example_quote": {"type": "string"},
                },
                "required": ["theme", "frequency"],
            },
        },
        "feature_requests": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "feature": {"type": "string"},
                    "frequency": {"type": "integer"},
                    "priority_for_dream_play": {"type": "string", "enum": ["low", "medium", "high"]},
                },
                "required": ["feature", "frequency", "priority_for_dream_play"],
            },
        },
        "avg_rating": {"type": "number"},
        "sentiment_trend": {
            "type": "string",
            "enum": ["improving", "stable", "declining"],
        },
        "nps_estimate": {
            "type": "integer",
            "description": "Estimated NPS -100 to +100 based on review sentiment",
        },
        "summary": {"type": "string"},
    },
    "required": ["pain_points", "praise_themes", "feature_requests", "sentiment_trend", "summary"],
}


class ReviewSentimentProcessor(BaseProcessor):
    processor_type = "review_sentiment"

    def process_batch(self, competitor_id: str, reviews: list[dict]) -> dict:
        if not reviews:
            return {"pain_points": [], "praise_themes": [], "feature_requests": [],
                    "sentiment_trend": "stable", "summary": "No reviews to analyze."}

        competitor_name = reviews[0].get("competitor_id", competitor_id)

        user_prompt = f"""Analyze these app store reviews for {competitor_name}.

Reviews (JSON, most recent first):
{json.dumps(reviews, indent=2)[:7000]}

Extract pain points, praise themes, feature requests, and estimate sentiment trend. Note opportunities for [Company] where competitors are failing users."""

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
            signal_metadata={"competitor_id": competitor_id, "signal_type": "app_review"},
        )

        return result

    def run_all(self) -> dict[str, dict]:
        signals = database.get_unprocessed_signals(signal_type="app_review", limit=300)
        if not signals:
            self.logger.info("No unprocessed app reviews found")
            return {}

        # Quality gate: score and filter before LLM processing
        to_process, skipped_ids = self.score_and_filter_signals(signals)
        if skipped_ids:
            database.mark_signals_processed(skipped_ids)

        if not to_process:
            self.logger.info("All app review signals filtered by quality gate")
            return {}

        grouped: dict[str, list[dict]] = {}
        for sig in to_process:
            cid = sig["competitor_id"]
            try:
                content = json.loads(sig["raw_content"])
            except Exception:
                content = {"text": sig["raw_content"][:500]}
            grouped.setdefault(cid, []).append(content)

        results = {}
        for competitor_id, reviews in grouped.items():
            self.logger.info("Processing reviews", competitor=competitor_id, count=len(reviews))
            for i in range(0, len(reviews), 40):
                batch = reviews[i:i + 40]
                results[competitor_id] = self.process_batch(competitor_id, batch)

        signal_ids = [s["id"] for s in to_process]
        database.mark_signals_processed(signal_ids)
        return results
