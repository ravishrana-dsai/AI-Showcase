"""
Abstract base class for all collectors.
"""

import json
from abc import ABC, abstractmethod
from utils.logger import get_logger
from utils.rate_limiter import RateLimiter
from utils.diff_engine import compute_hash
from db import database


class BaseCollector(ABC):
    signal_type: str = "unknown"

    def __init__(self, competitor_id: str):
        self.competitor_id = competitor_id
        self.rate_limiter = RateLimiter()
        self.logger = get_logger(f"{self.__class__.__name__}[{competitor_id}]")

    @abstractmethod
    def collect(self) -> list[dict]:
        """
        Collect signals for this competitor.
        Returns a list of raw signal dicts, each with at minimum:
          - content: str or dict (the payload)
          - source_url: str (optional)
        """

    def run(self) -> int:
        """
        Execute collection, deduplicate, and persist to DB.
        Returns the number of new signals saved.
        """
        try:
            signals = self.collect()
        except Exception as e:
            self.logger.error("Collection failed", error=str(e))
            return 0

        saved = 0
        for signal in signals:
            content = signal.get("content", "")
            if isinstance(content, dict):
                content_str = json.dumps(content, sort_keys=True)
            else:
                content_str = str(content)

            content_hash = compute_hash(content_str)
            source_url = signal.get("source_url")

            result = database.insert_raw_signal(
                competitor_id=self.competitor_id,
                signal_type=self.signal_type,
                raw_content=content_str,
                content_hash=content_hash,
                source_url=source_url,
            )
            if result is not None:
                saved += 1

        self.logger.info("Collection complete", new_signals=saved, total=len(signals))
        return saved
