"""
Playwright-based web scraper for competitor homepages and feature pages.
Extracts structured text (headings, feature cards, CTAs) not raw HTML.
"""

import json
import asyncio
from collectors.base_collector import BaseCollector
from utils.logger import get_logger
from utils.diff_engine import compute_hash
from utils.rate_limiter import polite_wait
from db import database

logger = get_logger(__name__)


async def _scrape_page_async(url: str) -> dict:
    """Scrape a single URL using Playwright. Returns structured content dict."""
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
            locale="en-US",
        )

        page = await context.new_page()
        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)  # Let JS render

            # Extract structured content
            content = await page.evaluate("""() => {
                const getText = (selector) => {
                    const els = document.querySelectorAll(selector);
                    return Array.from(els).map(el => el.innerText?.trim()).filter(Boolean);
                };

                return {
                    title: document.title || '',
                    h1: getText('h1'),
                    h2: getText('h2'),
                    h3: getText('h3'),
                    nav_links: Array.from(document.querySelectorAll('nav a')).map(a => ({
                        text: a.innerText?.trim(),
                        href: a.href
                    })).filter(a => a.text),
                    cta_buttons: Array.from(document.querySelectorAll('a[href*="pricing"], a[href*="signup"], a[href*="register"], button')).map(el => el.innerText?.trim()).filter(Boolean).slice(0, 10),
                    paragraphs: getText('main p, .content p, section p').slice(0, 20),
                    feature_sections: Array.from(document.querySelectorAll('[class*="feature"], [class*="product"], [class*="capability"]')).map(el => el.innerText?.trim()).filter(Boolean).slice(0, 10),
                    meta_description: document.querySelector('meta[name="description"]')?.content || '',
                };
            }""")

            content["url"] = url
            return content

        except Exception as e:
            logger.error("Page scrape failed", url=url, error=str(e))
            return {"url": url, "error": str(e)}
        finally:
            await browser.close()


def scrape_page(url: str) -> dict:
    """Synchronous wrapper for the async scraper."""
    polite_wait(url)
    return asyncio.run(_scrape_page_async(url))


class WebScraper(BaseCollector):
    signal_type = "web_page"

    def __init__(self, competitor_id: str, competitor_config: dict):
        super().__init__(competitor_id)
        self.config = competitor_config
        self.urls = self._get_urls()

    def _get_urls(self) -> list[str]:
        urls = []
        if self.config.get("website"):
            urls.append(self.config["website"])
        return urls

    def collect(self) -> list[dict]:
        results = []
        for url in self.urls:
            content = scrape_page(url)
            if "error" not in content:
                content["competitor_id"] = self.competitor_id
                content["name"] = self.config.get("name", self.competitor_id)
                # Flatten to text for hashing/processing
                text_parts = (
                    content.get("h1", [])
                    + content.get("h2", [])
                    + content.get("paragraphs", [])
                    + content.get("feature_sections", [])
                )
                content["text"] = " ".join(text_parts)
                results.append({"content": content, "source_url": url})
                logger.info("Scraped page", competitor=self.competitor_id, url=url)
            else:
                logger.warning("Scrape failed", competitor=self.competitor_id, url=url)

        return results


def run_all_web_scrapers(competitors: dict) -> int:
    """Run web scraping for all active competitors. Returns total new signals."""
    total = 0
    for competitor_id, config in competitors.items():
        if not config.get("active", False) or not config.get("website"):
            continue
        scraper = WebScraper(competitor_id, config)
        total += scraper.run()
    logger.info("Web scraping complete", total_new_signals=total)
    return total
