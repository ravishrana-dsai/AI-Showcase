"""
Pricing Tracker: analyzes pricing page changes, tier structure, and ARPU estimates.
"""

import json
from processors.base_processor import BaseProcessor
from config.company_context import build_system
from db import database

SYSTEM_PROMPT = """You are a pricing intelligence analyst for [Company], an AI sports video platform for Padel and Pickleball (D2C subscription model).

Analyze competitor pricing pages to extract:
- Pricing tiers and prices
- What's included at each tier
- Free trial or freemium offerings
- B2B vs B2C pricing signals
- Enterprise/custom pricing indicators
- ARPU estimates

[Company] context: D2C subscription targeting amateur players. Need to understand where to position pricing relative to competitors."""

SCHEMA = {
    "type": "object",
    "properties": {
        "tiers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "price_monthly": {"type": "string", "description": "Monthly price or 'contact us' or 'free'"},
                    "price_annual": {"type": "string"},
                    "target_segment": {"type": "string", "enum": ["consumer", "club", "coach", "enterprise", "unknown"]},
                    "key_features": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["name", "price_monthly", "target_segment"],
            },
        },
        "has_free_tier": {"type": "boolean"},
        "has_free_trial": {"type": "boolean"},
        "primary_model": {
            "type": "string",
            "enum": ["subscription", "one_time", "usage_based", "freemium", "b2b_only", "unknown"],
        },
        "estimated_consumer_arpu_monthly": {
            "type": "string",
            "description": "Best estimate of consumer monthly ARPU, e.g. '$15-25'",
        },
        "pricing_vs_dream_play": {
            "type": "string",
            "description": "Relative positioning: 'cheaper', 'similar', 'more expensive', 'incomparable'",
        },
        "notable_changes": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Any changes from previous version (populate if diff provided)",
        },
        "summary": {"type": "string"},
    },
    "required": ["tiers", "has_free_tier", "primary_model", "estimated_consumer_arpu_monthly", "summary"],
}


class PricingTracker(BaseProcessor):
    processor_type = "pricing"

    def process(self, competitor_id: str, competitor_name: str, pricing_content: str, diff_summary: str = "") -> dict:
        diff_context = f"\n\nPrevious vs current diff:\n{diff_summary}" if diff_summary else ""

        user_prompt = f"""Analyze the pricing page for {competitor_name}.

Pricing page content:
{pricing_content[:5000]}
{diff_context}

Extract tiers, prices, target segments, estimate ARPU, and compare positioning vs [Company]'s D2C subscription model."""

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
            signal_metadata={"competitor_id": competitor_id, "signal_type": "pricing"},
        )

        return result

    def run_all(self) -> dict[str, dict]:
        signals = database.get_unprocessed_signals(signal_type="pricing", limit=100)
        if not signals:
            self.logger.info("No unprocessed pricing signals found")
            return {}

        # Quality gate: score and filter before LLM processing
        to_process, skipped_ids = self.score_and_filter_signals(signals)
        if skipped_ids:
            database.mark_signals_processed(skipped_ids)

        if not to_process:
            self.logger.info("All pricing signals filtered by quality gate")
            return {}

        results = {}
        for sig in to_process:
            competitor_id = sig["competitor_id"]
            try:
                content = json.loads(sig["raw_content"])
                text = content.get("text", "") or str(content)
                name = content.get("name", competitor_id)
            except Exception:
                text = sig["raw_content"]
                name = competitor_id

            self.logger.info("Processing pricing", competitor=competitor_id)
            results[competitor_id] = self.process(competitor_id, name, text)

        signal_ids = [s["id"] for s in to_process]
        database.mark_signals_processed(signal_ids)
        return results
