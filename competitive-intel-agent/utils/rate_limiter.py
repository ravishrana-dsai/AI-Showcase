from __future__ import annotations
"""
Per-domain rate limiter for polite scraping.
"""

import time
import random
import threading
from collections import defaultdict
from urllib.parse import urlparse


class RateLimiter:
    """Thread-safe per-domain rate limiter with randomized delays."""

    def __init__(self, min_delay: float = 3.0, max_delay: float = 6.0):
        self.min_delay = min_delay
        self.max_delay = max_delay
        self._last_request: dict[str, float] = defaultdict(float)
        self._lock = threading.Lock()

    def wait(self, url: str | None = None, domain: str | None = None):
        """Block until it's polite to make another request to this domain."""
        if not domain and url:
            try:
                domain = urlparse(url).netloc
            except Exception:
                domain = "unknown"

        domain = domain or "unknown"

        with self._lock:
            last = self._last_request[domain]
            now = time.time()
            elapsed = now - last
            delay = random.uniform(self.min_delay, self.max_delay)

            if elapsed < delay:
                time.sleep(delay - elapsed)

            self._last_request[domain] = time.time()

    def reset(self, domain: str | None = None):
        with self._lock:
            if domain:
                self._last_request.pop(domain, None)
            else:
                self._last_request.clear()


# Shared global rate limiter instance
_global_limiter = RateLimiter()


def polite_wait(url: str):
    """Global polite wait before fetching a URL."""
    _global_limiter.wait(url=url)
