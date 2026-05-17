from __future__ import annotations
"""
Self-Evaluator: grades processed_intelligence quality using claude-haiku-4-5.
Runs post-insert to score specificity, novelty, and actionability.
Uses Haiku (~$0.0003/call) rather than Sonnet to minimize cost impact.
"""

import json
from utils.llm_client import get_llm_client
from config.company_context import build_system
from utils.logger import get_logger
from db import database

logger = get_logger(__name__)

HAIKU_MODEL = "claude-haiku-4-5"

EVAL_SYSTEM_PROMPT = """You are a quality evaluator for competitive intelligence reports at [Company].
[Company] is an AI video analysis platform for padel and pickleball courts.

Score the provided competitive intelligence report on three dimensions (0-10 each):
- specificity: Does it contain concrete facts, names, numbers, specific claims? (vs vague generalizations)
- novelty_vs_prior: Does it surface new information? (vs repeating known baseline facts)
- actionability: Could [Company]'s product or strategy team directly act on this insight?

Be strict. Reserve 8+ for immediately useful intelligence a PM would act on today.
A generic summary of publicly known information scores 2-4.

Output valid JSON only - no markdown, no commentary outside the JSON."""

EVAL_SCHEMA = {
    "type": "object",
    "properties": {
        "specificity": {"type": "integer", "minimum": 0, "maximum": 10},
        "novelty_vs_prior": {"type": "integer", "minimum": 0, "maximum": 10},
        "actionability": {"type": "integer", "minimum": 0, "maximum": 10},
        "composite": {"type": "number", "description": "0.3*specificity + 0.3*novelty + 0.4*actionability"},
        "reasoning": {"type": "string", "description": "1-2 sentences explaining the composite score"},
        "top_weakness": {"type": "string", "description": "The single biggest quality gap in this output"},
    },
    "required": ["specificity", "novelty_vs_prior", "actionability", "composite", "reasoning"],
}

_DEFAULT_EVAL = {
    "specificity": 5,
    "novelty_vs_prior": 5,
    "actionability": 5,
    "composite": 5.0,
    "reasoning": "Eval unavailable.",
    "top_weakness": "Could not evaluate.",
}


class SelfEvaluator:
    """Post-LLM quality scorer. One Haiku call per processed_intelligence row."""

    def evaluate(
        self,
        intelligence_id: int,
        processor_type: str,
        analysis_json: str,
        signal_metadata: dict | None = None,
    ) -> dict:
        """
        Score a processed_intelligence row. Persists score + eval_notes.
        Returns the eval dict. Never raises - logs and returns defaults on failure.
        """
        try:
            llm = get_llm_client()
            prompt = self._build_prompt(processor_type, analysis_json, signal_metadata or {}, intelligence_id)
            result = llm.complete(
                system=build_system(EVAL_SYSTEM_PROMPT),
                user=prompt,
                schema=EVAL_SCHEMA,
                max_tokens=512,
                model_override=HAIKU_MODEL,
            )
            # Compute composite if not provided or out of range
            composite = float(result.get("composite") or (
                0.3 * result.get("specificity", 5)
                + 0.3 * result.get("novelty_vs_prior", 5)
                + 0.4 * result.get("actionability", 5)
            ))
            result["composite"] = round(composite, 2)
            database.update_intelligence_eval(
                intelligence_id=intelligence_id,
                confidence_score=composite,
                eval_notes=json.dumps(result),
            )
            logger.info(
                "Self-eval complete",
                intelligence_id=intelligence_id,
                processor_type=processor_type,
                composite=composite,
            )
            return result
        except Exception as exc:
            logger.warning("Self-eval error", intelligence_id=intelligence_id, error=str(exc))
            return _DEFAULT_EVAL

    def _build_prompt(
        self,
        processor_type: str,
        analysis_json: str,
        signal_metadata: dict,
        intelligence_id: int,
    ) -> str:
        # Truncate analysis to keep Haiku prompt cheap (< 1500 tokens total)
        truncated = analysis_json[:1400] if len(analysis_json) > 1400 else analysis_json

        # Fetch prior summaries for novelty comparison
        prior_context = ""
        try:
            competitor_id = signal_metadata.get("competitor_id", "")
            if competitor_id and processor_type:
                with database.get_db() as conn:
                    rows = conn.execute(
                        """SELECT summary FROM processed_intelligence
                           WHERE competitor_id=? AND processor_type=? AND id != ?
                           ORDER BY created_at DESC LIMIT 2""",
                        (competitor_id, processor_type, intelligence_id),
                    ).fetchall()
                if rows:
                    prior_summaries = [r[0] or "" for r in rows if r[0]]
                    if prior_summaries:
                        joined = "\n---\n".join(s[:200] for s in prior_summaries)
                        prior_context = "\n\nFor novelty scoring, prior summaries for this competitor+processor:\n" + joined
        except Exception:
            pass  # Prior context is optional

        competitor_id = signal_metadata.get("competitor_id", "unknown")
        signal_type = signal_metadata.get("signal_type", "unknown")

        return (
            f"Competitor: {competitor_id}\n"
            f"Processor: {processor_type}\n"
            f"Signal type: {signal_type}\n\n"
            f"Intelligence output to evaluate:\n{truncated}"
            f"{prior_context}"
        )

    def evaluate_batch(self, intelligence_ids: list[int]) -> list[dict]:
        """Evaluate a list of unscored rows. Used for backfill."""
        results = []
        for intel_id in intelligence_ids:
            try:
                with database.get_db() as conn:
                    row = conn.execute(
                        "SELECT * FROM processed_intelligence WHERE id=?", (intel_id,)
                    ).fetchone()
                if not row:
                    continue
                row_dict = dict(row)
                result = self.evaluate(
                    intelligence_id=intel_id,
                    processor_type=row_dict.get("processor_type", ""),
                    analysis_json=row_dict.get("analysis_json", ""),
                    signal_metadata={"competitor_id": row_dict.get("competitor_id", "")},
                )
                results.append(result)
            except Exception as exc:
                logger.warning("Batch eval failed for row", intel_id=intel_id, error=str(exc))
        return results
