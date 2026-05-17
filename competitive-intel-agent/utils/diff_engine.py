from __future__ import annotations
"""
Content fingerprinting and diff utilities for change detection.
"""

import hashlib
import difflib
import re
import json


def normalize(text: str) -> str:
    """Normalize text for stable hashing (strip whitespace, lowercase, remove dates)."""
    # Lowercase
    text = text.lower()
    # Remove common date patterns that would cause false positives
    text = re.sub(r"\b\d{4}-\d{2}-\d{2}\b", "", text)
    text = re.sub(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s*\d{4}\b", "", text)
    text = re.sub(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", "", text)
    # Collapse whitespace
    text = " ".join(text.split())
    return text


def compute_hash(content: str | dict) -> str:
    """Compute SHA-256 hash of normalized content."""
    if isinstance(content, dict):
        content = json.dumps(content, sort_keys=True)
    normalized = normalize(content)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def compute_diff(old_content: str, new_content: str) -> dict:
    """Compute unified diff between two text blobs."""
    old_lines = old_content.splitlines()
    new_lines = new_content.splitlines()

    differ = list(difflib.unified_diff(old_lines, new_lines, lineterm="", n=2))

    additions = [line[1:] for line in differ if line.startswith("+") and not line.startswith("+++")]
    removals = [line[1:] for line in differ if line.startswith("-") and not line.startswith("---")]

    total_lines = max(len(old_lines), 1)
    change_ratio = len(additions + removals) / total_lines

    return {
        "additions": additions[:20],   # Cap for storage
        "removals": removals[:20],
        "additions_count": len(additions),
        "removals_count": len(removals),
        "change_ratio": round(change_ratio, 4),
    }


def classify_severity(change_type: str, diff: dict, competitor_id: str = "") -> str:
    """
    Rule-based severity classification before Claude enrichment.
    Returns: 'low' | 'medium' | 'high' | 'critical'
    """
    ratio = diff.get("change_ratio", 0)
    additions_text = " ".join(diff.get("additions", [])).lower()

    # Critical signals
    critical_keywords = ["pricing", "price", "per month", "per year", "subscription", "plan"]
    if change_type == "pricing" or any(k in additions_text for k in critical_keywords):
        return "critical"

    # High signals
    high_keywords = ["raise", "funding", "series", "acqui", "launch", "new feature", "partnership"]
    if any(k in additions_text for k in high_keywords):
        return "high"

    # High if large structural change (>30% of page changed)
    if change_type in ("web_page", "features") and ratio > 0.30:
        return "high"

    # Medium signals
    if change_type in ("jobs", "job_postings"):
        return "medium"
    if ratio > 0.10:
        return "medium"

    return "low"


def summarize_diff(diff: dict) -> str:
    """Generate a human-readable one-liner summary of a diff."""
    adds = diff.get("additions_count", 0)
    removes = diff.get("removals_count", 0)
    ratio = diff.get("change_ratio", 0)

    if adds == 0 and removes == 0:
        return "No meaningful changes detected."

    parts = []
    if adds > 0:
        parts.append(f"+{adds} lines added")
    if removes > 0:
        parts.append(f"-{removes} lines removed")

    summary = ", ".join(parts)
    summary += f" ({ratio:.0%} of content changed)"

    # Add sample additions if available
    samples = diff.get("additions", [])[:3]
    if samples:
        snippet = "; ".join(s[:80] for s in samples if s.strip())
        if snippet:
            summary += f'. New content includes: "{snippet}"'

    return summary
