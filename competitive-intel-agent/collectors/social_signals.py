"""
Social signals collector — no API keys required.

Sources:
  1. Arctic Shift (photon-reddit.com) — free Reddit archive API, no credentials
  2. Google Trends           (pytrends — no auth)
  3. YouTube Data API v3     (optional — only if YOUTUBE_API_KEY set)
"""
from __future__ import annotations

import json
import time
import urllib.request
import urllib.parse
from datetime import datetime, timedelta, timezone
from collectors.base_collector import BaseCollector
from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

SPORTS_SUBREDDITS = [
    "Padel", "PadelTennis", "pickleball", "pickleballmemes", "sportstech",
]

_ARCTIC_BASE = "https://arctic-shift.photon-reddit.com/api/posts/search"

REDDIT_HEADERS = {
    "User-Agent": "[Company]CI/1.0 (research bot; contact: contact@company.com)",
    "Accept": "application/json",
}


# ── Reddit (no-auth JSON API) ──────────────────────────────────────────────

class RedditNoAuthCollector(BaseCollector):
    """Collects Reddit posts via Arctic Shift (photon-reddit.com) — no credentials needed."""
    signal_type = "social"

    def __init__(self, competitor_id: str, competitor_config: dict):
        super().__init__(competitor_id)
        self.config = competitor_config
        self.search_terms = competitor_config.get("reddit_mentions", [])

    def _fetch_arctic(self, subreddit: str, query: str, after_ts: int) -> list[dict]:
        params = urllib.parse.urlencode({
            "subreddit": subreddit,
            "query": query,
            "limit": 15,
            "after": str(after_ts),
            "sort": "desc",
        })
        url = f"{_ARCTIC_BASE}?{params}"
        req = urllib.request.Request(url, headers=REDDIT_HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode()).get("data") or []

    def collect(self) -> list[dict]:
        if not self.search_terms:
            return []

        results = []
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        after_ts = int(cutoff.timestamp())

        for subreddit in SPORTS_SUBREDDITS:
            for term in self.search_terms[:2]:
                try:
                    self.rate_limiter.wait(domain="arctic-shift.photon-reddit.com")
                    posts = self._fetch_arctic(subreddit, term, after_ts)
                    for d in posts:
                        created_ts = d.get("created_utc", 0)
                        created = datetime.fromtimestamp(created_ts, tz=timezone.utc)
                        if created < cutoff:
                            continue
                        permalink = d.get("permalink", "")
                        post = {
                            "type": "reddit_post",
                            "subreddit": subreddit,
                            "title": d.get("title", ""),
                            "text": (d.get("selftext") or "")[:400],
                            "url": "https://reddit.com" + permalink if permalink else "",
                            "score": d.get("score", 0),
                            "num_comments": d.get("num_comments", 0),
                            "created": created.isoformat(),
                            "search_term": term,
                            "competitor_id": self.competitor_id,
                        }
                        results.append({
                            "content": post,
                            "source_url": post["url"],
                            "title": post["title"],
                        })
                except Exception as e:
                    logger.warning(
                        "Arctic Shift fetch failed",
                        subreddit=subreddit, term=term, error=str(e)
                    )
                    time.sleep(2)

        logger.info("Reddit signals collected", competitor=self.competitor_id, count=len(results))
        return results


# ── Google Trends ──────────────────────────────────────────────────────────

class GoogleTrendsSocialCollector(BaseCollector):
    """Collects Google Trends interest data for competitor keywords."""
    signal_type = "social"

    MARKET_KEYWORDS = [
        "pickleball", "padel tennis", "sports video analysis",
        "AI sports coaching", "pickleball analytics", "padel analytics",
    ]

    def __init__(self):
        super().__init__("market")

    def collect(self) -> list[dict]:
        try:
            from pytrends.request import TrendReq
        except ImportError:
            logger.warning("pytrends not installed — run: pip install pytrends")
            return []

        results = []
        try:
            pt = TrendReq(hl="en-US", tz=330)   # IST offset
            # Split into batches of 5 (Google Trends max)
            for i in range(0, len(self.MARKET_KEYWORDS), 5):
                batch = self.MARKET_KEYWORDS[i:i + 5]
                try:
                    self.rate_limiter.wait(domain="trends.google.com")
                    pt.build_payload(batch, timeframe="now 7-d")
                    df = pt.interest_over_time()
                    if df.empty:
                        continue
                    for kw in batch:
                        if kw not in df.columns:
                            continue
                        avg_interest = int(df[kw].mean())
                        peak = int(df[kw].max())
                        results.append({
                            "content": {
                                "type": "google_trends",
                                "keyword": kw,
                                "avg_interest_7d": avg_interest,
                                "peak_interest_7d": peak,
                                "trend_direction": (
                                    "rising" if df[kw].iloc[-1] > df[kw].iloc[0] else "falling"
                                ),
                            },
                            "source_url": f"https://trends.google.com/trends/explore?q={urllib.parse.quote(kw)}",
                            "title": f"Google Trends: {kw} (avg={avg_interest}, peak={peak})",
                        })
                    time.sleep(3)
                except Exception as e:
                    logger.warning("Google Trends batch failed", batch=batch, error=str(e))

            logger.info("Google Trends collected", count=len(results))
        except Exception as e:
            logger.error("Google Trends collection failed", error=str(e))

        return results


# ── YouTube (optional) ─────────────────────────────────────────────────────

class YouTubeSocialCollector(BaseCollector):
    """Collects YouTube video data for competitor keywords (needs YOUTUBE_API_KEY)."""
    signal_type = "social"

    def __init__(self, competitor_id: str, competitor_config: dict):
        super().__init__(competitor_id)
        self.config = competitor_config
        self.keywords = competitor_config.get("news_keywords", [])

    def collect(self) -> list[dict]:
        api_key = getattr(settings, "youtube_api_key", None) or ""
        if not api_key:
            return []

        results = []
        cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%dT%H:%M:%SZ")
        for kw in self.keywords[:2]:
            try:
                self.rate_limiter.wait(domain="youtube.com")
                q = urllib.parse.quote(kw)
                url = (
                    f"https://www.googleapis.com/youtube/v3/search"
                    f"?part=snippet&q={q}&type=video&order=date"
                    f"&publishedAfter={cutoff}&maxResults=5&key={api_key}"
                )
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode())
                for item in data.get("items", []):
                    snip = item.get("snippet", {})
                    vid_id = item.get("id", {}).get("videoId", "")
                    results.append({
                        "content": {
                            "type": "youtube_video",
                            "title": snip.get("title", ""),
                            "channel": snip.get("channelTitle", ""),
                            "published": snip.get("publishedAt", ""),
                            "description": snip.get("description", "")[:300],
                            "keyword": kw,
                            "competitor_id": self.competitor_id,
                        },
                        "source_url": f"https://youtube.com/watch?v={vid_id}",
                        "title": snip.get("title", ""),
                    })
            except Exception as e:
                logger.warning("YouTube search failed", kw=kw, error=str(e))

        logger.info("YouTube signals collected", competitor=self.competitor_id, count=len(results))
        return results


# ── Runner ─────────────────────────────────────────────────────────────────

def run_all_social_collectors(competitors: dict) -> int:
    total = 0

    # 1. Reddit (no auth needed)
    for competitor_id, config in competitors.items():
        if not config.get("active", False) or not config.get("reddit_mentions"):
            continue
        collector = RedditNoAuthCollector(competitor_id, config)
        total += collector.run()

    # 2. Google Trends market-wide
    try:
        gt = GoogleTrendsSocialCollector()
        total += gt.run()
    except Exception as e:
        logger.warning("Google Trends runner failed", error=str(e))

    # 3. YouTube (only if key configured)
    youtube_key = getattr(settings, "youtube_api_key", None)
    if youtube_key:
        for competitor_id, config in competitors.items():
            if not config.get("active", False):
                continue
            collector = YouTubeSocialCollector(competitor_id, config)
            total += collector.run()

    logger.info("Social collection complete", total_new_signals=total)
    return total
