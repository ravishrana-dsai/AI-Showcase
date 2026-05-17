"""
Master orchestrator: coordinates all specialist processors using
Claude's agentic tool-calling loop.
"""

import json
from processors.base_processor import BaseProcessor
from config.company_context import build_system
from processors.news_digest import NewsDigestProcessor
from processors.review_sentiment import ReviewSentimentProcessor
from processors.feature_gap_tracker import FeatureGapTracker
from processors.hiring_signal_parser import HiringSignalParser
from processors.pricing_tracker import PricingTracker
from processors.narrative_diff import NarrativeDiffEngine
from db import database
from utils.logger import get_logger

logger = get_logger(__name__)

ORCHESTRATOR_SYSTEM = """You are the competitive intelligence orchestrator for [Company] — an AI sports video platform for Padel and Pickleball.

You coordinate analysis of competitor signals collected this run. Based on what was collected, decide which analyses to run and in what order.

Available specialist tools:
- run_news_digest: Analyze news articles for relevance and key signals
- run_review_sentiment: Extract pain points and praise from app reviews
- run_feature_gap: Compare competitor features vs [Company]
- run_hiring_signals: Infer roadmap from job postings
- run_pricing_analysis: Analyze pricing changes and tier structure
- run_narrative_diff: Compare competitor messaging vs [Company]

After all analyses, synthesize the most important findings for the weekly brief.
Prioritize: funding events > pricing changes > feature launches > hiring signals > sentiment shifts > general news."""


class CIOrchestrator(BaseProcessor):

    def __init__(self):
        super().__init__()
        self.news_processor = NewsDigestProcessor()
        self.review_processor = ReviewSentimentProcessor()
        self.feature_processor = FeatureGapTracker()
        self.hiring_processor = HiringSignalParser()
        self.pricing_processor = PricingTracker()
        self.narrative_processor = NarrativeDiffEngine()

    def _get_tools(self) -> list[dict]:
        return [
            {
                "name": "run_news_digest",
                "description": "Process and analyze unprocessed news signals from all competitors",
                "input_schema": {"type": "object", "properties": {}, "required": []},
            },
            {
                "name": "run_review_sentiment",
                "description": "Analyze app store reviews for competitor pain points and sentiment",
                "input_schema": {"type": "object", "properties": {}, "required": []},
            },
            {
                "name": "run_feature_gap",
                "description": "Compare competitor features vs [Company] from scraped web content",
                "input_schema": {"type": "object", "properties": {}, "required": []},
            },
            {
                "name": "run_hiring_signals",
                "description": "Infer competitor roadmap from job postings",
                "input_schema": {"type": "object", "properties": {}, "required": []},
            },
            {
                "name": "run_pricing_analysis",
                "description": "Analyze pricing page content for changes and tier structure",
                "input_schema": {"type": "object", "properties": {}, "required": []},
            },
            {
                "name": "run_narrative_diff",
                "description": "Compare competitor messaging and positioning vs [Company]",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "competitor_id": {"type": "string"},
                        "web_content": {"type": "string"},
                    },
                    "required": [],
                },
            },
        ]

    def _handle_tool(self, tool_name: str, tool_input: dict) -> dict:
        """Execute the requested specialist tool and return results."""
        logger.info("Orchestrator calling specialist", tool=tool_name)
        try:
            if tool_name == "run_news_digest":
                return {"results": self.news_processor.run_all(), "status": "ok"}
            elif tool_name == "run_review_sentiment":
                return {"results": self.review_processor.run_all(), "status": "ok"}
            elif tool_name == "run_feature_gap":
                return {"results": self.feature_processor.run_all(), "status": "ok"}
            elif tool_name == "run_hiring_signals":
                return {"results": self.hiring_processor.run_all(), "status": "ok"}
            elif tool_name == "run_pricing_analysis":
                return {"results": self.pricing_processor.run_all(), "status": "ok"}
            elif tool_name == "run_narrative_diff":
                results = self.narrative_processor.run_all() if hasattr(self.narrative_processor, "run_all") else {}
                return {"results": results, "status": "ok"}
            else:
                return {"error": f"Unknown tool: {tool_name}", "status": "error"}
        except Exception as e:
            logger.error("Tool execution failed", tool=tool_name, error=str(e))
            return {"error": str(e), "status": "error"}

    def run_full_pipeline(self) -> str:
        """Run the full CI pipeline via the orchestrator agent."""
        # Get a summary of what's waiting to be processed
        unprocessed = database.get_unprocessed_signals(limit=10)
        signal_summary = {}
        for sig in unprocessed:
            signal_summary[sig["signal_type"]] = signal_summary.get(sig["signal_type"], 0) + 1

        # Get recent changes
        recent_changes = database.get_unalerted_changes()
        change_summary = [
            {"competitor": c["competitor_id"], "type": c["change_type"], "severity": c["severity"]}
            for c in recent_changes[:10]
        ]

        user_message = f"""New signals available for processing:
{json.dumps(signal_summary, indent=2)}

Recent unalerted changes:
{json.dumps(change_summary, indent=2)}

Run the appropriate analyses based on what's available. Then provide a synthesis of key findings."""

        logger.info("Starting orchestrated CI run", signal_counts=signal_summary)

        synthesis = self.llm.complete_with_tools(
            system=build_system(ORCHESTRATOR_SYSTEM),
            user=user_message,
            tools=self._get_tools(),
            tool_handler=self._handle_tool,
            max_iterations=8,
        )

        logger.info("Orchestrator run complete")
        return synthesis

    def run_targeted(self, signal_types: list[str]) -> dict:
        """Run only specific processors (for targeted/daily runs)."""
        results = {}
        type_map = {
            "news": self.news_processor.run_all,
            "app_review": self.review_processor.run_all,
            "web_page": self.feature_processor.run_all,
            "job_posting": self.hiring_processor.run_all,
            "pricing": self.pricing_processor.run_all,
        }
        for signal_type in signal_types:
            fn = type_map.get(signal_type)
            if fn:
                results[signal_type] = fn()
        return results
