from __future__ import annotations
"""
PostgreSQL database manager using psycopg2 connection pool.
"""

import psycopg2
import psycopg2.extras
import psycopg2.pool
import os
import threading
from pathlib import Path
from contextlib import contextmanager
from config.settings import settings


_pool: psycopg2.pool.ThreadedConnectionPool | None = None
_pool_lock = threading.Lock()


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                db_url = os.environ.get("DATABASE_URL") or settings.database_url
                if not db_url:
                    raise ValueError(
                        "DATABASE_URL environment variable is not set. "
                        "Add DATABASE_URL=postgresql://... to your .env file."
                    )
                _pool = psycopg2.pool.ThreadedConnectionPool(1, 20, db_url)
    return _pool


class _PGConnectionWrapper:
    """Wraps a psycopg2 connection to present a sqlite3-compatible execute() API."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql: str, params=None):
        sql = sql.replace("?", "%s")
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute(sql, params or ())
        return cur

    def executemany(self, sql: str, params_list):
        sql = sql.replace("?", "%s")
        cur = self._conn.cursor()
        for params in params_list:
            cur.execute(sql, params)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()


@contextmanager
def get_db():
    """Context manager yielding a database connection wrapper."""
    pool = _get_pool()
    conn = pool.getconn()
    wrapper = _PGConnectionWrapper(conn)
    try:
        yield wrapper
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def initialize():
    """Run schema.sql to create all tables."""
    schema_path = Path(__file__).parent / "schema.sql"
    with schema_path.open() as f:
        sql = f.read()

    with get_db() as conn:
        for statement in sql.split(";"):
            stmt = statement.strip()
            if stmt:
                conn.execute(stmt)


# ----------------------------------------------------------------
# Generic CRUD helpers
# ----------------------------------------------------------------

def insert_raw_signal(
    competitor_id: str,
    signal_type: str,
    raw_content: str,
    content_hash: str,
    source_url: str | None = None,
) -> int | None:
    """Insert a raw signal; returns rowid or None if duplicate hash exists."""
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM raw_signals WHERE content_hash = %s", (content_hash,)
        ).fetchone()
        if existing:
            return None
        cursor = conn.execute(
            """INSERT INTO raw_signals (competitor_id, signal_type, source_url, content_hash, raw_content)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (competitor_id, signal_type, source_url, content_hash, raw_content),
        )
        row = cursor.fetchone()
        return row[0] if row else None


def get_unprocessed_signals(signal_type: str | None = None, limit: int = 500) -> list[dict]:
    with get_db() as conn:
        if signal_type:
            rows = conn.execute(
                "SELECT * FROM raw_signals WHERE processed = 0 AND signal_type = %s ORDER BY collected_at LIMIT %s",
                (signal_type, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM raw_signals WHERE processed = 0 ORDER BY collected_at LIMIT %s",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]


def mark_signals_processed(ids: list[int]):
    with get_db() as conn:
        conn.executemany(
            "UPDATE raw_signals SET processed = 1 WHERE id = %s",
            [(i,) for i in ids],
        )


def upsert_snapshot(competitor_id: str, snapshot_type: str, content_hash: str, content_json: str) -> bool:
    """Insert a new snapshot. Returns True if content changed (new hash), False if same."""
    with get_db() as conn:
        latest = conn.execute(
            """SELECT content_hash FROM competitor_snapshots
               WHERE competitor_id = %s AND snapshot_type = %s
               ORDER BY snapshot_at DESC LIMIT 1""",
            (competitor_id, snapshot_type),
        ).fetchone()

        if latest and latest["content_hash"] == content_hash:
            return False

        conn.execute(
            """INSERT INTO competitor_snapshots (competitor_id, snapshot_type, content_hash, content_json)
               VALUES (%s, %s, %s, %s)""",
            (competitor_id, snapshot_type, content_hash, content_json),
        )
        return True


def get_latest_snapshot(competitor_id: str, snapshot_type: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            """SELECT * FROM competitor_snapshots
               WHERE competitor_id = %s AND snapshot_type = %s
               ORDER BY snapshot_at DESC LIMIT 1""",
            (competitor_id, snapshot_type),
        ).fetchone()
        return dict(row) if row else None


def insert_change(
    competitor_id: str,
    change_type: str,
    current_hash: str,
    diff_summary: str,
    severity: str = "low",
    previous_hash: str | None = None,
) -> int:
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO changes (competitor_id, change_type, previous_hash, current_hash, diff_summary, severity)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (competitor_id, change_type, previous_hash, current_hash, diff_summary, severity),
        )
        row = cursor.fetchone()
        return row[0]


def get_unalerted_changes(severity_min: str | None = None) -> list[dict]:
    severity_order = {"low": 0, "medium": 1, "high": 2, "critical": 3}
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM changes WHERE alerted = 0 ORDER BY detected_at DESC"
        ).fetchall()
        changes = [dict(r) for r in rows]
        if severity_min:
            min_val = severity_order.get(severity_min, 0)
            changes = [c for c in changes if severity_order.get(c["severity"], 0) >= min_val]
        return changes


def mark_changes_alerted(ids: list[int]):
    with get_db() as conn:
        conn.executemany(
            "UPDATE changes SET alerted = 1 WHERE id = %s",
            [(i,) for i in ids],
        )


def upsert_job(competitor_id: str, job_title: str, job_hash: str, job_url: str | None = None, is_relevant: bool = True) -> bool:
    """Returns True if this is a new job, False if already seen."""
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM jobs_seen WHERE job_hash = %s", (job_hash,)
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE jobs_seen SET last_seen = CURRENT_TIMESTAMP, is_new = 0 WHERE job_hash = %s",
                (job_hash,),
            )
            return False
        conn.execute(
            """INSERT INTO jobs_seen (competitor_id, job_title, job_url, job_hash, is_relevant)
               VALUES (%s, %s, %s, %s, %s)""",
            (competitor_id, job_title, job_url, job_hash, 1 if is_relevant else 0),
        )
        return True


def backfill_job_relevance(classify_fn) -> int:
    """Classify existing jobs_seen rows. Returns count updated."""
    with get_db() as conn:
        rows = conn.execute("SELECT id, job_title FROM jobs_seen").fetchall()
        updated = 0
        for row in rows:
            is_rel = 1 if classify_fn(row["job_title"]) else 0
            conn.execute(
                "UPDATE jobs_seen SET is_relevant=%s WHERE id=%s",
                (is_rel, row["id"])
            )
            updated += 1
    return updated


def insert_processed_intelligence(
    competitor_id: str,
    processor_type: str,
    analysis_json: str,
    summary: str = "",
    confidence_score: float | None = None,
) -> int:
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO processed_intelligence
               (competitor_id, processor_type, analysis_json, summary, confidence_score)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (competitor_id, processor_type, analysis_json, summary, confidence_score),
        )
        row = cursor.fetchone()
        return row[0]


def get_latest_intelligence(competitor_id: str, processor_type: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            """SELECT * FROM processed_intelligence
               WHERE competitor_id = %s AND processor_type = %s
               ORDER BY created_at DESC LIMIT 1""",
            (competitor_id, processor_type),
        ).fetchone()
        return dict(row) if row else None


def insert_prd(
    feature_slug: str,
    title: str,
    concept_summary: str,
    concept_hash: str,
    week: str,
    file_path: str,
    priority_score: float | None = None,
    effort: str | None = None,
) -> int:
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO prds (feature_slug, title, concept_summary, concept_hash, priority_score, effort, week, file_path)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (feature_slug, title, concept_summary, concept_hash, priority_score, effort, week, file_path),
        )
        row = cursor.fetchone()
        return row[0]


def get_prd_concept_hashes() -> set[str]:
    with get_db() as conn:
        rows = conn.execute("SELECT concept_hash FROM prds").fetchall()
        return {r["concept_hash"] for r in rows}


def get_recent_prd_summaries(limit: int = 30) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT title, concept_summary, week FROM prds ORDER BY created_at DESC LIMIT %s",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def track_output_sent(output_type: str, slack_channel: str, message_ts: str, content_hash: str):
    with get_db() as conn:
        conn.execute(
            """INSERT INTO outputs_sent (output_type, slack_channel, message_ts, content_hash)
               VALUES (%s, %s, %s, %s)""",
            (output_type, slack_channel, message_ts, content_hash),
        )


def get_last_output(output_type: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM outputs_sent WHERE output_type = %s ORDER BY sent_at DESC LIMIT 1",
            (output_type,),
        ).fetchone()
        return dict(row) if row else None


def get_connection():
    """Return a raw connection wrapper for use in route handlers. Caller must commit manually."""
    pool = _get_pool()
    conn = pool.getconn()
    return _PGConnectionWrapper(conn)


def insert_llm_usage(
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: float,
    processor_type: str = None,
    competitor_id: str = None,
) -> None:
    """Record LLM API token usage for cost tracking."""
    with get_db() as conn:
        conn.execute(
            """INSERT INTO llm_usage
               (provider, model, processor_type, competitor_id, input_tokens, output_tokens, cost_usd)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (provider, model, processor_type, competitor_id, input_tokens, output_tokens, cost_usd),
        )


def upsert_competitor_profile(competitor_id: str, profile_json: str, content_hash: str) -> bool:
    """Insert or update competitor profile. Returns True if content changed."""
    with get_db() as conn:
        existing = conn.execute(
            "SELECT content_hash FROM competitor_profiles WHERE competitor_id=%s",
            (competitor_id,)
        ).fetchone()
        if existing is None:
            conn.execute(
                "INSERT INTO competitor_profiles (competitor_id, profile_json, content_hash) VALUES (%s,%s,%s)",
                (competitor_id, profile_json, content_hash),
            )
            return True
        if existing[0] == content_hash:
            conn.execute(
                "UPDATE competitor_profiles SET extracted_at=CURRENT_TIMESTAMP WHERE competitor_id=%s",
                (competitor_id,)
            )
            return False
        conn.execute(
            "UPDATE competitor_profiles SET profile_json=%s, content_hash=%s, updated_at=CURRENT_TIMESTAMP, extracted_at=CURRENT_TIMESTAMP WHERE competitor_id=%s",
            (profile_json, content_hash, competitor_id),
        )
        return True


# ----------------------------------------------------------------
# Phase 3C: Self-learning DB helpers
# ----------------------------------------------------------------

def update_signal_quality(signal_id: int, quality_score: float, quality_flags: str) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE raw_signals SET quality_score=%s, quality_flags=%s WHERE id=%s",
            (quality_score, quality_flags, signal_id),
        )


def update_intelligence_eval(intelligence_id: int, confidence_score: float, eval_notes: str) -> None:
    with get_db() as conn:
        conn.execute(
            """UPDATE processed_intelligence
               SET confidence_score=%s, eval_notes=%s, updated_at=CURRENT_TIMESTAMP
               WHERE id=%s""",
            (confidence_score, eval_notes, intelligence_id),
        )


def insert_intelligence_feedback(intelligence_id: int, feedback: int) -> int:
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO intelligence_feedback (intelligence_id, feedback) VALUES (%s, %s) RETURNING id",
            (intelligence_id, feedback),
        )
        row = cursor.fetchone()
        return row[0]


def get_uneval_intelligence(limit: int = 100) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT * FROM processed_intelligence
               WHERE confidence_score IS NULL
               ORDER BY created_at DESC LIMIT %s""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def upsert_source_performance(row: dict) -> None:
    with get_db() as conn:
        conn.execute(
            """INSERT INTO source_performance
               (collector_type, signal_type, week_start, total_signals, scored_signals,
                avg_quality_score, high_quality_pct, avg_eval_score,
                user_positive_pct, llm_cost_usd, bias_adjustment, computed_at)
               VALUES (%(collector_type)s, %(signal_type)s, %(week_start)s, %(total_signals)s,
                       %(scored_signals)s, %(avg_quality_score)s, %(high_quality_pct)s,
                       %(avg_eval_score)s, %(user_positive_pct)s, %(llm_cost_usd)s,
                       %(bias_adjustment)s, CURRENT_TIMESTAMP)
               ON CONFLICT (collector_type, week_start) DO UPDATE SET
                   signal_type=EXCLUDED.signal_type,
                   total_signals=EXCLUDED.total_signals,
                   scored_signals=EXCLUDED.scored_signals,
                   avg_quality_score=EXCLUDED.avg_quality_score,
                   high_quality_pct=EXCLUDED.high_quality_pct,
                   avg_eval_score=EXCLUDED.avg_eval_score,
                   user_positive_pct=EXCLUDED.user_positive_pct,
                   llm_cost_usd=EXCLUDED.llm_cost_usd,
                   bias_adjustment=EXCLUDED.bias_adjustment,
                   computed_at=CURRENT_TIMESTAMP""",
            {**row, "bias_adjustment": row.get("bias_adjustment", 0.0)},
        )


def get_source_performance(weeks: int = 4) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT * FROM source_performance
               WHERE week_start >= (CURRENT_DATE - INTERVAL '%s days')::text
               ORDER BY week_start DESC, avg_eval_score DESC""",
            (weeks * 7,),
        ).fetchall()
        return [dict(r) for r in rows]


# ----------------------------------------------------------------
# Phase 4: Review queue and competitor detail helpers
# ----------------------------------------------------------------

def get_review_queue(limit: int = 50) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT id, competitor_id, processor_type, analysis_json,
                      confidence_score, eval_notes, created_at
               FROM processed_intelligence
               WHERE reviewed_at IS NULL
               ORDER BY created_at DESC LIMIT %s""",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def mark_intelligence_reviewed(intel_id: int) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE processed_intelligence SET reviewed_at = CURRENT_TIMESTAMP WHERE id = %s",
            (intel_id,),
        )


def get_competitor_changes(competitor_id: str, limit: int = 10) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT id, change_type, severity, diff_summary, detected_at
               FROM changes WHERE competitor_id = %s
               ORDER BY detected_at DESC LIMIT %s""",
            (competitor_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def get_competitor_recent_intel(competitor_id: str) -> list[dict]:
    processor_types = ["feature_gap", "hiring_signals", "pricing", "news_digest", "review_sentiment", "narrative"]
    results = []
    with get_db() as conn:
        for pt in processor_types:
            row = conn.execute(
                """SELECT id, processor_type, analysis_json, summary, confidence_score, eval_notes, created_at
                   FROM processed_intelligence
                   WHERE competitor_id = %s AND processor_type = %s
                   ORDER BY created_at DESC LIMIT 1""",
                (competitor_id, pt),
            ).fetchone()
            if row:
                results.append(dict(row))
    return results


def get_competitor_signal_summary(competitor_id: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT signal_type, COUNT(*) as total, MAX(collected_at) as last_collected
               FROM raw_signals WHERE competitor_id = %s GROUP BY signal_type""",
            (competitor_id,),
        ).fetchall()
    return [dict(r) for r in rows]


# ----------------------------------------------------------------
# App settings helpers
# ----------------------------------------------------------------

def get_setting(key: str) -> str | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT value FROM app_settings WHERE key = %s", (key,)
        ).fetchone()
        return row["value"] if row else None


def set_setting(key: str, value: str) -> None:
    with get_db() as conn:
        conn.execute(
            """INSERT INTO app_settings (key, value, updated_at)
               VALUES (%s, %s, CURRENT_TIMESTAMP)
               ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=CURRENT_TIMESTAMP""",
            (key, value),
        )


def get_setting_meta(key: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT key, value, updated_at FROM app_settings WHERE key = %s", (key,)
        ).fetchone()
        return dict(row) if row else None
