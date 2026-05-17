"""
News Digest processor: scores article relevance and extracts signal types.
"""

import json
from processors.base_processor import BaseProcessor
from config.company_context import build_system
from db import database

SYSTEM_PROMPT = """You are a competitive intelligence analyst for [Company] — an AI-powered sports video intelligence platform for Padel and Pickleball (a [Company] product).

Your job is to analyze news articles about competitors and the broader sports tech market, score their relevance, and classify the signal type.

[Company]'s core focus: video AI for amateur player skill scoring (Player Rating), match analysis, coaching, and highlight generation. D2C-first, targeting the 50M+ Padel and Pickleball players globally.

Be precise and concise. Focus on information that would affect [Company]'s strategy, product roadmap, or competitive positioning."""

SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "url": {"type": "string"},
                    "relevance_score": {
                        "type": "integer",
                        "description": "0-10. 10 = directly competitive to [Company]. 0 = irrelevant."
                    },
                    "signal_type": {
                        "type": "string",
                        "enum": ["funding", "product_launch", "partnership", "pricing_change",
                                 "expansion", "leadership_change", "acquisition", "market_trend", "other"],
                    },
                    "key_facts": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "2-4 bullet-point facts extracted from the article."
                    },
                    "dream_play_implication": {
                        "type": "string",
                        "description": "1 sentence on what this means for [Company]. Empty if irrelevant."
                    },
                },
                "required": ["title", "relevance_score", "signal_type", "key_facts", "dream_play_implication"],
            },
        },
        "top_insight": {
            "type": "string",
            "description": "The single most important insight from this batch for [Company]."
        },
    },
    "required": ["items", "top_insight"],
}


class NewsDigestProcessor(BaseProcessor):
    processor_type = "news_digest"

    def process_batch(self, competitor_id: str, articles: list[dict]) -> dict:
        """
        Process a batch of news articles for one competitor.
        Returns structured analysis dict.
        """
        if not articles:
            return {"items": [], "top_insight": "No articles to analyze."}

        competitor_name = articles[0].get("competitor_id", competitor_id)

        user_prompt = f"""Analyze these news articles about {competitor_name} (or the broader market).

Articles (JSON):
{json.dumps(articles, indent=2)[:6000]}

Score each article's relevance to [Company] (0-10), classify the signal type, extract key facts, and note the implication for [Company]'s strategy."""

        result = self.llm.complete(
            system=build_system(SYSTEM_PROMPT),
            user=user_prompt,
            schema=SCHEMA,
        )

        # Filter to only relevant articles (score >= 4)
        if isinstance(result, dict):
            result["items"] = [i for i in result.get("items", []) if i.get("relevance_score", 0) >= 4]

        # Persist to processed_intelligence
        analysis_json = json.dumps(result)
        intel_id = database.insert_processed_intelligence(
            competitor_id=competitor_id,
            processor_type=self.processor_type,
            analysis_json=analysis_json,
            summary=result.get("top_insight", ""),
        )
        self.eval_after_insert(
            intelligence_id=intel_id,
            processor_type=self.processor_type,
            analysis_json=analysis_json,
            signal_metadata={"competitor_id": competitor_id, "signal_type": "news"},
        )

        return result

    def run_all(self) -> dict[str, dict]:
        """Process all unprocessed news signals from DB. Returns results keyed by competitor_id."""
        signals = database.get_unprocessed_signals(signal_type="news", limit=200)
        if not signals:
            self.logger.info("No unprocessed news signals found")
            return {}

        # Quality gate: score and filter before LLM processing
        to_process, skipped_ids = self.score_and_filter_signals(signals)
        if skipped_ids:
            database.mark_signals_processed(skipped_ids)

        if not to_process:
            self.logger.info("All news signals filtered by quality gate")
            return {}

        # Group by competitor_id
        grouped: dict[str, list[dict]] = {}
        for sig in to_process:
            cid = sig["competitor_id"]
            try:
                content = json.loads(sig["raw_content"])
            except Exception:
                content = {"title": sig["raw_content"][:100]}
            grouped.setdefault(cid, []).append(content)

        results = {}
        for competitor_id, articles in grouped.items():
            self.logger.info("Processing news", competitor=competitor_id, count=len(articles))
            # Batch into groups of 30
            for i in range(0, len(articles), 30):
                batch = articles[i:i + 30]
                result = self.process_batch(competitor_id, batch)
                results[competitor_id] = result

        # Mark signals as processed
        signal_ids = [s["id"] for s in to_process]
        database.mark_signals_processed(signal_ids)

        self.logger.info("News digest complete", competitors_processed=len(results))
        return results
