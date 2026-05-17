"""
Trend Analyzer: synthesizes all weekly signals and generates feature PRDs for [Company].
Two-pass approach: synthesis first, then PRD generation with dedup.
"""

import json
from datetime import datetime, date
from processors.base_processor import BaseProcessor
from config.company_context import build_system
from db import database
from utils.logger import get_logger

logger = get_logger(__name__)

SYNTHESIS_SYSTEM = """You are a senior product strategist for [Company] — an AI sports video intelligence platform for Padel and Pickleball ([Company] AI product).

Your role is to synthesize all competitive intelligence and market trend signals collected this week and identify the most compelling product opportunities for [Company].

[Company] context:
- Core product: Video AI skill rating (Player Rating), match analysis, coaching, highlights
- Sports: Padel and Pickleball
- Stage: MVP launched Dec 2025, 500+ users, 9 courts, 1,200+ matches in 3 months
- Tech stack: 20+ ML models, 10+ DL models, VLMs, proprietary sport-specific training data
- Positioning: D2C-first (Strava of racquet sports), not B2B court infrastructure
- Key moat: 18 months to build, $200M dataset replacement cost

Identify white spaces, emerging opportunities, and unmet player needs that [Company] is uniquely positioned to address."""

PRD_SYSTEM = """You are a senior product manager at [Company] — an AI sports video platform for Padel and Pickleball.

Write a detailed, actionable PRD for the specified feature opportunity. The PRD should be:
- Grounded in the evidence from the weekly intelligence synthesis
- Realistic given [Company]'s current tech stack and stage (MVP, early growth)
- Specific enough for an engineering team to scope in a sprint planning session
- Prioritized with clear success metrics

[Company]'s existing capabilities: video AI, court detection, ball tracking, player detection/pose, shot classification, rally segmentation, VLMs for analysis, D2C app."""

SYNTHESIS_SCHEMA = {
    "type": "object",
    "properties": {
        "emerging_tech_patterns": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Tech patterns becoming viable (e.g., on-device inference, multimodal AI)",
        },
        "market_behavior_shifts": {
            "type": "array",
            "items": {"type": "string"},
        },
        "unmet_player_needs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "need": {"type": "string"},
                    "evidence": {"type": "string"},
                    "frequency_signal": {"type": "string"},
                },
                "required": ["need", "evidence"],
            },
        },
        "white_spaces": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "opportunity": {"type": "string"},
                    "why_now": {"type": "string"},
                    "dream_play_advantage": {"type": "string"},
                },
                "required": ["opportunity", "why_now"],
            },
        },
        "threat_signals": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "competitor": {"type": "string"},
                    "threat": {"type": "string"},
                    "timeline": {"type": "string"},
                },
                "required": ["competitor", "threat"],
            },
        },
        "top_prd_candidates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "feature_concept": {"type": "string"},
                    "one_line": {"type": "string"},
                    "priority": {"type": "integer", "description": "1-10, 10 = highest"},
                    "effort": {"type": "string", "enum": ["S", "M", "L"]},
                    "evidence_summary": {"type": "string"},
                },
                "required": ["feature_concept", "one_line", "priority", "effort", "evidence_summary"],
            },
            "description": "Top 5 feature concepts to generate PRDs for this week",
        },
    },
    "required": ["white_spaces", "unmet_player_needs", "top_prd_candidates"],
}

PRD_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "feature_slug": {"type": "string", "description": "URL-safe slug, e.g. 'ai-shot-coaching-v2'"},
        "problem_statement": {"type": "string"},
        "target_user_segment": {"type": "string"},
        "proposed_solution": {"type": "string"},
        "user_stories": {
            "type": "array",
            "items": {"type": "string"},
            "description": "5-8 user stories in 'As a [user], I want to [action], so that [outcome]' format",
        },
        "success_metrics": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "metric": {"type": "string"},
                    "target": {"type": "string"},
                    "measurement": {"type": "string"},
                },
                "required": ["metric", "target"],
            },
        },
        "technical_feasibility": {"type": "string"},
        "competitive_context": {"type": "string"},
        "priority_score": {"type": "integer"},
        "effort": {"type": "string", "enum": ["S", "M", "L"]},
        "open_questions": {
            "type": "array",
            "items": {"type": "string"},
        },
        "concept_summary": {
            "type": "string",
            "description": "2-3 sentence summary of what this feature does and why — used for deduplication",
        },
    },
    "required": ["title", "feature_slug", "problem_statement", "proposed_solution",
                 "user_stories", "success_metrics", "concept_summary"],
}


class TrendAnalyzer(BaseProcessor):
    processor_type = "trend_analysis"

    def _get_iso_week(self) -> str:
        today = date.today()
        return f"{today.isocalendar()[0]}-W{today.isocalendar()[1]:02d}"

    def synthesize(self) -> dict:
        """Pass 1: Synthesize all weekly signals into opportunities."""
        # Gather all signals from this week
        raw_trend_signals = database.get_unprocessed_signals(signal_type="trend", limit=100)
        news_signals = database.get_unprocessed_signals(signal_type="news", limit=50)

        # Quality gate on trend signals
        trend_signals, skipped_trend_ids = self.score_and_filter_signals(raw_trend_signals)
        if skipped_trend_ids:
            database.mark_signals_processed(skipped_trend_ids)

        # Get recent processed intelligence summaries
        from config.competitors import get_active_competitors, COMPETITORS
        competitors = get_active_competitors()
        intel_summaries = []
        for competitor_id in list(competitors.keys())[:10]:
            for proc_type in ("news_digest", "review_sentiment", "feature_gap", "hiring_signals"):
                intel = database.get_latest_intelligence(competitor_id, proc_type)
                if intel and intel.get("summary"):
                    name = COMPETITORS.get(competitor_id, {}).get("name", competitor_id)
                    intel_summaries.append(f"[{name} / {proc_type}]: {intel['summary']}")

        # Format trend signals
        trend_items = []
        for sig in trend_signals[:40]:
            try:
                content = json.loads(sig["raw_content"])
                trend_items.append({
                    "source": content.get("source", ""),
                    "title": content.get("title", ""),
                    "summary": content.get("summary", "")[:200],
                    "category": content.get("signal_category", ""),
                })
            except Exception:
                pass

        user_prompt = f"""Synthesize the following signals collected this week to identify product opportunities for [Company].

TREND & MARKET SIGNALS ({len(trend_items)} items):
{json.dumps(trend_items, indent=2)[:4000]}

COMPETITOR INTELLIGENCE SUMMARIES:
{chr(10).join(intel_summaries[:20])}

Identify: white spaces, unmet player needs, emerging tech patterns, and threat signals.
Select the top 5 feature concepts to turn into PRDs this week."""

        result = self.llm.complete(
            system=build_system(SYNTHESIS_SYSTEM),
            user=user_prompt,
            schema=SYNTHESIS_SCHEMA,
            max_tokens=6000,
        )

        # Mark trend signals as processed
        if trend_signals:
            signal_ids = [s["id"] for s in trend_signals]
            database.mark_signals_processed(signal_ids)

        return result

    def generate_prds(self, synthesis: dict) -> list[dict]:
        """Pass 2: Generate PRDs for top candidates, with deduplication."""
        from outputs.prd_generator import save_prd, is_duplicate

        candidates = synthesis.get("top_prd_candidates", [])
        if not candidates:
            logger.info("No PRD candidates from synthesis")
            return []

        week = self._get_iso_week()
        recent_summaries = database.get_recent_prd_summaries(limit=30)
        existing_hashes = database.get_prd_concept_hashes()

        generated_prds = []

        for candidate in candidates[:5]:
            concept = candidate.get("feature_concept", "")
            one_line = candidate.get("one_line", "")

            # Layer 1: exact hash dedup
            from utils.diff_engine import compute_hash
            concept_hash = compute_hash(one_line + concept)
            if concept_hash in existing_hashes:
                logger.info("PRD skipped (exact duplicate)", concept=one_line[:50])
                continue

            # Layer 2: semantic dedup
            if recent_summaries:
                if is_duplicate(concept + " " + one_line, recent_summaries, self.llm):
                    logger.info("PRD skipped (semantic duplicate)", concept=one_line[:50])
                    continue

            # Generate full PRD
            logger.info("Generating PRD", concept=one_line[:60])
            user_prompt = f"""Generate a detailed PRD for the following [Company] feature opportunity.

Feature concept: {concept}
One-line description: {one_line}
Priority: {candidate.get('priority', 7)}/10
Effort estimate: {candidate.get('effort', 'M')}
Evidence: {candidate.get('evidence_summary', '')}

Write a complete, detailed PRD that an engineering team can act on."""

            prd = self.llm.complete(
                system=build_system(PRD_SYSTEM),
                user=user_prompt,
                schema=PRD_SCHEMA,
                max_tokens=4096,
            )

            if prd:
                prd["week"] = week
                save_prd(prd, week)
                generated_prds.append(prd)
                existing_hashes.add(concept_hash)  # Prevent duplicates within same run

        logger.info("PRD generation complete", generated=len(generated_prds), week=week)
        return generated_prds

    def run(self) -> list[dict]:
        """Run full trend analysis and PRD generation pipeline."""
        logger.info("Starting trend analysis")
        synthesis = self.synthesize()
        prds = self.generate_prds(synthesis)
        return prds
