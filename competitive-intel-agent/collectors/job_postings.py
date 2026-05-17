"""
Job postings collector: Greenhouse public API + LinkedIn Playwright scrape.
"""

import json
import hashlib
import requests
from collectors.base_collector import BaseCollector
from utils.logger import get_logger
from db import database

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Job relevancy classification
# ---------------------------------------------------------------------------

# Patterns that indicate non-product roles (operations, field service, facilities)
_NON_RELEVANT_PATTERNS = [
    "field service", "field tech", "field engineer", "service technician",
    "installation technician", "installer", "hvac", "facilities",
    "maintenance technician", "maintenance tech", "groundskeeper",
    "court install", "court builder", "construction", "electrician",
    "custodian", "janitorial", "plumber", "handyman", "equipment tech",
    "hardware technician", "court technician", "sports facility",
    "field operations", "on-site technician", "site technician",
    "technical support specialist",  # only when combined with field/on-site context
]

# Patterns that CONFIRM relevance (product/tech/business roles)
_RELEVANT_PATTERNS = [
    "software", "engineer", "developer", "product manager", "product designer",
    "data scientist", "data engineer", "machine learning", "ml engineer",
    "computer vision", "ai engineer", "research scientist", "research engineer",
    "backend", "frontend", "full stack", "mobile", "ios", "android",
    "devops", "platform engineer", "infrastructure", "cloud engineer",
    "designer", "ux", "ui designer", "product design",
    "marketing", "growth", "content", "brand",
    "sales", "business development", "account executive", "partnerships",
    "analytics", "data analyst", "bi engineer",
    "cto", "vp engineering", "vp product", "head of", "director of",
    "chief", "co-founder", "general manager",
    "customer success", "account manager",
    "quality assurance", "qa engineer", "test engineer",
    "security engineer", "reliability engineer",
]


def classify_job_relevance(title: str) -> bool:
    """
    Returns True if the job title is relevant to product/tech/business intelligence.
    Returns False for field service, installation, facilities, and other non-product ops roles.

    Conservative: defaults to True (relevant) when uncertain.
    """
    lower = title.lower()

    # First check explicit non-relevant patterns
    for pattern in _NON_RELEVANT_PATTERNS:
        if pattern in lower:
            # Don't mark as irrelevant if a strong product keyword is also present
            for relevant in ("engineer", "software", "product", "data", "ml", "ai", "mobile"):
                if relevant in lower and pattern not in ("hvac", "construction", "electrician", "plumber"):
                    return True  # e.g. "Field Product Engineer" might still be relevant
            return False

    return True  # Default: relevant


class JobPostingsCollector(BaseCollector):
    signal_type = "job_posting"

    def __init__(self, competitor_id: str, competitor_config: dict):
        super().__init__(competitor_id)
        self.config = competitor_config
        self.greenhouse_slug = competitor_config.get("greenhouse_slug")
        self.linkedin_company = competitor_config.get("linkedin_company")

    def collect(self) -> list[dict]:
        jobs = []
        jobs.extend(self._collect_greenhouse())
        if self.linkedin_company and not jobs:
            # Only fall back to LinkedIn if Greenhouse returned nothing
            jobs.extend(self._collect_linkedin())
        return jobs

    def _collect_greenhouse(self) -> list[dict]:
        if not self.greenhouse_slug:
            return []

        try:
            self.rate_limiter.wait(domain="boards-api.greenhouse.io")
            resp = requests.get(
                f"https://boards-api.greenhouse.io/v1/boards/{self.greenhouse_slug}/jobs",
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

            results = []
            for job in data.get("jobs", []):
                job_hash = hashlib.sha256(f"{self.competitor_id}:{job.get('id', '')}".encode()).hexdigest()
                is_relevant_flag = classify_job_relevance(job.get("title", ""))
                is_new = database.upsert_job(
                    competitor_id=self.competitor_id,
                    job_title=job.get("title", ""),
                    job_hash=job_hash,
                    job_url=job.get("absolute_url"),
                    is_relevant=is_relevant_flag,
                )

                payload = {
                    "title": job.get("title", ""),
                    "department": job.get("departments", [{}])[0].get("name", "") if job.get("departments") else "",
                    "location": job.get("location", {}).get("name", "") if job.get("location") else "",
                    "url": job.get("absolute_url", ""),
                    "id": job.get("id", ""),
                    "is_new": is_new,
                    "is_relevant": is_relevant_flag,
                    "source": "greenhouse",
                    "competitor_id": self.competitor_id,
                }
                results.append({"content": payload, "source_url": payload["url"]})

            logger.info("Greenhouse jobs collected", competitor=self.competitor_id, count=len(results))
            return results

        except requests.HTTPError as e:
            if e.response.status_code == 404:
                logger.debug("Greenhouse board not found", slug=self.greenhouse_slug)
            else:
                logger.error("Greenhouse API error", error=str(e))
            return []
        except Exception as e:
            logger.error("Greenhouse collection failed", error=str(e))
            return []

    def _collect_linkedin(self) -> list[dict]:
        """Playwright-based LinkedIn job scraper (fallback, runs less frequently)."""
        if not self.linkedin_company:
            return []

        try:
            import asyncio
            from playwright.async_api import async_playwright

            async def _scrape():
                from config.settings import settings
                results_inner = []

                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    context = await browser.new_context(
                        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    )
                    page = await context.new_page()

                    try:
                        search_url = (
                            f"https://www.linkedin.com/jobs/search/"
                            f"?keywords={self.linkedin_company}&location=Worldwide&f_TPR=r604800"
                        )
                        self.rate_limiter.wait(domain="linkedin.com")
                        await page.goto(search_url, timeout=20000)
                        await page.wait_for_timeout(3000)

                        jobs = await page.evaluate("""() => {
                            const cards = document.querySelectorAll('.job-search-card, .base-card');
                            return Array.from(cards).slice(0, 20).map(card => ({
                                title: card.querySelector('.base-search-card__title, h3')?.innerText?.trim() || '',
                                company: card.querySelector('.base-search-card__subtitle, h4')?.innerText?.trim() || '',
                                location: card.querySelector('.job-search-card__location, .base-search-card__metadata')?.innerText?.trim() || '',
                                url: card.querySelector('a')?.href || '',
                            }));
                        }""")

                        for job in jobs:
                            if not job.get("title"):
                                continue
                            job_hash = hashlib.sha256(
                                f"{self.competitor_id}:{job['title']}:{job['location']}".encode()
                            ).hexdigest()
                            is_relevant_flag = classify_job_relevance(job.get("title", ""))
                            is_new = database.upsert_job(
                                competitor_id=self.competitor_id,
                                job_title=job["title"],
                                job_hash=job_hash,
                                job_url=job.get("url"),
                                is_relevant=is_relevant_flag,
                            )
                            job["is_new"] = is_new
                            job["is_relevant"] = is_relevant_flag
                            job["source"] = "linkedin"
                            job["competitor_id"] = self.competitor_id
                            results_inner.append({"content": job, "source_url": job.get("url", "")})

                    except Exception as e:
                        logger.warning("LinkedIn scrape failed", competitor=self.competitor_id, error=str(e))
                    finally:
                        await browser.close()

                return results_inner

            results = asyncio.run(_scrape())
            logger.info("LinkedIn jobs scraped", competitor=self.competitor_id, count=len(results))
            return results

        except Exception as e:
            logger.error("LinkedIn collection failed", competitor=self.competitor_id, error=str(e))
            return []


def run_all_job_collectors(competitors: dict) -> int:
    total = 0
    for competitor_id, config in competitors.items():
        if not config.get("active", False):
            continue
        if not config.get("greenhouse_slug") and not config.get("linkedin_company"):
            continue
        collector = JobPostingsCollector(competitor_id, config)
        total += collector.run()
    logger.info("Job posting collection complete", total_new_signals=total)
    return total
