"""
Foundation tests: database, diff engine, config.
These tests run without any API keys.
"""

import pytest
import os
import tempfile
from pathlib import Path


@pytest.fixture(autouse=True)
def temp_db(monkeypatch, tmp_path):
    """Use a temp DB for each test."""
    db_path = str(tmp_path / "test_ci_bot.db")
    monkeypatch.setenv("DB_PATH", db_path)
    monkeypatch.setenv("SNAPSHOTS_DIR", str(tmp_path / "snapshots"))
    monkeypatch.setenv("PRDS_DIR", str(tmp_path / "prds"))
    monkeypatch.setenv("LOG_FILE", str(tmp_path / "test.log"))
    # Patch settings before importing db
    from config import settings as settings_module
    settings_module.settings.db_path = db_path
    settings_module.settings.snapshots_dir = str(tmp_path / "snapshots")
    settings_module.settings.prds_dir = str(tmp_path / "prds")
    settings_module.settings.log_file = str(tmp_path / "test.log")
    yield


def test_database_initialize(tmp_path):
    """DB should initialize with all required tables."""
    from db.database import initialize, get_db
    initialize()

    with get_db() as conn:
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        table_names = {t["name"] for t in tables}

    expected = {"raw_signals", "processed_intelligence", "competitor_snapshots",
                "changes", "outputs_sent", "jobs_seen", "prds"}
    assert expected.issubset(table_names), f"Missing tables: {expected - table_names}"


def test_insert_and_dedup_raw_signal():
    from db.database import initialize, insert_raw_signal
    initialize()

    # First insert should succeed
    row_id = insert_raw_signal(
        competitor_id="plasight",
        signal_type="news",
        raw_content='{"title": "PlaSight raises $5M"}',
        content_hash="abc123",
        source_url="https://example.com",
    )
    assert row_id is not None

    # Duplicate hash should return None (deduped)
    row_id2 = insert_raw_signal(
        competitor_id="plasight",
        signal_type="news",
        raw_content='{"title": "PlaSight raises $5M"}',
        content_hash="abc123",
    )
    assert row_id2 is None


def test_snapshot_change_detection():
    from db.database import initialize, upsert_snapshot
    initialize()

    # First snapshot — always considered changed
    changed = upsert_snapshot("plasight", "pricing", "hash1", '{"price": "$20"}')
    assert changed is True

    # Same hash — no change
    changed2 = upsert_snapshot("plasight", "pricing", "hash1", '{"price": "$20"}')
    assert changed2 is False

    # New hash — change detected
    changed3 = upsert_snapshot("plasight", "pricing", "hash2", '{"price": "$25"}')
    assert changed3 is True


def test_diff_engine_hash():
    from utils.diff_engine import compute_hash, normalize

    text1 = "PlaSight offers video analysis   for padel"
    text2 = "PlaSight offers video analysis for padel"  # Extra space in text1

    # Should produce same hash after normalization
    assert compute_hash(text1) == compute_hash(text2)


def test_diff_engine_severity():
    from utils.diff_engine import classify_severity

    pricing_diff = {"change_ratio": 0.05, "additions": ["new price $29/month"]}
    assert classify_severity("pricing", pricing_diff) == "critical"

    funding_diff = {"change_ratio": 0.10, "additions": ["raises $10M Series A"]}
    assert classify_severity("news", funding_diff) == "high"

    minor_diff = {"change_ratio": 0.02, "additions": ["minor copy update"]}
    assert classify_severity("web_page", minor_diff) == "low"


def test_competitors_config():
    from config.competitors import COMPETITORS, get_active_competitors, DREAM_PLAY_PROFILE

    assert len(COMPETITORS) >= 20, "Should have at least 20 competitors"
    active = get_active_competitors()
    assert len(active) >= 15, "Should have at least 15 active competitors"

    # Verify required fields
    for cid, comp in active.items():
        assert "name" in comp, f"{cid} missing 'name'"
        assert "sport" in comp, f"{cid} missing 'sport'"
        assert "website" in comp, f"{cid} missing 'website'"

    assert "features" in DREAM_PLAY_PROFILE
    assert len(DREAM_PLAY_PROFILE["features"]) > 5


def test_rate_limiter():
    import time
    from utils.rate_limiter import RateLimiter

    limiter = RateLimiter(min_delay=0.05, max_delay=0.1)
    start = time.time()
    limiter.wait(domain="test.example.com")
    limiter.wait(domain="test.example.com")
    elapsed = time.time() - start

    # Second call should have waited at least min_delay
    assert elapsed >= 0.05
