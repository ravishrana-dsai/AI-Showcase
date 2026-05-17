"""
Patent filings collector: USPTO full-text API.
"""

import json
import requests
from datetime import datetime, timedelta, timezone
from collectors.base_collector import BaseCollector
from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

SPORTS_TECH_KEYWORDS = [
    "sports analytics", "video analysis sports", "player tracking",
    "ball detection", "court detection", "sports performance",
    "racquet sports", "padel", "pickleball",
]


class PatentCollector(BaseCollector):
    signal_type = "patent"

    def __init__(self, competitor_id: str, competitor_config: dict):
        super().__init__(competitor_id)
        self.config = competitor_config
        self.company_name = competitor_config.get("name", competitor_id)

    def collect(self) -> list[dict]:
        if not settings.enable_patents:
            return []

        results = []
        results.extend(self._collect_uspto())
        return results

    def _collect_uspto(self) -> list[dict]:
        """Search USPTO full-text search API (no auth required)."""
        try:
            query = f'"{self.company_name}" AND (padel OR pickleball OR "sports analytics" OR "video analysis")'
            self.rate_limiter.wait(domain="efts.uspto.gov")

            resp = requests.get(
                "https://efts.uspto.gov/LATEST/search-fields",
                params={
                    "query": query,
                    "dateRangeField": "filing_date",
                    "startdt": (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d"),
                    "enddt": datetime.now().strftime("%Y-%m-%d"),
                    "hits.hits._source": "patent_title,patent_abstract,assignee,filing_date,patent_number",
                    "hits.hits.total.value": 10,
                },
                timeout=20,
            )

            if resp.status_code != 200:
                return []

            data = resp.json()
            hits = data.get("hits", {}).get("hits", [])

            results = []
            for hit in hits:
                src = hit.get("_source", {})
                patent = {
                    "patent_number": src.get("patent_number", ""),
                    "title": src.get("patent_title", ""),
                    "abstract": (src.get("patent_abstract") or "")[:500],
                    "assignee": src.get("assignee", ""),
                    "filing_date": src.get("filing_date", ""),
                    "source": "uspto",
                    "competitor_id": self.competitor_id,
                }
                results.append({
                    "content": patent,
                    "source_url": f"https://patents.google.com/patent/{patent['patent_number']}",
                })

            logger.info("USPTO patents collected", competitor=self.competitor_id, count=len(results))
            return results

        except Exception as e:
            logger.error("USPTO collection failed", competitor=self.competitor_id, error=str(e))
            return []


def run_all_patent_collectors(competitors: dict) -> int:
    total = 0
    for competitor_id, config in competitors.items():
        if not config.get("active", False):
            continue
        collector = PatentCollector(competitor_id, config)
        total += collector.run()
    logger.info("Patent collection complete", total_new_signals=total)
    return total
