"""
App store review collector: iOS App Store + Google Play.
"""

import json
from datetime import datetime, timedelta, timezone
from collectors.base_collector import BaseCollector
from utils.logger import get_logger

logger = get_logger(__name__)


class AppReviewsCollector(BaseCollector):
    signal_type = "app_review"

    def __init__(self, competitor_id: str, competitor_config: dict):
        super().__init__(competitor_id)
        self.config = competitor_config
        self.app_store_id = competitor_config.get("app_store_id")
        self.play_store_id = competitor_config.get("play_store_id")

    def collect(self) -> list[dict]:
        reviews = []
        reviews.extend(self._collect_play_store())
        reviews.extend(self._collect_app_store())
        return reviews

    def _collect_play_store(self) -> list[dict]:
        if not self.play_store_id:
            return []

        try:
            from google_play_scraper import reviews, Sort
            self.rate_limiter.wait(domain="play.google.com")

            result, _ = reviews(
                self.play_store_id,
                lang="en",
                country="us",
                sort=Sort.NEWEST,
                count=50,
            )

            cutoff = datetime.now(timezone.utc) - timedelta(days=30)
            filtered = []
            for r in result:
                at = r.get("at")
                if at:
                    if isinstance(at, datetime):
                        review_date = at.replace(tzinfo=timezone.utc) if at.tzinfo is None else at
                    else:
                        review_date = datetime.fromtimestamp(at, tz=timezone.utc)
                    if review_date < cutoff:
                        continue

                review = {
                    "store": "play_store",
                    "review_id": r.get("reviewId", ""),
                    "rating": r.get("score", 0),
                    "title": r.get("title", ""),
                    "text": r.get("content", ""),
                    "author": r.get("userName", ""),
                    "date": r.get("at").isoformat() if r.get("at") else None,
                    "thumbs_up": r.get("thumbsUpCount", 0),
                    "competitor_id": self.competitor_id,
                }
                filtered.append({"content": review, "source_url": f"https://play.google.com/store/apps/details?id={self.play_store_id}"})

            logger.info("Play Store reviews collected", competitor=self.competitor_id, count=len(filtered))
            return filtered

        except ImportError:
            logger.warning("google-play-scraper not installed")
            return []
        except Exception as e:
            logger.error("Play Store collection failed", competitor=self.competitor_id, error=str(e))
            return []

    def _collect_app_store(self) -> list[dict]:
        if not self.app_store_id:
            return []
        try:
            from app_store_scraper import AppStore
        except ImportError:
            self.logger.warning("app-store-scraper not installed, skipping iOS reviews")
            return []
        try:
            # Try multiple countries to maximize coverage
            all_reviews = []
            for country in ['us', 'gb', 'in']:
                try:
                    app = AppStore(country=country, app_name=self.competitor_id, app_id=int(self.app_store_id))
                    app.review(how_many=20)
                    if app.reviews:
                        all_reviews.extend(app.reviews)
                        break  # Got results, no need to try more countries
                except Exception:
                    continue

            if not all_reviews:
                self.logger.info(
                    "No iOS reviews returned (app-store-scraper may be outdated or app has no reviews)",
                    competitor=self.competitor_id,
                    app_store_id=self.app_store_id,
                )
                return []

            results = []
            seen = set()
            for review in all_reviews[:30]:
                # Deduplicate
                rid = str(review.get('id') or review.get('title', '') + str(review.get('date', '')))
                if rid in seen:
                    continue
                seen.add(rid)
                payload = {
                    "type": "app_review",
                    "platform": "ios",
                    "app_store_id": self.app_store_id,
                    "title": review.get("title", ""),
                    "content": review.get("review", review.get("content", "")),
                    "score": review.get("rating", review.get("score", 0)),
                    "date": str(review.get("date", "")),
                    "competitor_id": self.competitor_id,
                }
                results.append({"content": payload, "source_url": f"https://apps.apple.com/app/id{self.app_store_id}"})
            self.logger.info("App Store reviews collected", competitor=self.competitor_id, count=len(results))
            return results
        except Exception as e:
            self.logger.warning("App Store collection failed", competitor=self.competitor_id, error=str(e))
            return []


def run_all_review_collectors(competitors: dict) -> int:
    """Collect app reviews for all active competitors with app IDs."""
    total = 0
    for competitor_id, config in competitors.items():
        if not config.get("active", False):
            continue
        if not config.get("app_store_id") and not config.get("play_store_id"):
            continue
        collector = AppReviewsCollector(competitor_id, config)
        total += collector.run()
    logger.info("App review collection complete", total_new_signals=total)
    return total
