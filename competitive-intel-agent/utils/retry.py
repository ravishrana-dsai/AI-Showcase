"""
Retry decorator with exponential backoff using tenacity.
"""

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)
import logging
import requests

logger = logging.getLogger(__name__)


def with_retry(
    max_attempts: int = 3,
    min_wait: float = 2.0,
    max_wait: float = 30.0,
    exceptions: tuple = (requests.RequestException, ConnectionError, TimeoutError),
):
    """
    Decorator factory for retrying functions with exponential backoff.

    Usage:
        @with_retry(max_attempts=3)
        def fetch_data():
            ...
    """
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
        retry=retry_if_exception_type(exceptions),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
