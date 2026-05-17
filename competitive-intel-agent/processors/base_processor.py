from __future__ import annotations
"""
Base processor: shared LLMClient, DB access, quality gate, and self-eval hooks
for all specialist processors.
"""

import json
import threading
from utils.llm_client import get_llm_client, LLMClient
from utils.logger import get_logger
from db import database


class BaseProcessor:
    processor_type: str = "unknown"

    def __init__(self):
        self.llm = get_llm_client()
        self.logger = get_logger(f"{self.__class__.__name__}")
        self.db = database

    # ------------------------------------------------------------------
    # Layer 1: Signal Quality Gate
    # ------------------------------------------------------------------

    def score_and_filter_signals(
        self,
        signals: list[dict],
    ) -> tuple[list[dict], list[int]]:
        """
        Score each signal with the quality gate. Persist scores to DB.
        Returns (signals_to_process, skipped_signal_ids).
        Signals scoring below SKIP_THRESHOLD are excluded from LLM processing.
        """
        from processors.signal_quality_gate import SignalQualityGate
        gate = SignalQualityGate()
        to_process: list[dict] = []
        skipped_ids: list[int] = []

        for sig in signals:
            try:
                raw = json.loads(sig.get("raw_content", "{}"))
            except Exception:
                raw = {}

            score, flags = gate.score(
                signal_type=sig.get("signal_type", ""),
                raw_content=raw,
                competitor_id=sig.get("competitor_id", ""),
            )
            gate.persist_quality(sig["id"], score, flags)

            if gate.should_skip(score):
                skipped_ids.append(sig["id"])
            else:
                to_process.append(sig)

        if skipped_ids:
            self.logger.info(
                "Quality gate filtered signals",
                total=len(signals),
                skipped=len(skipped_ids),
                passing=len(to_process),
            )

        return to_process, skipped_ids

    # ------------------------------------------------------------------
    # Layer 2: Output Self-Evaluation
    # ------------------------------------------------------------------

    def eval_after_insert(
        self,
        intelligence_id: int,
        processor_type: str,
        analysis_json: str,
        signal_metadata: dict | None = None,
    ) -> None:
        """
        Kick off a self-evaluation of a newly inserted processed_intelligence row.
        Runs in a daemon thread so it never blocks the calling processor.
        Never raises.
        """
        def _run():
            try:
                from processors.self_evaluator import SelfEvaluator
                evaluator = SelfEvaluator()
                evaluator.evaluate(
                    intelligence_id=intelligence_id,
                    processor_type=processor_type,
                    analysis_json=analysis_json,
                    signal_metadata=signal_metadata or {},
                )
            except Exception as exc:
                self.logger.warning(
                    "Self-eval failed (non-fatal)",
                    intelligence_id=intelligence_id,
                    error=str(exc),
                )

        t = threading.Thread(target=_run, daemon=True)
        t.start()
