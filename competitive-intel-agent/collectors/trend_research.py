"""
Trend research collector: gathers broad tech + sports trends from
Hacker News, arXiv, Product Hunt, and sports tech RSS feeds.
Not competitor-specific — competitor_id = "market".
"""

import json
import requests
import feedparser
from datetime import datetime, timedelta, timezone
from collectors.base_collector import BaseCollector
from utils.logger import get_logger

logger = get_logger(__name__)

TREND_KEYWORDS = [
    "sports analytics",
    "AI sports coaching",
    "computer vision sports",
    "player tracking",
    "video intelligence",
    "padel",
    "pickleball",
    "racquet sports AI",
    "sports performance AI",
    "pose estimation sports",
]

SPORTS_TECH_RSS = [
    "https://www.sporttechie.com/feed",
    "https://techcrunch.com/tag/sports/feed",
    "https://www.sportspromedia.com/feed",
]

ARXIV_CATEGORIES = ["cs.CV", "cs.AI", "eess.IV"]
ARXIV_KEYWORDS = [
    "sports tracking", "player detection", "ball detection",
    "pose estimation sport", "court detection", "action recognition sport",
    "video analytics sport",
]


class TrendResearchCollector(BaseCollector):
    signal_type = "trend"

    def __init__(self):
        super().__init__("market")

    def collect(self) -> list[dict]:
        results = []
        results.extend(self._collect_hacker_news())
        results.extend(self._collect_arxiv())
        results.extend(self._collect_product_hunt())
        results.extend(self._collect_sports_tech_rss())
        logger.info("Trend research collected", total=len(results))
        return results

    def _collect_hacker_news(self) -> list[dict]:
        """Hacker News Algolia API — no auth required."""
        results = []
        cutoff = datetime.now(timezone.utc) - timedelta(days=8)
        cutoff_ts = int(cutoff.timestamp())

        for keyword in TREND_KEYWORDS[:6]:
            try:
                self.rate_limiter.wait(domain="hn.algolia.com")
                resp = requests.get(
                    "https://hn.algolia.com/api/v1/search",
                    params={
                        "query": keyword,
                        "tags": "story",
                        "numericFilters": f"created_at_i>{cutoff_ts}",
                        "hitsPerPage": 5,
                    },
                    timeout=15,
                )
                resp.raise_for_status()
                data = resp.json()

                for hit in data.get("hits", []):
                    points = hit.get("points", 0)
                    if points < 5:
                        continue  # Filter low-signal items

                    item = {
                        "source": "hackernews",
                        "title": hit.get("title", ""),
                        "url": hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}",
                        "points": points,
                        "num_comments": hit.get("num_comments", 0),
                        "created_at": hit.get("created_at", ""),
                        "keyword_matched": keyword,
                        "signal_category": "tech_trend",
                        "competitor_id": "market",
                    }
                    results.append({"content": item, "source_url": item["url"]})

            except Exception as e:
                logger.error("HN collection failed", keyword=keyword, error=str(e))

        return results

    def _collect_arxiv(self) -> list[dict]:
        """arXiv API — free, no auth."""
        results = []
        from_date = (datetime.now() - timedelta(days=14)).strftime("%Y%m%d")

        for keyword in ARXIV_KEYWORDS[:4]:
            try:
                self.rate_limiter.wait(domain="export.arxiv.org")
                resp = requests.get(
                    "https://export.arxiv.org/api/query",
                    params={
                        "search_query": f"ti:{keyword} OR abs:{keyword}",
                        "start": 0,
                        "max_results": 5,
                        "sortBy": "submittedDate",
                        "sortOrder": "descending",
                    },
                    timeout=20,
                )
                resp.raise_for_status()

                feed = feedparser.parse(resp.text)
                for entry in feed.entries:
                    item = {
                        "source": "arxiv",
                        "title": entry.get("title", "").replace("\n", " "),
                        "url": entry.get("link", ""),
                        "summary": entry.get("summary", "")[:500],
                        "authors": [a.get("name", "") for a in entry.get("authors", [])[:3]],
                        "published": entry.get("published", ""),
                        "keyword_matched": keyword,
                        "signal_category": "research",
                        "competitor_id": "market",
                    }
                    results.append({"content": item, "source_url": item["url"]})

            except Exception as e:
                logger.error("arXiv collection failed", keyword=keyword, error=str(e))

        return results

    def _collect_product_hunt(self) -> list[dict]:
        """Product Hunt recent launches via public API (no auth for basic listing)."""
        results = []
        try:
            self.rate_limiter.wait(domain="api.producthunt.com")
            # Use the public posts endpoint (no auth needed for basic access)
            resp = requests.get(
                "https://www.producthunt.com/feed",
                headers={"User-Agent": "[Company]CI/1.0"},
                timeout=15,
            )

            if resp.status_code == 200:
                feed = feedparser.parse(resp.text)
                sports_keywords = ["sport", "padel", "pickleball", "tennis", "fitness", "coaching", "AI analytics"]

                for entry in feed.entries[:30]:
                    title_lower = (entry.get("title") or "").lower()
                    summary_lower = (entry.get("summary") or "").lower()

                    if not any(k in title_lower or k in summary_lower for k in sports_keywords):
                        continue

                    item = {
                        "source": "product_hunt",
                        "title": entry.get("title", ""),
                        "url": entry.get("link", ""),
                        "summary": (entry.get("summary") or "")[:400],
                        "published": entry.get("published", ""),
                        "signal_category": "product_launch",
                        "competitor_id": "market",
                    }
                    results.append({"content": item, "source_url": item["url"]})

        except Exception as e:
            logger.error("Product Hunt collection failed", error=str(e))

        return results

    def _collect_sports_tech_rss(self) -> list[dict]:
        """Sports tech RSS feeds — broader market signals."""
        results = []
        cutoff = datetime.now(timezone.utc) - timedelta(days=8)

        for feed_url in SPORTS_TECH_RSS:
            try:
                self.rate_limiter.wait(url=feed_url)
                feed = feedparser.parse(feed_url)

                for entry in feed.entries[:15]:
                    import time
                    pub_parsed = getattr(entry, "published_parsed", None)
                    if pub_parsed:
                        try:
                            pub_dt = datetime.fromtimestamp(time.mktime(pub_parsed), tz=timezone.utc)
                            if pub_dt < cutoff:
                                continue
                        except Exception:
                            pass

                    item = {
                        "source": "sports_tech_rss",
                        "feed": feed.feed.get("title", feed_url),
                        "title": entry.get("title", ""),
                        "url": entry.get("link", ""),
                        "summary": entry.get("summary", "")[:500],
                        "published": entry.get("published", ""),
                        "signal_category": "industry_news",
                        "competitor_id": "market",
                    }
                    results.append({"content": item, "source_url": item["url"]})

            except Exception as e:
                logger.error("Sports tech RSS failed", url=feed_url, error=str(e))

        return results
