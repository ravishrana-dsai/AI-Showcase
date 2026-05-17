from __future__ import annotations
"""
Signal Quality Gate: rule-based pre-LLM scoring for raw signals.
Scores each signal 0.0-1.0 before any LLM processor sees it.
Signals below SKIP_THRESHOLD are marked processed without LLM cost.
"""

import json
import re
from db import database
from utils.logger import get_logger

logger = get_logger(__name__)

SKIP_THRESHOLD = 0.4

# Keywords that raise signal quality for sports/padel/pickleball context
_SPORTS_TECH_KEYWORDS = [
    "padel", "pickleball", "tennis", "racket", "court", "sports", "facility",
    "booking", "ai", "video", "analysis", "computer vision", "machine learning",
    "funding", "series", "launch", "raises", "acqui", "partner", "expand",
    "feature", "platform", "app", "saas", "api", "integration",
]

# Job title patterns that indicate product-relevant hiring
_PRODUCT_ROLE_PATTERNS = re.compile(
    r"\b(machine learning|ml|ai|deep learning|computer vision|cv|nlp|"
    r"product manager|pm|engineer(?:ing)?|developer|backend|frontend|data scientist|"
    r"architect|infrastructure|devops|platform|research|scientist|analytics|"
    r"ux|design|growth|marketing|sales|partnership|business development|"
    r"cto|cpo|vp engineering|head of|director)\b",
    re.IGNORECASE,
)

# Job title patterns that indicate non-product (field ops) hiring
_NON_PRODUCT_PATTERNS = re.compile(
    r"\b(field service|field tech|installation|installer|maintenance|"
    r"facilities|janitor|cleaning|security guard|receptionist|"
    r"delivery|driver|logistics|warehouse|customer support|call center|"
    r"retail|store associate|cashier|electrician|plumber|hvac)\b",
    re.IGNORECASE,
)

# Price-related keywords for pricing signal scoring
_PRICE_KEYWORDS = re.compile(r"\$|\€|\£|per month|monthly|annual|plan|tier|pricing|free|pro|enterprise|subscription", re.IGNORECASE)


class SignalQualityGate:
    """
    Pure rule-based scorer. No LLM calls, no side effects in score().
    persist_quality() is the only DB-touching method.
    """

    SKIP_THRESHOLD = SKIP_THRESHOLD

    def score(
        self,
        signal_type: str,
        raw_content: dict,
        competitor_id: str = "",
    ) -> tuple[float, list[str]]:
        """
        Score a signal. Returns (quality_score 0.0-1.0, flags list).
        Never raises - returns (0.5, []) on unexpected input.
        """
        try:
            scorer = {
                "job_posting": self._score_job_posting,
                "news": self._score_news,
                "app_review": self._score_app_review,
                "pricing": self._score_pricing,
                "web_page": self._score_web_page,
            }.get(signal_type)
            if scorer is None:
                base_score, flags = 0.6, []
            else:
                base_score, flags = scorer(raw_content)
            # Apply learned bias from source_performance
            try:
                from db import database
                conn = database.get_connection()
                row = conn.execute(
                    "SELECT bias_adjustment FROM source_performance WHERE signal_type=? ORDER BY computed_at DESC LIMIT 1",
                    (signal_type,)
                ).fetchone()
                if row and row[0]:
                    base_score = max(0.0, min(1.0, base_score + row[0]))
            except Exception:
                pass
            return base_score, flags
        except Exception as exc:
            logger.debug("Quality gate scoring failed", signal_type=signal_type, error=str(exc))
            return 0.5, []

    def _score_job_posting(self, content: dict) -> tuple[float, list[str]]:
        flags: list[str] = []
        score = 0.0

        title = (content.get("title") or content.get("job_title") or "").strip()
        department = (content.get("department") or "").strip()
        location = (content.get("location") or "").strip()
        is_relevant = content.get("is_relevant")

        # Use existing is_relevant field if already classified
        if is_relevant is False or is_relevant == 0:
            flags.append("irrelevant_role")
            return 0.1, flags

        if is_relevant is True or is_relevant == 1:
            score += 0.3  # Passed binary filter

        # Check title for non-product patterns
        if _NON_PRODUCT_PATTERNS.search(title):
            flags.append("irrelevant_role")
            return 0.15, flags

        # Check for product-relevant patterns
        if _PRODUCT_ROLE_PATTERNS.search(title):
            score += 0.3
        else:
            flags.append("no_product_role_match")
            score += 0.1  # Some base if no pattern match

        if department and _PRODUCT_ROLE_PATTERNS.search(department):
            score += 0.2
        elif not department:
            flags.append("no_department")

        if location:
            score += 0.1

        return min(1.0, score), flags

    def _score_news(self, content: dict) -> tuple[float, list[str]]:
        flags: list[str] = []
        score = 0.5  # Neutral base

        title = (content.get("title") or "").strip()
        body = (content.get("body") or content.get("content") or content.get("summary") or "").strip()
        full_text = f"{title} {body}".lower()
        word_count = len(full_text.split())

        if word_count < 30:
            flags.append("too_short")
            return 0.1, flags

        if word_count < 80:
            flags.append("very_short")
            score -= 0.2

        # Check for sports/tech relevance keywords
        keyword_hits = sum(1 for kw in _SPORTS_TECH_KEYWORDS if kw in full_text)
        if keyword_hits >= 3:
            score += 0.3
        elif keyword_hits >= 1:
            score += 0.1
        else:
            flags.append("no_relevant_keywords")
            score -= 0.2

        return max(0.05, min(1.0, score)), flags

    def _score_app_review(self, content: dict) -> tuple[float, list[str]]:
        flags: list[str] = []
        score = 0.5

        text = (content.get("review_text") or content.get("content") or content.get("text") or "").strip()
        rating = content.get("rating") or content.get("score") or 3

        if len(text) < 30:
            flags.append("too_short")
            return 0.1, flags

        # Generic low-signal reviews
        generic_negative = re.match(r"^(doesn.t work|broken|bad|terrible|awful|worst|horrible|0 stars|1 star)\.?$", text.strip(), re.IGNORECASE)
        generic_positive = re.match(r"^(great|amazing|love it|best app|5 stars|awesome|perfect|excellent)\.?$", text.strip(), re.IGNORECASE)

        if rating <= 2 and generic_negative:
            flags.append("generic_complaint")
            return 0.2, flags
        if rating >= 4 and generic_positive:
            flags.append("generic_praise")
            return 0.25, flags

        # Longer reviews are more signal-rich
        if len(text) > 200:
            score += 0.2

        # Feature mentions boost quality
        feature_mentions = len(re.findall(r"\b(feature|button|screen|booking|video|camera|ai|analysis|payment|crash|bug|update|version|court|match)\b", text, re.IGNORECASE))
        if feature_mentions >= 2:
            score += 0.3
        elif feature_mentions >= 1:
            score += 0.1

        return max(0.05, min(1.0, score)), flags

    def _score_pricing(self, content: dict) -> tuple[float, list[str]]:
        flags: list[str] = []
        score = 0.5

        text = (content.get("content") or content.get("text") or content.get("raw_text") or "").strip()
        change_ratio = content.get("change_ratio") or 0.0

        if not text or len(text) < 50:
            flags.append("too_short")
            return 0.15, flags

        # Whitespace-only or trivial change
        if change_ratio < 0.02:
            flags.append("likely_whitespace_diff")
            score -= 0.3

        # Check for price indicators
        if _PRICE_KEYWORDS.search(text):
            score += 0.3
        else:
            flags.append("no_price_data")
            score -= 0.2

        # Structural change
        if change_ratio > 0.10:
            score += 0.3
        elif change_ratio > 0.04:
            score += 0.1

        return max(0.05, min(1.0, score)), flags

    def _score_web_page(self, content: dict) -> tuple[float, list[str]]:
        flags: list[str] = []
        score = 0.5

        text = (content.get("content") or content.get("text") or content.get("raw_text") or "").strip()
        change_ratio = content.get("change_ratio") or 0.0

        if not text or len(text) < 100:
            flags.append("too_short")
            return 0.2, flags

        # Minor change
        if change_ratio < 0.03:
            flags.append("minor_change")
            score -= 0.3

        # Product/feature content
        feature_hits = len(re.findall(r"\b(feature|product|platform|integration|api|ai|video|analytics|booking|court|padel|pickleball)\b", text, re.IGNORECASE))
        if feature_hits >= 3:
            score += 0.3
        elif feature_hits >= 1:
            score += 0.1
        else:
            flags.append("no_product_keywords")
            score -= 0.1

        # Significant structural change
        if change_ratio > 0.15:
            score += 0.3
        elif change_ratio > 0.05:
            score += 0.1

        return max(0.05, min(1.0, score)), flags

    def should_skip(self, score: float) -> bool:
        return score < self.SKIP_THRESHOLD

    def persist_quality(self, signal_id: int, score: float, flags: list[str]) -> None:
        """Write quality_score and quality_flags back to raw_signals."""
        try:
            database.update_signal_quality(signal_id, round(score, 4), json.dumps(flags))
        except Exception as exc:
            logger.debug("Failed to persist quality score", signal_id=signal_id, error=str(exc))
