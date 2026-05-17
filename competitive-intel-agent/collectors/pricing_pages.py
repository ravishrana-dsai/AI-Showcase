"""
Pricing page collector using Playwright.
"""

import json
import asyncio
from collectors.base_collector import BaseCollector
from utils.logger import get_logger
from utils.rate_limiter import polite_wait
from utils.diff_engine import compute_hash, compute_diff, classify_severity, summarize_diff
from db import database

logger = get_logger(__name__)


async def _scrape_pricing_async(url: str, competitor_name: str) -> dict:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)

            content = await page.evaluate("""() => {
                const getText = (sel) => Array.from(document.querySelectorAll(sel))
                    .map(el => el.innerText?.trim()).filter(Boolean);

                const prices = [];
                document.querySelectorAll('[class*="price"], [class*="plan"], [class*="tier"], [class*="cost"]').forEach(el => {
                    const text = el.innerText?.trim();
                    if (text && text.length > 3) prices.push(text);
                });

                return {
                    title: document.title,
                    h1: getText('h1'),
                    h2: getText('h2'),
                    h3: getText('h3'),
                    price_elements: prices.slice(0, 30),
                    cta_text: getText('[class*="cta"], [class*="button"], button').slice(0, 20),
                    full_text: document.body?.innerText?.replace(/\\s+/g, ' ').substring(0, 8000) || '',
                };
            }""")

            content["url"] = url
            content["name"] = competitor_name
            return content

        except Exception as e:
            logger.error("Pricing scrape failed", url=url, error=str(e))
            return {"url": url, "error": str(e), "name": competitor_name}
        finally:
            await browser.close()


class PricingPageCollector(BaseCollector):
    signal_type = "pricing"

    def __init__(self, competitor_id: str, competitor_config: dict):
        super().__init__(competitor_id)
        self.config = competitor_config
        self.pricing_url = competitor_config.get("pricing_url") or competitor_config.get("website")

    def collect(self) -> list[dict]:
        if not self.pricing_url:
            return []

        polite_wait(self.pricing_url)
        content = asyncio.run(
            _scrape_pricing_async(self.pricing_url, self.config.get("name", self.competitor_id))
        )

        if "error" in content:
            return []

        # Check for change vs last snapshot
        content_hash = compute_hash(content.get("full_text", "") or json.dumps(content))
        prev_snapshot = database.get_latest_snapshot(self.competitor_id, "pricing")

        changed = database.upsert_snapshot(
            competitor_id=self.competitor_id,
            snapshot_type="pricing",
            content_hash=content_hash,
            content_json=json.dumps(content),
        )

        if changed and prev_snapshot:
            prev_content = json.loads(prev_snapshot["content_json"])
            diff = compute_diff(
                prev_content.get("full_text", ""),
                content.get("full_text", ""),
            )
            severity = classify_severity("pricing", diff, self.competitor_id)
            diff_summary = summarize_diff(diff)

            database.insert_change(
                competitor_id=self.competitor_id,
                change_type="pricing",
                current_hash=content_hash,
                previous_hash=prev_snapshot["content_hash"],
                diff_summary=diff_summary,
                severity=severity,
            )
            self.logger.info("Pricing change detected", severity=severity, summary=diff_summary)

        return [{"content": content, "source_url": self.pricing_url}]


def run_all_pricing_collectors(competitors: dict) -> int:
    total = 0
    for competitor_id, config in competitors.items():
        if not config.get("active", False) or not config.get("pricing_url"):
            continue
        collector = PricingPageCollector(competitor_id, config)
        total += collector.run()
    logger.info("Pricing collection complete", total_new_signals=total)
    return total
