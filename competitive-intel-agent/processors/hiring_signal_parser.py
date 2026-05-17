"""
Hiring Signal Parser: infers competitor product roadmap direction from job postings.
"""

import json
from processors.base_processor import BaseProcessor
from config.company_context import build_system
from db import database

SYSTEM_PROMPT = """You are a competitive intelligence analyst for [Company], an AI sports video platform for Padel and Pickleball.

Analyze competitor job postings to infer their product roadmap, technology investments, and expansion signals.

Key things to look for:
- Engineering roles (ML/CV/AI) suggest video/AI capabilities being built
- Roles mentioning specific sports (padel/pickleball) suggest market expansion
- Product/design roles suggest specific feature work
- Sales/BD roles in specific geographies suggest market entry
- Leadership hires suggest strategic pivots

Be specific about inferences and cite the job titles as evidence."""

SCHEMA = {
    "type": "object",
    "properties": {
        "roadmap_inferences": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "inference": {"type": "string"},
                    "evidence": {"type": "string", "description": "Job title(s) that support this inference"},
                    "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
                    "relevance_to_dream_play": {"type": "string"},
                },
                "required": ["inference", "evidence", "confidence"],
            },
        },
        "tech_investments": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Technologies being actively invested in (based on job requirements)",
        },
        "expansion_signals": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "signal": {"type": "string"},
                    "type": {"type": "string", "enum": ["geography", "sport", "product_line", "segment"]},
                },
                "required": ["signal", "type"],
            },
        },
        "hiring_velocity": {
            "type": "string",
            "enum": ["contracting", "stable", "growing", "rapidly_growing"],
            "description": "Overall hiring pace signal",
        },
        "summary": {"type": "string"},
    },
    "required": ["roadmap_inferences", "tech_investments", "expansion_signals", "hiring_velocity", "summary"],
}


class HiringSignalParser(BaseProcessor):
    processor_type = "hiring_signals"

    def process(self, competitor_id: str, competitor_name: str, job_postings: list[dict]) -> dict:
        if not job_postings:
            return {
                "roadmap_inferences": [],
                "tech_investments": [],
                "expansion_signals": [],
                "hiring_velocity": "stable",
                "summary": "No job postings found.",
            }

        user_prompt = f"""Analyze these job postings for {competitor_name} and infer their product roadmap and strategic direction.

Job postings:
{json.dumps(job_postings, indent=2)[:6000]}

What is {competitor_name} building? What markets are they entering? What technologies are they investing in?
How does this affect [Company]'s competitive position?"""

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
            signal_metadata={"competitor_id": competitor_id, "signal_type": "job_posting"},
        )

        return result

    def run_all(self) -> dict[str, dict]:
        signals = database.get_unprocessed_signals(signal_type="job_posting", limit=200)
        if not signals:
            self.logger.info("No unprocessed job posting signals found")
            return {}

        # Separate relevant from irrelevant signals
        relevant_signals = []
        irrelevant_ids = []
        for sig in signals:
            try:
                content = json.loads(sig["raw_content"])
                title = content.get("title", "")
                # Check is_relevant field in payload (new signals)
                # Fall back to classifier for old signals without the field
                if "is_relevant" in content:
                    if not content["is_relevant"]:
                        irrelevant_ids.append(sig["id"])
                        continue
                else:
                    # Old signal -- classify by title
                    from collectors.job_postings import classify_job_relevance
                    if not classify_job_relevance(title):
                        irrelevant_ids.append(sig["id"])
                        continue
            except Exception:
                pass  # If parsing fails, include the signal
            relevant_signals.append(sig)

        # Mark irrelevant signals as processed so they don't clog the queue
        if irrelevant_ids:
            database.mark_signals_processed(irrelevant_ids)
            self.logger.info("Marked irrelevant job postings as processed", count=len(irrelevant_ids))

        if not relevant_signals:
            self.logger.info("No relevant job posting signals to process")
            return {}

        # Quality gate: score and filter before LLM processing
        to_process, skipped_ids = self.score_and_filter_signals(relevant_signals)
        if skipped_ids:
            database.mark_signals_processed(skipped_ids)

        if not to_process:
            self.logger.info("All relevant job posting signals filtered by quality gate")
            return {}

        # Continue with only quality-passing signals
        grouped: dict[str, list[dict]] = {}
        for sig in to_process:
            cid = sig["competitor_id"]
            try:
                content = json.loads(sig["raw_content"])
            except Exception:
                content = {"title": sig["raw_content"][:200]}
            grouped.setdefault(cid, []).append(content)

        results = {}
        for competitor_id, jobs in grouped.items():
            self.logger.info("Processing job postings", competitor=competitor_id, count=len(jobs))
            result = self.process(competitor_id, competitor_id, jobs)
            results[competitor_id] = result

        signal_ids = [s["id"] for s in to_process]
        database.mark_signals_processed(signal_ids)
        return results
