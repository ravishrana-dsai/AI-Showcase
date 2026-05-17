from __future__ import annotations
"""
News feed collector: RSS (feedparser) + NewsAPI.
Collects news articles for each competitor based on keywords.
"""

import json
from datetime import datetime, timedelta, timezone
import feedparser
import requests
from collectors.base_collector import BaseCollector
from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

# General sports tech RSS feeds (always collected, competitor_id = "market")
GENERAL_RSS_FEEDS = [
    "https://www.sporttechie.com/feed",
    "https://techcrunch.com/tag/sports/feed",
    "https://venturebeat.com/category/ai/feed",
]


class NewsCollector(BaseCollector):
    signal_type = "news"

    def __init__(self, competitor_id: str, competitor_config: dict):
        super().__init__(competitor_id)
        self.config = competitor_config
        self.keywords = competitor_config.get("news_keywords", [competitor_config.get("name", "")])
        self.rss_feeds = competitor_config.get("rss_feeds", [])

    def collect(self) -> list[dict]:
        articles = []
        articles.extend(self._collect_rss())
        articles.extend(self._collect_newsapi())
        return articles

    def _collect_rss(self) -> list[dict]:
        results = []
        for feed_url in self.rss_feeds:
            try:
                self.rate_limiter.wait(url=feed_url)
                feed = feedparser.parse(feed_url)
                cutoff = datetime.now(timezone.utc) - timedelta(days=8)

                for entry in feed.entries:
                    try:
                        pub_date = _parse_feed_date(entry)
                        if pub_date and pub_date < cutoff:
                            continue

                        article = {
                            "title": entry.get("title", ""),
                            "url": entry.get("link", ""),
                            "summary": entry.get("summary", "")[:1000],
                            "published": pub_date.isoformat() if pub_date else None,
                            "source": feed.feed.get("title", feed_url),
                            "source_type": "rss",
                            "competitor_id": self.competitor_id,
                        }
                        if article["title"] or article["summary"]:
                            results.append({"content": article, "source_url": article["url"]})
                    except Exception as e:
                        logger.warning("Failed to parse RSS entry", error=str(e))
            except Exception as e:
                logger.error("RSS feed failed", url=feed_url, error=str(e))

        return results

    def _collect_newsapi(self) -> list[dict]:
        key = (settings.newsapi_key or "").strip()
        if not key or key.startswith("#") or len(key) < 10:
            return []

        results = []
        from_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")

        for keyword in self.keywords[:3]:  # Max 3 queries per competitor (API rate limit)
            try:
                self.rate_limiter.wait(domain="newsapi.org")
                resp = requests.get(
                    "https://newsapi.org/v2/everything",
                    params={
                        "q": keyword,
                        "from": from_date,
                        "sortBy": "relevancy",
                        "pageSize": 10,
                        "language": "en",
                        "apiKey": settings.newsapi_key,
                    },
                    timeout=15,
                )
                resp.raise_for_status()
                data = resp.json()

                for article in data.get("articles", []):
                    payload = {
                        "title": article.get("title", ""),
                        "url": article.get("url", ""),
                        "summary": (article.get("description") or article.get("content") or "")[:1000],
                        "published": article.get("publishedAt"),
                        "source": article.get("source", {}).get("name", "NewsAPI"),
                        "source_type": "newsapi",
                        "keyword_matched": keyword,
                        "competitor_id": self.competitor_id,
                    }
                    if payload["title"]:
                        results.append({"content": payload, "source_url": payload["url"]})

            except requests.HTTPError as e:
                if e.response.status_code == 429:
                    logger.warning("NewsAPI rate limit hit", keyword=keyword)
                    break
                logger.error("NewsAPI request failed", keyword=keyword, error=str(e))
            except Exception as e:
                logger.error("NewsAPI error", keyword=keyword, error=str(e))

        return results


class MarketNewsCollector(BaseCollector):
    """Collects general sports tech market news (not competitor-specific)."""
    signal_type = "news"

    def __init__(self):
        super().__init__("market")

    def collect(self) -> list[dict]:
        results = []
        cutoff = datetime.now(timezone.utc) - timedelta(days=8)

        for feed_url in GENERAL_RSS_FEEDS:
            try:
                self.rate_limiter.wait(url=feed_url)
                feed = feedparser.parse(feed_url)

                for entry in feed.entries:
                    pub_date = _parse_feed_date(entry)
                    if pub_date and pub_date < cutoff:
                        continue

                    title_lower = (entry.get("title") or "").lower()
                    summary_lower = (entry.get("summary") or "").lower()
                    sports_keywords = ["padel", "pickleball", "tennis", "sports", "ai", "analytics", "video"]

                    if not any(k in title_lower or k in summary_lower for k in sports_keywords):
                        continue

                    article = {
                        "title": entry.get("title", ""),
                        "url": entry.get("link", ""),
                        "summary": entry.get("summary", "")[:1000],
                        "published": pub_date.isoformat() if pub_date else None,
                        "source": feed.feed.get("title", feed_url),
                        "source_type": "rss_market",
                        "competitor_id": "market",
                    }
                    results.append({"content": article, "source_url": article["url"]})
            except Exception as e:
                logger.error("Market RSS feed failed", url=feed_url, error=str(e))

        return results


def _parse_feed_date(entry) -> datetime | None:
    """Parse published/updated date from a feedparser entry."""
    import time
    for attr in ("published_parsed", "updated_parsed"):
        val = getattr(entry, attr, None)
        if val:
            try:
                return datetime.fromtimestamp(time.mktime(val), tz=timezone.utc)
            except Exception:
                pass
    return None


def run_all_news_collectors(competitors: dict) -> int:
    """Run news collection for all active competitors. Returns total new signals."""
    total = 0

    # Market-level news
    market_collector = MarketNewsCollector()
    total += market_collector.run()

    # Per-competitor news
    for competitor_id, config in competitors.items():
        if not config.get("active", False):
            continue
        collector = NewsCollector(competitor_id, config)
        total += collector.run()

    logger.info("News collection complete", total_new_signals=total)
    return total
