"""
Twitter/X signal collector.

Uses the Twitter API v2 (bearer token) to collect recent tweets mentioning
each competitor's handle and keywords. Requires TWITTER_BEARER_TOKEN in .env
and enable_twitter=True in settings.

Gracefully skips if no bearer token is configured.
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

# Max tweets to collect per competitor per run
MAX_TWEETS = 30
# Lookback window in days
LOOKBACK_DAYS = 7


class TwitterSignalsCollector(BaseCollector):
    """Collects recent tweets mentioning a competitor."""

    signal_type = "social"

    def __init__(self, competitor_id: str, competitor_config: dict):
        super().__init__(competitor_id)
        self.handle = competitor_config.get("twitter_handle", "")
        self.keywords = competitor_config.get("news_keywords", [])
        self.bearer_token = getattr(settings, "twitter_bearer_token", "")

    def _search_tweets(self, query: str) -> list[dict]:
        """Call Twitter API v2 /2/tweets/search/recent."""
        encoded = urllib.parse.quote(query)
        start_time = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        url = (
            f"https://api.twitter.com/2/tweets/search/recent"
            f"?query={encoded}"
            f"&max_results={min(MAX_TWEETS, 100)}"
            f"&start_time={start_time}"
            f"&tweet.fields=created_at,author_id,public_metrics,lang"
            f"&expansions=author_id"
            f"&user.fields=username,name"
        )
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {self.bearer_token}",
                "User-Agent": "[Company]CI/1.0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            self.logger.warning("Twitter API error", status=e.code, body=body[:200])
            return {}
        except Exception as e:
            self.logger.warning("Twitter fetch failed", error=str(e))
            return {}

    def collect(self) -> list[dict]:
        if not self.bearer_token:
            self.logger.info("No Twitter bearer token configured, skipping")
            return []

        if not getattr(settings, "enable_twitter", False):
            self.logger.info("Twitter collection disabled in settings, skipping")
            return []

        if not self.handle:
            return []

        # Search for tweets mentioning @handle (from:handle OR mentions)
        query = f"(@{self.handle} OR from:{self.handle}) -is:retweet lang:en"
        data = self._search_tweets(query)
        if not data or "data" not in data:
            self.logger.info("No tweets found", handle=self.handle)
            return []

        # Build user lookup from includes
        users = {u["id"]: u for u in data.get("includes", {}).get("users", [])}

        signals = []
        for tweet in data.get("data", []):
            author = users.get(tweet.get("author_id", ""), {})
            metrics = tweet.get("public_metrics", {})
            content = {
                "type": "tweet",
                "tweet_id": tweet.get("id"),
                "text": tweet.get("text", ""),
                "author_handle": author.get("username", ""),
                "author_name": author.get("name", ""),
                "created_at": tweet.get("created_at", ""),
                "retweet_count": metrics.get("retweet_count", 0),
                "like_count": metrics.get("like_count", 0),
                "reply_count": metrics.get("reply_count", 0),
                "competitor_handle": self.handle,
                "competitor_id": self.competitor_id,
            }
            tweet_url = f"https://twitter.com/{author.get('username','i')}/status/{tweet.get('id','')}"
            signals.append({"content": content, "source_url": tweet_url})

        time.sleep(1)  # polite rate limiting between competitors
        return signals


def run_all_twitter_collectors(competitors: dict) -> int:
    """Run Twitter collection for all active competitors with a twitter_handle."""
    if not getattr(settings, "twitter_bearer_token", ""):
        logger.info("No Twitter bearer token set, skipping all Twitter collection")
        return 0

    if not getattr(settings, "enable_twitter", False):
        logger.info("Twitter collection disabled in settings")
        return 0

    total = 0
    for comp_id, cfg in competitors.items():
        if not cfg.get("active", True):
            continue
        if not cfg.get("twitter_handle"):
            continue
        try:
            collector = TwitterSignalsCollector(comp_id, cfg)
            total += collector.run()
        except Exception as e:
            logger.error("Twitter collector failed", competitor=comp_id, error=str(e))
    logger.info("Twitter collection complete", total_new=total)
    return total
