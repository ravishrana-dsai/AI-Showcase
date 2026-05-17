"""
LinkedIn company page monitor.

Scrapes the public company posts feed for each competitor's LinkedIn page
to capture product announcements, team updates, and funding news that don't
appear in news RSS feeds.

Uses Playwright with optional login (LINKEDIN_EMAIL/LINKEDIN_PASSWORD in .env).
Falls back gracefully if LinkedIn blocks the request or credentials are missing.

Signal type: "social" (tagged type='linkedin_post' in raw_content)
Schedule: Weekly (Wednesdays 2pm IST, added in scheduler/jobs.py)
"""
from __future__ import annotations

import json
import asyncio
import time
import random
import urllib.request
import urllib.parse
from datetime import datetime, timedelta, timezone
from collectors.base_collector import BaseCollector
from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

MAX_POSTS = 10


async def _scrape_company_posts_async(company_slug: str, email: str = "", password: str = "") -> list[dict]:
    """Scrape LinkedIn company /posts page. Returns list of post dicts."""
    from playwright.async_api import async_playwright

    posts = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
            locale="en-US",
        )
        page = await context.new_page()

        try:
            # Optionally log in first for richer content
            if email and password:
                try:
                    await page.goto("https://www.linkedin.com/login", timeout=20000)
                    await page.fill("#username", email)
                    await page.fill("#password", password)
                    await page.click('button[type="submit"]')
                    await page.wait_for_timeout(3000)
                except Exception:
                    pass  # Continue without login

            # Navigate to company posts page
            url = f"https://www.linkedin.com/company/{company_slug}/posts/"
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(random.randint(2000, 3500))

            # Check for login wall or blocking
            content_text = await page.text_content("body") or ""
            if "Sign in" in content_text[:500] or "Join LinkedIn" in content_text[:500]:
                logger.warning("LinkedIn login wall detected", company=company_slug)
                await browser.close()
                return []

            # Extract posts
            posts = await page.evaluate("""() => {
                const results = [];
                const cards = document.querySelectorAll(
                    '.feed-shared-update-v2, .occludable-update, [data-urn^="urn:li:activity"]'
                );
                cards.forEach((card, idx) => {
                    if (idx >= 10) return;
                    const text = card.innerText || '';
                    const link = card.querySelector('a[href*="activity"]');
                    const reactions = card.querySelector('.social-counts-reactions') ||
                                      card.querySelector('[aria-label*="reaction"]');
                    results.push({
                        text: text.slice(0, 800).trim(),
                        post_url: link ? link.href : '',
                        reaction_text: reactions ? reactions.innerText.trim() : '',
                    });
                });
                return results;
            }""")

        except Exception as e:
            logger.warning("LinkedIn scrape failed", company=company_slug, error=str(e))
            posts = []
        finally:
            await browser.close()

    return posts or []


class LinkedInPageCollector(BaseCollector):
    """Collects company page posts from LinkedIn."""

    signal_type = "social"

    def __init__(self, competitor_id: str, competitor_config: dict):
        super().__init__(competitor_id)
        self.linkedin_company = competitor_config.get("linkedin_company", "")
        self.email = getattr(settings, "linkedin_email", "")
        self.password = getattr(settings, "linkedin_password", "")

    def collect(self) -> list[dict]:
        if not self.linkedin_company:
            return []

        if not getattr(settings, "enable_linkedin_scrape", True):
            self.logger.info("LinkedIn scraping disabled in settings, skipping")
            return []

        try:
            raw_posts = asyncio.run(
                _scrape_company_posts_async(
                    self.linkedin_company,
                    email=self.email,
                    password=self.password,
                )
            )
        except Exception as e:
            self.logger.error("LinkedIn async scrape failed", error=str(e))
            return []

        if not raw_posts:
            self.logger.info("LinkedIn Playwright blocked — trying NewsAPI fallback", company=self.linkedin_company)
            return self._newsapi_fallback()

        return self._posts_to_signals(raw_posts)

    def _newsapi_fallback(self) -> list[dict]:
        """Search NewsAPI for recent LinkedIn content about this company when Playwright is blocked."""
        key = (getattr(settings, "newsapi_key", "") or "").strip()
        if not key or len(key) < 10:
            self.logger.info("No NewsAPI key — LinkedIn fallback unavailable", company=self.linkedin_company)
            return []

        company_name = self.linkedin_company.replace("-", " ")
        query = f'"{company_name}" site:linkedin.com OR linkedin.com/company/{self.linkedin_company}'
        from_date = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")

        try:
            import urllib.request as _req
            params = urllib.parse.urlencode({
                "q": query,
                "from": from_date,
                "sortBy": "publishedAt",
                "pageSize": 10,
                "language": "en",
                "apiKey": key,
            })
            req = _req.Request(
                f"https://newsapi.org/v2/everything?{params}",
                headers={"User-Agent": "[Company]CI/1.0"},
            )
            with _req.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode())
        except Exception as e:
            self.logger.warning("LinkedIn NewsAPI fallback failed", error=str(e))
            return []

        signals = []
        for article in data.get("articles", [])[:MAX_POSTS]:
            title = (article.get("title") or "").strip()
            if not title:
                continue
            content = {
                "type": "linkedin_post",
                "company_slug": self.linkedin_company,
                "text": f"{title}. {(article.get('description') or '')[:400]}".strip(),
                "post_url": article.get("url", ""),
                "source": "newsapi_fallback",
                "scraped_at": datetime.now(timezone.utc).isoformat(),
                "competitor_id": self.competitor_id,
            }
            signals.append({
                "content": content,
                "source_url": article.get("url", ""),
            })

        self.logger.info("LinkedIn NewsAPI fallback collected", company=self.linkedin_company, count=len(signals))
        return signals

    def _posts_to_signals(self, raw_posts: list[dict]) -> list[dict]:
        """Convert scraped Playwright posts to signal dicts."""

        signals = []
        for post in raw_posts[:MAX_POSTS]:
            text = post.get("text", "").strip()
            if not text or len(text) < 20:
                continue
            content = {
                "type": "linkedin_post",
                "company_slug": self.linkedin_company,
                "text": text,
                "post_url": post.get("post_url", ""),
                "reaction_text": post.get("reaction_text", ""),
                "scraped_at": datetime.now(timezone.utc).isoformat(),
                "competitor_id": self.competitor_id,
            }
            signals.append({
                "content": content,
                "source_url": post.get("post_url") or f"https://www.linkedin.com/company/{self.linkedin_company}/posts/",
            })

        # Polite delay between companies
        time.sleep(random.uniform(3, 6))
        return signals


def run_all_linkedin_monitors(competitors: dict) -> int:
    """Run LinkedIn page monitoring for all active competitors with linkedin_company."""
    if not getattr(settings, "enable_linkedin_scrape", True):
        logger.info("LinkedIn scraping disabled in settings")
        return 0

    total = 0
    for comp_id, cfg in competitors.items():
        if not cfg.get("active", True):
            continue
        if not cfg.get("linkedin_company"):
            continue
        try:
            collector = LinkedInPageCollector(comp_id, cfg)
            total += collector.run()
        except Exception as e:
            logger.error("LinkedIn monitor failed", competitor=comp_id, error=str(e))
    logger.info("LinkedIn monitoring complete", total_new=total)
    return total
