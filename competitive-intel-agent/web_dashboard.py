"""
[Company] CI Bot - Web Dashboard
Run: python web_dashboard.py
Opens at: http://localhost:5050
"""

from flask import Flask, jsonify, Response, request
from pathlib import Path
import json
import os
import sys
import subprocess

sys.path.insert(0, str(Path(__file__).parent))

# Load .env before any module reads os.getenv()
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

from utils.logger import setup_logging
setup_logging()

from config.settings import settings
from config.competitors import COMPETITORS as _BASE_COMPETITORS
from db.database import initialize, get_db
from db import database

# -- Timezone helpers ----------------------------------------------------------
from datetime import datetime as _dt, timezone as _tz, timedelta as _td

_IST = _tz(_td(hours=5, minutes=30))


def _to_ist(ts: str, fmt: str = "%Y-%m-%d %H:%M") -> str:
    """Convert a UTC timestamp string (from DB or log) to IST formatted string."""
    if not ts:
        return ""
    try:
        cleaned = ts.strip().rstrip("Z").replace("T", " ")
        dt = _dt.fromisoformat(cleaned).replace(tzinfo=_tz.utc)
        return dt.astimezone(_IST).strftime(fmt)
    except Exception:
        return str(ts)[:16]


def _to_ist_date(ts: str) -> str:
    """Return IST date only (YYYY-MM-DD)."""
    return _to_ist(ts, fmt="%Y-%m-%d")


app = Flask(__name__)

initialize()


# ── Data helpers ──────────────────────────────────────────────────────────────

def get_stats():
    with get_db() as conn:
        total_signals = conn.execute("SELECT COUNT(*) FROM raw_signals").fetchone()[0]
        # Exclude social/trend from unprocessed count — they have no dedicated LLM processor
        # (social feeds trend analysis but is never individually processed)
        unprocessed   = conn.execute(
            "SELECT COUNT(*) FROM raw_signals WHERE processed = 0 AND signal_type NOT IN ('social','trend')"
        ).fetchone()[0]
        changes       = conn.execute("SELECT COUNT(*) FROM changes").fetchone()[0]
        pending_alerts= conn.execute("SELECT COUNT(*) FROM changes WHERE alerted = 0 AND severity IN ('critical','high')").fetchone()[0]
        prds          = conn.execute("SELECT COUNT(*) FROM prds").fetchone()[0]
        intel_reports = conn.execute("SELECT COUNT(*) FROM processed_intelligence").fetchone()[0]
        jobs_tracked  = conn.execute("SELECT COUNT(*) FROM jobs_seen").fetchone()[0]
    return {
        "total_signals": total_signals,
        "unprocessed": unprocessed,
        "changes": changes,
        "pending_alerts": pending_alerts,
        "prds": prds,
        "intel_reports": intel_reports,
        "jobs_tracked": jobs_tracked,
    }


def get_signals_by_type():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT signal_type, COUNT(*) as cnt FROM raw_signals GROUP BY signal_type ORDER BY cnt DESC"
        ).fetchall()
    return [{"type": r["signal_type"], "count": r["cnt"]} for r in rows]


def get_top_competitors():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT s.competitor_id, COUNT(*) as cnt,
                   MAX(pi.created_at) as latest_intel
            FROM raw_signals s
            LEFT JOIN processed_intelligence pi ON pi.competitor_id = s.competitor_id
            GROUP BY s.competitor_id
            ORDER BY cnt DESC
            LIMIT 15
        """).fetchall()
    return [{"competitor": r["competitor_id"], "signals": r["cnt"],
             "latest_intel": r["latest_intel"] or "none yet"} for r in rows]


def get_recent_changes():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT competitor_id, change_type, diff_summary, severity, detected_at
            FROM changes ORDER BY detected_at DESC LIMIT 20
        """).fetchall()
    return [dict(r) for r in rows]


def get_prds():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, title, week, priority_score, effort, concept_summary, created_at FROM prds ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_prd_content(prd_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT title, week, priority_score, effort, concept_summary, file_path, created_at FROM prds WHERE id = ?",
            (prd_id,)
        ).fetchone()
    if not row:
        return None
    prd = dict(row)
    if prd.get("file_path"):
        fp = Path(prd["file_path"])
        if fp.exists():
            prd["markdown"] = fp.read_text()
        else:
            prd["markdown"] = None
    else:
        prd["markdown"] = None
    return prd


def get_activity_log(limit=40):
    log_path = Path(settings.log_file)
    if not log_path.exists():
        return []
    # Read more lines than needed since the file may contain non-JSON lines
    # (Flask access logs, APScheduler messages, etc.)
    raw_lines = log_path.read_text().splitlines()[-(limit * 20):]
    entries = []
    for line in reversed(raw_lines):
        if not line.startswith("{"):
            continue
        try:
            obj = json.loads(line)
            entries.append({
                "time": _to_ist(obj.get("timestamp", "")),
                "level": obj.get("level", "info").upper(),
                "message": obj.get("event", ""),
                "logger": obj.get("logger", ""),
            })
            if len(entries) >= limit:
                break
        except Exception:
            pass
    return entries


def get_collector_status():
    """Parse log + DB to find last run time for each collector."""
    log_path = Path(settings.log_file)

    # Map: key → (label, log_patterns, db_signal_type)
    collector_map = {
        "news":          ("News Feeds",     ["news", "NewsFeed", "NewsCollector", "MarketNews"],       "news"),
        "app_reviews":   ("App Reviews",    ["app_reviews", "AppReview"],                              None),
        "social_signals":("Social Signals", ["social_signals", "SocialSignal", "Reddit"],              "social"),
        "job_postings":  ("Job Postings",   ["job_postings", "JobPosting"],                            "job_posting"),
        "web_scraper":   ("Web Scraper",    ["web_scraper", "WebScraper"],                             "web_page"),
        "pricing_pages": ("Pricing Pages",  ["pricing_pages", "PricingPage"],                         "pricing"),
        "trend_research":("Trend Research", ["trend_research", "TrendResearch"],                       "trend"),
        "patent_filings":("Patent Filings", ["patent_filings", "PatentFiling"],                       "patent"),
    }

    collectors = {k: {"label": v[0], "last_run": None, "last_count": None}
                  for k, v in collector_map.items()}

    # Parse log for timestamps
    if log_path.exists():
        for line in log_path.read_text().splitlines():
            try:
                obj = json.loads(line)
                logger_name = obj.get("logger", "").lower()
                ts = _to_ist(obj.get("timestamp", ""))
                for key, (label, patterns, _) in collector_map.items():
                    if any(p.lower() in logger_name for p in patterns):
                        collectors[key]["last_run"] = ts
                        if "total_new_signals" in obj:
                            collectors[key]["last_count"] = obj["total_new_signals"]
                        elif "new_signals" in obj:
                            collectors[key]["last_count"] = obj["new_signals"]
            except Exception:
                pass

    # Fallback: check DB signal counts — if signals exist, collector has run
    try:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT signal_type, COUNT(*), MAX(collected_at) FROM raw_signals GROUP BY signal_type"
            ).fetchall()
        db_counts = {r[0]: (r[1], _to_ist(r[2] or "")) for r in rows}
        for key, (label, patterns, sig_type) in collector_map.items():
            if sig_type and sig_type in db_counts:
                cnt, latest = db_counts[sig_type]
                if collectors[key]["last_run"] is None and latest:
                    collectors[key]["last_run"] = latest
                if collectors[key]["last_count"] is None:
                    collectors[key]["last_count"] = cnt
    except Exception:
        pass

    return list(collectors.values())


def get_processor_status():
    """Check processed_intelligence for what's been run."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT processor_type, COUNT(*) as cnt, MAX(created_at) as last_run
            FROM processed_intelligence
            GROUP BY processor_type
        """).fetchall()
    return [{"processor": r["processor_type"], "count": r["cnt"],
             "last_run": _to_ist(r["last_run"] or "")} for r in rows]


def get_schedule():
    return [
        {"time": "Weekdays 11:30am", "job": "News collection"},
        {"time": "Weekdays 11:45am", "job": "App reviews"},
        {"time": "Weekdays 12:00pm", "job": "Social signals (Reddit)"},
        {"time": "Weekdays 12:15pm", "job": "Job postings"},
        {"time": "Weekdays 12:30pm", "job": "Change detection + alerts"},
        {"time": "Mon/Thu 2:00pm",   "job": "Web scrape (Playwright)"},
        {"time": "Mon/Thu 3:00pm",   "job": "Pricing scrape"},
        {"time": "Tue/Fri 1:00pm",   "job": "Trend research"},
        {"time": "Mon 12:00pm",      "job": "Weekly CI brief to Slack"},
        {"time": "Fri 4:00pm",       "job": "Battle card refresh"},
        {"time": "Fri 5:30pm",       "job": "Trend analysis + PRDs"},
        {"time": "Sat 11:00am",      "job": "Patent collection"},
    ]


def get_output_locations():
    db_path   = Path(settings.db_path)
    log_path  = Path(settings.log_file)
    prds_dir  = Path(settings.prds_dir)
    snaps_dir = Path(settings.snapshots_dir)

    def size(p):
        if p.exists():
            s = p.stat().st_size
            return f"{s/1024:.1f} KB" if s < 1024*1024 else f"{s/1024/1024:.1f} MB"
        return "not found"

    prd_count  = len(list(prds_dir.rglob("*.md")))   if prds_dir.exists()  else 0
    snap_count = len(list(snaps_dir.rglob("*.json"))) if snaps_dir.exists() else 0

    return {
        "db":        {"path": str(db_path),   "size": size(db_path)},
        "log":       {"path": str(log_path),  "size": size(log_path)},
        "prds":      {"path": str(prds_dir),  "count": prd_count},
        "snapshots": {"path": str(snaps_dir), "count": snap_count},
        "slack": [
            {"channel": "#competitive-intel", "purpose": "Weekly CI brief"},
            {"channel": "#ci-alerts",         "purpose": "Critical/high changes"},
            {"channel": "#ci-prds",           "purpose": "Weekly PRD summaries"},
        ]
    }


def get_outputs_data():
    """Pull all output types for the Outputs tab."""
    with get_db() as conn:
        # Changelog — recent high/critical changes
        changes = conn.execute("""
            SELECT c.competitor_id, c.change_type, c.severity, c.diff_summary AS summary,
                   c.detected_at, c.alerted
            FROM changes c
            ORDER BY c.detected_at DESC LIMIT 30
        """).fetchall()

        # Intel reports — full analysis_json so JS can parse it completely
        intel = conn.execute("""
            SELECT pi.competitor_id, pi.processor_type, pi.created_at,
                   pi.analysis_json as preview
            FROM processed_intelligence pi
            ORDER BY pi.created_at DESC LIMIT 50
        """).fetchall()

        # Outputs sent to Slack
        sent = conn.execute("""
            SELECT output_type, slack_channel as target, sent_at as created_at
            FROM outputs_sent
            ORDER BY sent_at DESC LIMIT 20
        """).fetchall()

    return {
        "changes":   [dict(r) for r in changes],
        "intel":     [dict(r) for r in intel],
        "sent":      [dict(r) for r in sent],
    }


def get_api_key_status():
    env_path = Path(__file__).parent / ".env"
    has_anthropic = bool(os.environ.get("ANTHROPIC_API_KEY", ""))
    has_gemini    = bool(os.environ.get("GEMINI_API_KEY", ""))
    if not has_anthropic and env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("ANTHROPIC_API_KEY=") and len(line) > 20:
                has_anthropic = True
            if line.startswith("GEMINI_API_KEY=") and len(line) > 17:
                has_gemini = True
    return {"anthropic": has_anthropic, "gemini": has_gemini}


def is_scheduler_running():
    try:
        result = subprocess.run(["pgrep", "-f", "main.py"], capture_output=True, text=True)
        pids = [p for p in result.stdout.strip().split() if p]
        # Exclude the web_dashboard's own python processes
        my_pid = str(os.getpid())
        return any(p != my_pid for p in pids)
    except Exception:
        return False


# ── Competitors custom config ──────────────────────────────────────────────────

_CUSTOM_FILE = Path(__file__).parent / "data" / "competitors_custom.json"


def _load_custom() -> dict:
    if _CUSTOM_FILE.exists():
        try:
            return json.loads(_CUSTOM_FILE.read_text())
        except Exception:
            return {}
    return {}


def _save_custom(data: dict):
    _CUSTOM_FILE.parent.mkdir(parents=True, exist_ok=True)
    _CUSTOM_FILE.write_text(json.dumps(data, indent=2))


def get_all_competitors() -> list:
    """Merge base config + custom overrides, enrich with DB signal stats."""
    custom = _load_custom()
    merged: dict = {}
    for cid, cfg in _BASE_COMPETITORS.items():
        merged[cid] = dict(cfg)
    for cid, cfg in custom.items():
        if cid in merged:
            merged[cid].update(cfg)
        else:
            merged[cid] = dict(cfg)

    try:
        with get_db() as conn:
            rows = conn.execute("""
                SELECT competitor_id, COUNT(*) as cnt, MAX(collected_at) as last_signal
                FROM raw_signals GROUP BY competitor_id
            """).fetchall()
            job_rows = conn.execute("""
                SELECT competitor_id, COUNT(*) as cnt
                FROM raw_signals WHERE signal_type='job_posting'
                GROUP BY competitor_id
            """).fetchall()
            review_rows = conn.execute("""
                SELECT competitor_id, COUNT(*) as cnt
                FROM raw_signals WHERE signal_type='app_review'
                GROUP BY competitor_id
            """).fetchall()
            relevant_job_rows = conn.execute("""
                SELECT competitor_id, COUNT(*) as cnt
                FROM jobs_seen WHERE is_relevant=1
                GROUP BY competitor_id
            """).fetchall()
            total_job_rows = conn.execute("""
                SELECT competitor_id, COUNT(*) as cnt
                FROM jobs_seen
                GROUP BY competitor_id
            """).fetchall()
        db_stats = {r["competitor_id"]: {"signal_count": r["cnt"], "last_signal": r["last_signal"]} for r in rows}
        job_counts = {r["competitor_id"]: r["cnt"] for r in job_rows}
        review_counts = {r["competitor_id"]: r["cnt"] for r in review_rows}
        relevant_job_counts = {r["competitor_id"]: r["cnt"] for r in relevant_job_rows}
        total_job_counts = {r["competitor_id"]: r["cnt"] for r in total_job_rows}
    except Exception:
        db_stats = {}
        job_counts = {}
        review_counts = {}
        relevant_job_counts = {}
        total_job_counts = {}

    result = []
    for cid, cfg in merged.items():
        st = db_stats.get(cid, {})
        comp_id = cid
        job_signal_count = job_counts.get(cid, 0)
        relevant_job_count = relevant_job_counts.get(cid, 0)
        total_job_count = total_job_counts.get(cid, 0)

        # Look up processed hiring intel for quality-weighted threat score
        try:
            with get_db() as conn:
                hiring_row = conn.execute(
                    "SELECT analysis_json FROM processed_intelligence "
                    "WHERE competitor_id=? AND processor_type='hiring' ORDER BY created_at DESC LIMIT 1",
                    (comp_id,)
                ).fetchone()
            if hiring_row:
                try:
                    aj = json.loads(hiring_row[0])
                    quality_inferences = [
                        r for r in aj.get('roadmap_inferences', [])
                        if r.get('confidence') in ('high', 'medium')
                    ]
                    velocity = aj.get('hiring_velocity', 'stable')
                    velocity_bonus = {'rapidly_growing': 15, 'growing': 8, 'stable': 0, 'contracting': -5}.get(velocity, 0)
                    hiring_threat = len(quality_inferences)
                    hiring_velocity_label = velocity
                except Exception:
                    hiring_threat = min(3, (relevant_job_count or 0) // 20)
                    velocity_bonus = 0
                    hiring_velocity_label = 'unknown'
            else:
                hiring_threat = min(3, (relevant_job_count or 0) // 20)
                velocity_bonus = 0
                hiring_velocity_label = 'unprocessed'
        except Exception:
            hiring_threat = min(3, (relevant_job_count or 0) // 20)
            velocity_bonus = 0
            hiring_velocity_label = 'unknown'

        result.append({
            "id": cid,
            "name": cfg.get("name", cid),
            "sport": cfg.get("sport", []),
            "tier": cfg.get("tier", "unknown"),
            "website": cfg.get("website", ""),
            "pricing_url": cfg.get("pricing_url", ""),
            "app_store_id": cfg.get("app_store_id"),
            "play_store_id": cfg.get("play_store_id"),
            "linkedin_company": cfg.get("linkedin_company", ""),
            "twitter_handle": cfg.get("twitter_handle", ""),
            "news_keywords": cfg.get("news_keywords", []),
            "active": cfg.get("active", True),
            "signal_count": st.get("signal_count", 0),
            "last_signal": st.get("last_signal"),
            "job_signal_count": relevant_job_count,
            "relevant_job_count": relevant_job_count,
            "total_job_count": total_job_count,
            "app_review_count": review_counts.get(cid, 0),
            "hiring_threat": hiring_threat,
            "velocity_bonus": velocity_bonus,
            "hiring_velocity_label": hiring_velocity_label,
        })
    result.sort(key=lambda x: x["signal_count"], reverse=True)
    # Ensure padel and pickleball are mandatory sports for every competitor
    mandatory = {"padel", "pickleball"}
    for entry in result:
        entry["sport"] = sorted(set(entry["sport"]) | mandatory)
    return result


def get_competitor_signals(comp_id: str, limit: int = 50) -> list:
    with get_db() as conn:
        rows = conn.execute("""
            SELECT signal_type, raw_content, source_url, collected_at, processed
            FROM raw_signals WHERE competitor_id = ?
            ORDER BY collected_at DESC LIMIT ?
        """, (comp_id, limit)).fetchall()
    return [dict(r) for r in rows]


def get_competitor_intelligence(comp_id: str) -> list:
    with get_db() as conn:
        rows = conn.execute("""
            SELECT processor_type, analysis_json, confidence_score, created_at
            FROM processed_intelligence WHERE competitor_id = ?
            ORDER BY created_at DESC
        """, (comp_id,)).fetchall()
    return [dict(r) for r in rows]


def get_competitor_changes_data(comp_id: str) -> list:
    with get_db() as conn:
        rows = conn.execute("""
            SELECT change_type, severity, diff_summary, detected_at, alerted
            FROM changes WHERE competitor_id = ?
            ORDER BY detected_at DESC LIMIT 20
        """, (comp_id,)).fetchall()
    return [dict(r) for r in rows]


def get_collector_signals(signal_type: str, limit: int = 30) -> list:
    with get_db() as conn:
        rows = conn.execute("""
            SELECT competitor_id, raw_content, source_url, collected_at
            FROM raw_signals WHERE signal_type = ?
            ORDER BY collected_at DESC LIMIT ?
        """, (signal_type, limit)).fetchall()
    return [dict(r) for r in rows]


# ── API endpoints ─────────────────────────────────────────────────────────────



@app.route("/api/data")
def api_data():
    return jsonify({
        "stats":            get_stats(),
        "signals_by_type":  get_signals_by_type(),
        "top_competitors":  get_top_competitors(),
        "recent_changes":   get_recent_changes(),
        "prds":             get_prds(),
        "activity_log":     get_activity_log(),
        "collector_status": get_collector_status(),
        "processor_status": get_processor_status(),
        "schedule":         get_schedule(),
        "output_locations": get_output_locations(),
        "scheduler_running": is_scheduler_running(),
        "outputs":          get_outputs_data(),
        "api_keys":         get_api_key_status(),
    })


@app.route("/api/set-key", methods=["POST"])
def api_set_key():
    """Write API key to .env so processors can run."""
    data     = request.json or {}
    provider = data.get("provider", "")
    key      = (data.get("key") or "").strip()
    if provider not in ("anthropic", "gemini") or not key:
        return jsonify({"error": "bad request"}), 400
    env_path = Path(__file__).parent / ".env"
    # Read existing or copy from example
    if env_path.exists():
        lines = env_path.read_text().splitlines()
    else:
        ex = Path(__file__).parent / ".env.example"
        lines = ex.read_text().splitlines() if ex.exists() else []

    var_name = "ANTHROPIC_API_KEY" if provider == "anthropic" else "GEMINI_API_KEY"
    updated  = False
    new_lines = []
    for ln in lines:
        if ln.startswith(var_name + "="):
            new_lines.append(f"{var_name}={key}")
            updated = True
        else:
            new_lines.append(ln)
    if not updated:
        new_lines.append(f"{var_name}={key}")
    env_path.write_text("\n".join(new_lines) + "\n")
    # Also set in current process env so it takes effect immediately
    os.environ[var_name] = key
    return jsonify({"ok": True, "provider": provider})


@app.route("/api/run-trend-analysis", methods=["POST"])
def api_run_trend_analysis():
    with _run_lock:
        if _active_proc["proc"] and _active_proc["proc"].poll() is None:
            return jsonify({"error": "A process is already running"}), 409
    proj = _os.path.dirname(_os.path.abspath(__file__))
    py   = _PY
    # Pass env vars so the key is available in the subprocess
    env  = _os.environ.copy()
    proc = subprocess.Popen(
        [py, "main.py", "--run-trend-analysis"],
        cwd=proj, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, text=True, bufsize=1, env=env
    )
    with _run_lock:
        _active_proc["proc"] = proc
        _active_proc["name"] = "trend-analysis"
    _threading.Thread(target=_stream_proc, args=(proc, "trend-analysis"), daemon=True).start()
    return jsonify({"ok": True})


@app.route("/api/prd/<int:prd_id>")
def api_prd(prd_id):
    prd = get_prd_content(prd_id)
    if not prd:
        return jsonify({"error": "not found"}), 404
    return jsonify(prd)


@app.route("/api/costs")
def api_costs():
    """LLM API cost summary for the Cost tab."""
    try:
        conn = database.get_connection()
        # Check if table exists (may not if no LLM calls yet)
        table_exists = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='llm_usage'"
        ).fetchone()
        if not table_exists:
            return jsonify({"daily": [], "by_processor": [], "totals": [], "grand_total": 0.0})

        daily = [dict(r) for r in conn.execute("""
            SELECT date(called_at) as day, provider,
                   SUM(input_tokens) as input_tok,
                   SUM(output_tokens) as output_tok,
                   SUM(cost_usd) as cost,
                   COUNT(*) as calls
            FROM llm_usage
            WHERE called_at >= date('now', '-30 days')
            GROUP BY day, provider
            ORDER BY day DESC
        """).fetchall()]

        by_proc = [dict(r) for r in conn.execute("""
            SELECT COALESCE(processor_type, 'unknown') as processor_type,
                   SUM(cost_usd) as cost,
                   SUM(input_tokens + output_tokens) as tokens,
                   COUNT(*) as calls,
                   AVG(cost_usd) as avg_cost
            FROM llm_usage
            GROUP BY processor_type
            ORDER BY cost DESC
        """).fetchall()]

        totals = [dict(r) for r in conn.execute("""
            SELECT provider,
                   SUM(cost_usd) as total_cost,
                   SUM(input_tokens) as total_input,
                   SUM(output_tokens) as total_output,
                   COUNT(*) as total_calls
            FROM llm_usage
            GROUP BY provider
        """).fetchall()]

        grand_total = conn.execute("SELECT COALESCE(SUM(cost_usd),0) FROM llm_usage").fetchone()[0]
        this_month = conn.execute(
            "SELECT COALESCE(SUM(cost_usd),0) FROM llm_usage WHERE strftime('%Y-%m', called_at) = strftime('%Y-%m', 'now')"
        ).fetchone()[0]
        avg_daily = conn.execute(
            "SELECT COALESCE(SUM(cost_usd),0)/7.0 FROM llm_usage WHERE called_at >= date('now','-7 days')"
        ).fetchone()[0]

        return jsonify({
            "daily": daily,
            "by_processor": by_proc,
            "totals": totals,
            "grand_total": round(grand_total, 6),
            "this_month": round(this_month, 6),
            "avg_daily_7d": round(avg_daily, 6),
        })
    except Exception as e:
        return jsonify({"error": str(e), "daily": [], "by_processor": [], "totals": [], "grand_total": 0.0})


@app.route("/api/competitor-profile/<competitor_id>")
def api_competitor_profile(competitor_id):
    """Get structured profile for a competitor."""
    try:
        conn = database.get_connection()
        if not conn.execute("SELECT to_regclass('competitor_profiles')").fetchone()[0]:
            return jsonify({"profile": None, "extracted_at": None})
        row = conn.execute(
            "SELECT profile_json, extracted_at FROM competitor_profiles WHERE competitor_id=?",
            (competitor_id,)
        ).fetchone()
        if not row:
            return jsonify({"profile": None, "extracted_at": None})
        return jsonify({"profile": json.loads(row[0]), "extracted_at": row[1]})
    except Exception as e:
        return jsonify({"profile": None, "error": str(e)})


@app.route("/api/run-profile-extraction", methods=["POST"])
def api_run_profile_extraction():
    """Trigger profile extraction for all competitors (async)."""
    import threading
    def _run():
        try:
            from config.competitors import get_active_competitors
            from processors.company_profile_extractor import run_all_profile_extractions
            run_all_profile_extractions(get_active_competitors())
        except Exception as e:
            pass
    threading.Thread(target=_run, daemon=True).start()
    return jsonify({"ok": True, "message": "Profile extraction started for all competitors"})


# ── Run collector endpoint ────────────────────────────────────────────────────
import subprocess, queue as _queue, threading as _threading, sys as _sys, os as _os, shlex as _shlex

# Prefer the project venv Python so subprocesses have all packages installed
_PROJ_DIR = _os.path.dirname(_os.path.abspath(__file__))
_VENV_PY = _os.path.join(_PROJ_DIR, ".venv", "bin", "python")
_PY = _VENV_PY if _os.path.isfile(_VENV_PY) else _sys.executable

_run_log: list = []          # rolling log of last 200 lines
_run_lock = _threading.Lock()
_active_proc = {"proc": None, "name": ""}

ALLOWED_COLLECTORS = {
    "news":     "news",
    "jobs":     "jobs",
    "trends":   "trends",
    "pricing":  "pricing",
    "social":   "social",
    "patents":  "patents",
    "reviews":  "reviews",
    "twitter":  "twitter",
    "linkedin": "linkedin",
}

def _stream_proc(proc, name):
    with _run_lock:
        _run_log.clear()
        _run_log.append(f"[START] Running collector: {name}\n")
    for line in proc.stdout:
        with _run_lock:
            _run_log.append(line)
            if len(_run_log) > 200:
                _run_log.pop(0)
    proc.wait()
    with _run_lock:
        _run_log.append(f"[DONE] Exit code: {proc.returncode}\n")
        _active_proc["proc"] = None
        _active_proc["name"] = ""

@app.route("/api/run/<collector>", methods=["POST"])
def api_run(collector):
    if collector not in ALLOWED_COLLECTORS:
        return jsonify({"error": "unknown collector"}), 400
    with _run_lock:
        if _active_proc["proc"] and _active_proc["proc"].poll() is None:
            return jsonify({"error": "A collector is already running", "active": _active_proc["name"]}), 409
    proj = _os.path.dirname(_os.path.abspath(__file__))
    py   = _PY
    cmd  = [py, "main.py", "--run-collector", ALLOWED_COLLECTORS[collector]]
    proc = subprocess.Popen(cmd, cwd=proj, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, bufsize=1)
    with _run_lock:
        _active_proc["proc"] = proc
        _active_proc["name"] = collector
    _threading.Thread(target=_stream_proc, args=(proc, collector), daemon=True).start()
    return jsonify({"ok": True, "collector": collector})

@app.route("/api/run-processors", methods=["POST"])
def api_run_processors():
    """Run LLM processors against unprocessed signals backlog.

    Runs each processor that has matching unprocessed signals, in order:
    hiring (job_posting), pricing (pricing), features (web_page), news (news).
    Social and trend signals are excluded — they feed the trend analyzer and
    have no individual processing step.
    """
    with _run_lock:
        if _active_proc["proc"] and _active_proc["proc"].poll() is None:
            return jsonify({"error": "A process is already running", "active": _active_proc["name"]}), 409

    # Figure out which processors actually have work to do
    try:
        with get_db() as conn:
            type_counts = {
                r[0]: r[1] for r in conn.execute(
                    "SELECT signal_type, COUNT(*) FROM raw_signals WHERE processed=0 "
                    "AND signal_type NOT IN ('social','trend') GROUP BY signal_type"
                ).fetchall()
            }
    except Exception:
        type_counts = {}

    # Map signal types to main.py --run-processor arguments
    _proc_map = [
        ("job_posting", "hiring"),
        ("pricing",     "pricing"),
        ("web_page",    "features"),
        ("news",        "news"),
        ("app_review",  "reviews"),
    ]
    to_run = [arg for sig_type, arg in _proc_map if type_counts.get(sig_type, 0) > 0]

    if not to_run:
        # All processable signals are done; run full orchestrator for synthesis
        to_run = ["hiring", "pricing"]  # still generate intel from what exists

    proj = _os.path.dirname(_os.path.abspath(__file__))
    py   = _PY
    env  = _os.environ.copy()

    # Build a shell script that runs each processor in sequence
    # Quote py path — project dir contains spaces ("/Competitive DP Agent/")
    quoted_py = _shlex.quote(py)
    cmds = " && ".join([f'echo "[PROC] Running {arg} processor..." && {quoted_py} main.py --run-processor {arg}' for arg in to_run])
    # Log what we're about to do
    with _run_lock:
        _run_log.clear()
        _run_log.append(f"[START] Processing backlog: {', '.join(to_run)} ({sum(type_counts.get(s,0) for s,_ in _proc_map if _ in to_run)} signals)\n")

    proc = subprocess.Popen(
        ["bash", "-c", cmds],
        cwd=proj, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, text=True, bufsize=1, env=env
    )
    with _run_lock:
        _active_proc["proc"] = proc
        _active_proc["name"] = "processors"
    _threading.Thread(target=_stream_proc, args=(proc, "processors"), daemon=True).start()
    return jsonify({"ok": True, "running": to_run, "signal_counts": type_counts})


@app.route("/api/run-backfill-reviews", methods=["POST"])
def api_backfill_reviews():
    """Backfill app reviews for all competitors with store IDs."""
    with _run_lock:
        if _active_proc["proc"] and _active_proc["proc"].poll() is None:
            return jsonify({"error": "A process is already running", "active": _active_proc["name"]}), 409
    proj = _os.path.dirname(_os.path.abspath(__file__))
    py   = _PY
    env  = _os.environ.copy()
    proc = subprocess.Popen(
        [py, "main.py", "--run-collector", "reviews"],
        cwd=proj, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, text=True, bufsize=1, env=env
    )
    with _run_lock:
        _active_proc["proc"] = proc
        _active_proc["name"] = "reviews-backfill"
    _threading.Thread(target=_stream_proc, args=(proc, "reviews-backfill"), daemon=True).start()
    return jsonify({"ok": True})


@app.route("/api/run-job-relevance-backfill", methods=["POST"])
def api_job_relevance_backfill():
    """Retroactively classify all jobs_seen rows by title relevance."""
    try:
        from collectors.job_postings import classify_job_relevance
        conn = database.get_connection()
        rows = conn.execute("SELECT id, job_title FROM jobs_seen").fetchall()
        relevant = 0
        irrelevant = 0
        for row in rows:
            is_rel = 1 if classify_job_relevance(row["job_title"] or "") else 0
            conn.execute("UPDATE jobs_seen SET is_relevant=? WHERE id=?", (is_rel, row["id"]))
            if is_rel:
                relevant += 1
            else:
                irrelevant += 1
        conn.commit()
        return jsonify({"ok": True, "relevant": relevant, "irrelevant": irrelevant, "total": len(rows)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/start-scheduler", methods=["POST"])
def api_start_scheduler():
    if is_scheduler_running():
        return jsonify({"ok": True, "message": "Scheduler already running"})
    proj = _os.path.dirname(_os.path.abspath(__file__))
    py   = _PY
    env  = _os.environ.copy()
    # Start main.py in background — it will run the scheduler loop
    proc = subprocess.Popen(
        [py, "main.py"],
        cwd=proj, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, text=True, bufsize=1, env=env
    )
    _threading.Thread(target=_stream_proc, args=(proc, "scheduler"), daemon=True).start()
    return jsonify({"ok": True, "pid": proc.pid})


@app.route("/api/run-log")
def api_run_log():
    def generate():
        import time
        sent = 0
        idle_ticks = 0
        while True:
            with _run_lock:
                lines = _run_log[sent:]
                sent  = len(_run_log)
                active = bool(_active_proc["proc"] and _active_proc["proc"].poll() is None)
            for line in lines:
                yield f"data: {line.rstrip()}\n\n"
            if not active:
                # Send any remaining lines then close the stream
                if lines:
                    yield "data: [IDLE]\n\n"
                    break
                # No active process and no new lines: wait briefly then close
                idle_ticks += 1
                if idle_ticks > 10:  # ~3 seconds of no activity
                    yield "data: [IDLE]\n\n"
                    break
            else:
                idle_ticks = 0
            time.sleep(0.3)
    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.route("/api/run-status")
def api_run_status():
    with _run_lock:
        active = bool(_active_proc["proc"] and _active_proc["proc"].poll() is None)
        name   = _active_proc["name"]
    return jsonify({"active": active, "name": name})


# ── Competitors / Collectors API ───────────────────────────────────────────────

@app.route("/api/competitors")
def api_competitors():
    return jsonify(get_all_competitors())


@app.route("/api/competitor/<comp_id>/signals")
def api_competitor_signals(comp_id):
    return jsonify(get_competitor_signals(comp_id))


@app.route("/api/competitor/<comp_id>/intelligence")
def api_competitor_intelligence(comp_id):
    return jsonify(get_competitor_intelligence(comp_id))


@app.route("/api/competitor/<comp_id>/changes")
def api_competitor_changes_route(comp_id):
    return jsonify(get_competitor_changes_data(comp_id))


@app.route("/api/collector/<coll_type>/signals")
def api_collector_signals(coll_type):
    signal_type_map = {
        "news": "news", "reviews": "app_review", "social": "social",
        "jobs": "job_posting", "web": "web_page", "pricing": "pricing",
        "trends": "trend", "patents": "patent",
    }
    sig = signal_type_map.get(coll_type, coll_type)
    return jsonify(get_collector_signals(sig))


@app.route("/api/research_feed")
def api_research_feed():
    with get_db() as db:
        news = db.execute(
            "SELECT competitor_id, raw_content, source_url, collected_at FROM raw_signals "
            "WHERE signal_type='news' ORDER BY collected_at DESC LIMIT 20"
        ).fetchall()
        trends = db.execute(
            "SELECT competitor_id, raw_content, source_url, collected_at FROM raw_signals "
            "WHERE signal_type='trend' ORDER BY collected_at DESC LIMIT 20"
        ).fetchall()
        social = db.execute(
            "SELECT competitor_id, raw_content, source_url, collected_at FROM raw_signals "
            "WHERE signal_type='social' ORDER BY collected_at DESC LIMIT 30"
        ).fetchall()
        pricing = db.execute(
            "SELECT competitor_id, raw_content, source_url, collected_at FROM raw_signals "
            "WHERE signal_type='pricing' ORDER BY collected_at DESC LIMIT 10"
        ).fetchall()
        jobs = db.execute(
            "SELECT competitor_id, raw_content, source_url, collected_at FROM raw_signals "
            "WHERE signal_type='job_posting' ORDER BY collected_at DESC LIMIT 30"
        ).fetchall()
        intel = db.execute(
            "SELECT competitor_id, processor_type, analysis_json, confidence_score, created_at "
            "FROM processed_intelligence ORDER BY created_at DESC LIMIT 30"
        ).fetchall()

    def _parse_rows(rows):
        out = []
        for r in rows:
            try:
                content = json.loads(r["raw_content"])
            except Exception:
                content = {"raw": r["raw_content"]}
            out.append({
                "competitor_id": r["competitor_id"],
                "collected_at": r["collected_at"],
                "source_url": r["source_url"],
                "content": content,
            })
        return out

    def _parse_intel(rows):
        out = []
        for r in rows:
            try:
                analysis = json.loads(r["analysis_json"])
            except Exception:
                analysis = {}
            out.append({
                "competitor_id": r["competitor_id"],
                "processor_type": r["processor_type"],
                "confidence_score": r["confidence_score"],
                "created_at": r["created_at"],
                "analysis": analysis,
            })
        return out

    return jsonify({
        "news": _parse_rows(news),
        "trends": _parse_rows(trends),
        "social": _parse_rows(social),
        "pricing": _parse_rows(pricing),
        "jobs": _parse_rows(jobs),
        "intel": _parse_intel(intel),
    })


@app.route("/api/competitor/add", methods=["POST"])
def api_competitor_add():
    data = request.json or {}
    cid = data.get("id", "").strip().lower().replace(" ", "_")
    if not cid or not data.get("name"):
        return jsonify({"error": "id and name required"}), 400
    custom = _load_custom()
    custom[cid] = {
        "name": data.get("name", ""),
        "sport": data.get("sport", []),
        "tier": data.get("tier", "adjacent"),
        "website": data.get("website", ""),
        "pricing_url": data.get("pricing_url", ""),
        "linkedin_company": data.get("linkedin_company", ""),
        "twitter_handle": data.get("twitter_handle", ""),
        "news_keywords": [k.strip() for k in data.get("news_keywords", "").split(",") if k.strip()],
        "active": bool(data.get("active", True)),
    }
    _save_custom(custom)
    return jsonify({"ok": True, "id": cid})


@app.route("/api/competitor/<comp_id>/toggle", methods=["POST"])
def api_competitor_toggle(comp_id):
    custom = _load_custom()
    if comp_id not in custom:
        custom[comp_id] = {}
    current = custom[comp_id].get("active")
    if current is None:
        current = _BASE_COMPETITORS.get(comp_id, {}).get("active", True)
    custom[comp_id]["active"] = not current
    _save_custom(custom)
    return jsonify({"ok": True, "active": custom[comp_id]["active"]})


# ── HTML ──────────────────────────────────────────────────────────────────────

HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>[Company] CI — Intelligence Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
<style>
:root {
  --bg:#0a0c10; --card:#12161e; --card2:#171c26; --border:#1e2535; --border2:#252d3d;
  --accent:#4f8ef7; --accent2:#7c5ef7; --amber:#f59e0b;
  --green:#3ecf8e; --yellow:#f5a623; --red:#e05252;
  --text:#eef2ff; --muted:#5a6a8a; --muted2:#8496b4; --radius:8px;
  --font-ui:'Space Grotesk',system-ui,sans-serif;
  --font-mono:'JetBrains Mono','Fira Code',Consolas,monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--font-ui);font-size:13px;min-height:100vh;-webkit-font-smoothing:antialiased}
code,pre,.run-log-wrap,.output-card-body,.signal-content-preview,.log-entry,.log-msg,.markdown-body code,
.stat-value,.schedule-time,#clock,#refresh-cd,.log-time{font-family:var(--font-mono)}

/* ── Animations ─────────────────────────────────────────────────────────── */
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
.spinner{display:inline-block;width:14px;height:14px;border:2px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:6px;flex-shrink:0}
.loading-state{display:flex;align-items:center;justify-content:center;padding:24px;color:var(--muted2);font-size:12px;gap:6px}
.tab-content.active{animation:fadeIn .18s ease-out}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}

/* ── Header ─────────────────────────────────────────────────────────────── */
.header{background:#0d1020;border-bottom:1px solid var(--border);padding:0 28px;display:flex;align-items:stretch;justify-content:space-between;height:58px}
.header-left{display:flex;align-items:center;gap:16px}
.logo{width:34px;height:34px;background:linear-gradient(135deg,var(--accent),var(--accent2));border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0}
.header-wordmark{display:flex;flex-direction:column;gap:1px}
.header h1{font-size:14px;font-weight:700;letter-spacing:.02em;color:var(--text)} .header h1 span{color:var(--accent)}
.header-sub{font-size:10px;color:var(--muted2);letter-spacing:.5px;text-transform:uppercase}
.header-divider{width:1px;height:26px;background:var(--border2);margin:0 4px}
.header-right{display:flex;align-items:center;gap:16px}
.live-badge{background:rgba(62,207,142,.15);color:var(--green);border:1px solid rgba(62,207,142,.35);font-family:var(--font-mono);font-size:9px;font-weight:600;padding:3px 8px;border-radius:3px;letter-spacing:1.5px;animation:pulse 2.5s infinite}
#clock{color:var(--muted2);font-size:11px;letter-spacing:.5px}
#refresh-cd{color:var(--muted);font-size:10px}
.scheduler-badge{font-family:var(--font-mono);font-size:9px;padding:3px 8px;border-radius:3px;font-weight:600;letter-spacing:1px}
.scheduler-on{background:rgba(62,207,142,.1);color:var(--green);border:1px solid rgba(62,207,142,.25)}
.scheduler-off{background:rgba(224,82,82,.1);color:var(--red);border:1px solid rgba(224,82,82,.25)}

/* ── Tabs ───────────────────────────────────────────────────────────────── */
.tabs{display:flex;padding:0 28px;background:#0d1020;border-bottom:1px solid var(--border)}
.tab{padding:12px 18px;cursor:pointer;font-size:11px;font-weight:500;color:var(--muted);border-bottom:2px solid transparent;transition:color .15s,border-color .15s;letter-spacing:.6px;text-transform:uppercase;white-space:nowrap}
.tab:hover{color:var(--muted2)}
.tab.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:700}
.tab-content{display:none} .tab-content.active{display:block}

/* ── Layout ─────────────────────────────────────────────────────────────── */
.main{padding:20px 24px}
.grid-stats{display:grid;grid-template-columns:repeat(7,1fr);gap:10px;margin-bottom:20px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px}
@media(max-width:1200px){.grid-stats{grid-template-columns:repeat(4,1fr)}.grid-3{grid-template-columns:1fr 1fr}.collector-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){.grid-stats{grid-template-columns:repeat(2,1fr)}.grid-2,.grid-3{grid-template-columns:1fr}.collector-grid{grid-template-columns:1fr}.tabs{overflow-x:auto;padding:0 12px}.tab{padding:10px 12px;font-size:10px;white-space:nowrap}.main{padding:12px}.comp-list-panel{min-width:100%!important;max-width:100%!important}}

/* ── Cards ──────────────────────────────────────────────────────────────── */
.card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;transition:border-color .2s}
.card:hover{border-color:var(--border2)}
.card-title{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-bottom:12px;font-weight:600}
.card-accent{border-left:2px solid var(--accent)!important}
.card-accent-red{border-left:2px solid var(--red)!important}
.card-accent-green{border-left:2px solid var(--green)!important}
.card-accent-yellow{border-left:2px solid var(--yellow)!important}
.section-label{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:var(--muted);font-weight:600;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border)}

/* ── Stat cards ─────────────────────────────────────────────────────────── */
.stat-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px 14px;transition:border-color .2s,transform .15s}
.stat-card:hover{border-color:var(--border2);transform:translateY(-1px)}
.stat-value{font-size:34px;font-weight:700;line-height:1;margin-bottom:5px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.stat-label{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;font-weight:600}
.stat-sub{font-size:10px;color:var(--muted2);margin-top:4px}
.blue{color:var(--accent)} .yellow{color:var(--yellow)} .red{color:var(--red)}
.green{color:var(--green)} .purple{color:var(--accent2)} .muted{color:var(--muted)}
.amber{color:var(--amber)}

/* ── Tables ─────────────────────────────────────────────────────────────── */
table{width:100%;border-collapse:collapse}
th{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);font-weight:600;text-align:left;padding:7px 10px;border-bottom:1px solid var(--border)}
td{padding:8px 10px;border-bottom:1px solid rgba(30,37,53,.7);font-size:12px;transition:background .1s}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(79,142,247,.05)}

/* ── Bar chart ──────────────────────────────────────────────────────────── */
.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.bar-label{width:100px;font-size:11px;color:var(--muted2)}
.bar-track{flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden}
.bar-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width .7s cubic-bezier(.4,0,.2,1)}
.bar-count{width:36px;text-align:right;color:var(--muted2);font-size:11px;font-family:var(--font-mono)}

/* ── Badges ─────────────────────────────────────────────────────────────── */
.badge{display:inline-block;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;font-family:var(--font-mono)}
.badge-critical{background:rgba(224,82,82,.18);color:var(--red);border:1px solid rgba(224,82,82,.3)}
.badge-high{background:rgba(245,166,35,.15);color:var(--yellow);border:1px solid rgba(245,166,35,.25)}
.badge-medium{background:rgba(79,142,247,.15);color:var(--accent);border:1px solid rgba(79,142,247,.25)}
.badge-low{background:rgba(90,106,138,.12);color:var(--muted2);border:1px solid rgba(90,106,138,.2)}
.badge-done{background:rgba(62,207,142,.12);color:var(--green);border:1px solid rgba(62,207,142,.25)}
.badge-pending{background:rgba(245,166,35,.12);color:var(--yellow);border:1px solid rgba(245,166,35,.2)}
.badge-never{background:rgba(90,106,138,.08);color:var(--muted);border:1px solid rgba(90,106,138,.15)}

/* ── Collector cards ────────────────────────────────────────────────────── */
.collector-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.collector-card{background:var(--card2);border:1px solid var(--border);border-radius:var(--radius);padding:12px;transition:border-color .15s}
.collector-card:hover{border-color:var(--border2)}
.collector-name{font-size:11px;font-weight:600;margin-bottom:6px;color:var(--text);letter-spacing:.01em}
.collector-last{font-size:10px;color:var(--muted);margin-bottom:3px;font-family:var(--font-mono)}
.collector-count{font-size:11px;color:var(--accent);font-family:var(--font-mono)}

/* ── Schedule ───────────────────────────────────────────────────────────── */
.schedule-item{display:flex;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid rgba(30,37,53,.6)}
.schedule-item:last-child{border-bottom:none}
.schedule-time{width:100px;color:var(--accent);font-size:10px;font-family:var(--font-mono);letter-spacing:.3px}
.schedule-job{color:var(--muted2);font-size:11px;flex:1}

/* ── Activity log ───────────────────────────────────────────────────────── */
.log-entry{display:flex;gap:12px;padding:5px 0;border-bottom:1px solid rgba(30,37,53,.4);font-size:10px}
.log-entry:last-child{border-bottom:none}
.log-time{color:var(--muted);white-space:nowrap;width:120px;font-family:var(--font-mono)}
.log-level{width:52px;font-weight:700;font-family:var(--font-mono);font-size:9px;letter-spacing:.5px}
.log-level.INFO{color:var(--green)} .log-level.WARNING{color:var(--yellow)} .log-level.ERROR{color:var(--red)}
.log-msg{color:var(--muted2);flex:1;line-height:1.5}

/* ── PRD tab ────────────────────────────────────────────────────────────── */
.prd-list{display:flex;flex-direction:column;gap:8px}
.prd-row{background:var(--card);border:1px solid var(--border);border-left:2px solid transparent;border-radius:var(--radius);padding:14px 18px;cursor:pointer;transition:border-color .15s,background .15s,transform .15s;display:flex;gap:16px;align-items:flex-start}
.prd-row:hover{border-color:var(--border2);border-left-color:var(--accent);transform:translateX(2px)}
.prd-row.selected{border-color:var(--border2);border-left-color:var(--accent);background:rgba(79,142,247,.06)}
.prd-meta-col{flex:1}
.prd-title-text{font-size:13px;font-weight:700;color:var(--text);margin-bottom:5px;letter-spacing:.01em}
.prd-meta{display:flex;gap:12px;font-size:10px;color:var(--muted);margin-bottom:5px;font-family:var(--font-mono)}
.prd-summary-text{font-size:11px;color:var(--muted2);line-height:1.6}
.prd-score-col{text-align:center;min-width:56px}
.prd-score-num{font-size:30px;font-weight:700;line-height:1;font-family:var(--font-mono);font-variant-numeric:tabular-nums}
.prd-score-label{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-top:2px}

/* ── PRD detail panel ───────────────────────────────────────────────────── */
.prd-detail{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-top:14px;display:none}
.prd-detail.visible{display:block;animation:fadeIn .2s ease-out}
.prd-detail-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)}
.prd-detail-title{font-size:15px;font-weight:700;color:var(--text)}
.close-btn{background:transparent;border:1px solid var(--border);color:var(--muted);padding:4px 10px;border-radius:4px;cursor:pointer;font-size:10px;font-family:var(--font-mono);letter-spacing:.5px;transition:border-color .15s,color .15s}
.close-btn:hover{border-color:var(--muted2);color:var(--text)}
.markdown-body{font-size:13px;line-height:1.75;color:var(--muted2)}
.markdown-body h1{font-size:16px;color:var(--text);font-weight:700;margin:16px 0 8px;border-bottom:1px solid var(--border);padding-bottom:6px}
.markdown-body h2{font-size:13px;color:var(--accent);font-weight:700;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.5px}
.markdown-body h3{font-size:12px;color:var(--muted2);font-weight:600;margin:10px 0 4px}
.markdown-body p{margin-bottom:10px;color:var(--muted)}
.markdown-body ul,ol{margin-left:20px;margin-bottom:10px}
.markdown-body li{color:var(--muted);margin-bottom:3px}
.markdown-body strong{color:var(--text)}
.markdown-body code{background:rgba(79,142,247,.1);color:var(--accent);padding:1px 5px;border-radius:3px;font-size:12px}

/* Empty state */
.empty{text-align:center;color:var(--muted);padding:32px;font-size:12px}
.empty code{color:var(--accent);background:rgba(79,142,247,.1);padding:2px 6px;border-radius:4px}
.empty-action{display:inline-block;margin-top:10px;font-size:11px;color:var(--accent);cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.eval-loading{font-size:12px;color:var(--muted);padding:10px 0}

/* Output rows */
.output-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(37,43,56,.4);font-size:12px}
.output-row:last-child{border-bottom:none}
.output-label{color:var(--muted);width:90px}
.output-path{color:var(--text);flex:1}
.output-size{color:var(--accent);text-align:right}
.slack-channel{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px}
.slack-hash{color:var(--accent2);font-weight:700}
.comp-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block;margin-right:6px}

/* Sleep warning */
.sleep-warning{background:rgba(245,166,35,.08);border:1px solid rgba(245,166,35,.25);border-radius:8px;padding:14px 16px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-start}
.sleep-icon{font-size:18px;margin-top:1px}
.sleep-text h4{font-size:13px;font-weight:700;color:var(--yellow);margin-bottom:4px}
.sleep-text p{font-size:12px;color:var(--muted);line-height:1.6}
.sleep-text code{color:var(--accent);background:rgba(79,142,247,.1);padding:2px 5px;border-radius:3px;font-size:11px}

/* Architecture diagram */
.arch-section{margin-bottom:24px;background:#f8f7f4;border-radius:14px;padding:28px 28px 20px;border:1px solid #e5e7eb}
.arch-diagram-title{text-align:center;font-family:sans-serif;font-size:18px;font-weight:700;color:#1a1a2e;margin-bottom:4px}
.arch-diagram-sub{text-align:center;font-family:sans-serif;font-size:12px;color:#6b7280;margin-bottom:24px}
.arch-flow-wrap{position:relative}
.arch-flow{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 60px;position:relative;z-index:2}
.arch-col{display:flex;flex-direction:column;gap:10px}
.arch-col-label{text-align:center;font-family:sans-serif;font-size:12px;color:#6b7280;margin-bottom:4px;font-weight:400}
.arch-box{border-radius:14px;padding:11px 16px;font-family:sans-serif;cursor:default;transition:transform .15s,box-shadow .15s}
.arch-box:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,.12)}
.arch-box-label{font-size:14px;font-weight:700;margin-bottom:2px}
.arch-box-sub{font-size:11px;opacity:.75}
.box-collect{background:#d1fae5;border:2px solid #6ee7b7;color:#065f46}
.box-collect.lit{border-color:#10b981;box-shadow:0 0 0 2px rgba(16,185,129,.25)}
.box-process{background:#ede9fe;border:2px solid #c4b5fd;color:#4c1d95}
.box-output{background:#fee2e2;border:2px solid #fca5a5;color:#7f1d1d}
.arch-svg{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1}

/* Status grid below diagram */
.status-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px}
.status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dot-green{background:var(--green);box-shadow:0 0 6px var(--green);animation:pulse 2s infinite}
.dot-red{background:var(--red)}
.dot-yellow{background:var(--yellow)}

/* Collector cards */
.collector-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.collector-card{background:rgba(79,142,247,.04);border:1px solid var(--border);border-radius:8px;padding:12px}
.collector-name{font-size:11px;font-weight:600;margin-bottom:6px;color:var(--text)}
.collector-last{font-size:10px;color:var(--muted);margin-bottom:4px}
.collector-count{font-size:11px;color:var(--accent)}

/* Pipeline steps */
.pipeline{display:flex;flex-direction:column;gap:6px}
.pipeline-step{display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(79,142,247,.03);border:1px solid var(--border);border-radius:8px}
.step-icon{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
.step-done{background:rgba(62,207,142,.15)}
.step-pending{background:rgba(245,166,35,.1)}
.step-never{background:rgba(100,116,139,.08)}
.step-label{flex:1;font-size:12px;font-weight:600}
.step-sub{font-size:10px;color:var(--muted);margin-top:1px}

/* Summary status */
.summary-status-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}

/* API key panel */
.apikey-panel{background:#111827;border:1px solid #1f2937;border-radius:14px;padding:20px 24px;margin-bottom:20px}
.apikey-row{display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap}
.apikey-input{flex:1;min-width:240px;background:#0a0c10;border:1px solid #374151;border-radius:8px;padding:9px 14px;color:#e2e8f0;font-family:'SF Mono',monospace;font-size:12px;outline:none}
.apikey-input:focus{border-color:#4f8ef7}
.apikey-save-btn{background:#4f8ef7;color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
.apikey-save-btn:hover{background:#3b7de8}
.apikey-status{font-size:11px;margin-top:8px}
.key-ok{color:#3ecf8e}
.key-missing{color:#f5a623}

/* Outputs tab */
.output-section-title{font-size:10px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:var(--muted);margin:20px 0 10px;display:flex;align-items:center;gap:8px}
.output-section-title::after{content:'';flex:1;height:1px;background:var(--border)}
.output-type-tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
.otab{padding:6px 14px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--border);color:var(--muted);background:var(--card);transition:all .15s}
.otab.active,.otab:hover{background:var(--accent);color:#fff;border-color:var(--accent)}
.output-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:10px}
.output-card-header{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.output-card-icon{font-size:18px}
.output-card-title{font-size:13px;font-weight:700;color:var(--text);flex:1}
.output-card-meta{font-size:10px;color:var(--muted)}
.output-card-body{font-size:11px;color:#9ca3af;line-height:1.6;font-family:'SF Mono',Consolas,monospace;white-space:pre-wrap;word-break:break-word;max-height:160px;overflow-y:auto;background:#0a0c10;border-radius:6px;padding:10px 12px;margin-top:6px}
.output-empty{text-align:center;padding:40px 20px;color:var(--muted);font-size:13px}
.output-empty-icon{font-size:36px;margin-bottom:10px}
.prd-gen-banner{background:linear-gradient(135deg,rgba(79,142,247,.12),rgba(124,94,247,.12));border:1px solid rgba(124,94,247,.3);border-radius:14px;padding:24px;text-align:center;margin-bottom:20px}
.prd-gen-title{font-size:18px;font-weight:700;color:var(--text);margin-bottom:6px}
.prd-gen-sub{font-size:12px;color:var(--muted);margin-bottom:16px}
.prd-gen-btn{background:linear-gradient(135deg,#4f8ef7,#7c5ef7);color:#fff;border:none;border-radius:10px;padding:12px 28px;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s}
.prd-gen-btn:hover{opacity:.85}
.prd-gen-btn:disabled{opacity:.4;cursor:not-allowed}

/* Run control panel */
.run-panel{background:#111827;border:1px solid #1f2937;border-radius:14px;padding:20px 24px;margin-top:20px}
.run-panel-title{font-size:12px;font-weight:700;color:#9ca3af;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.run-panel-title::after{content:'';flex:1;height:1px;background:#1f2937}
.run-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.run-btn{background:#1f2937;border:1px solid #374151;border-radius:10px;padding:10px 14px;cursor:pointer;transition:all .15s;text-align:left;display:flex;align-items:center;gap:10px;color:#e2e8f0}
.run-btn:hover{background:#374151;border-color:#4f8ef7;transform:translateY(-1px)}
.run-btn:disabled{opacity:.4;cursor:not-allowed;transform:none}
.run-btn.running{border-color:#3ecf8e;background:rgba(62,207,142,.08);animation:runpulse 1.5s ease-in-out infinite}
@keyframes runpulse{0%,100%{box-shadow:0 0 0 0 rgba(62,207,142,.3)}50%{box-shadow:0 0 0 6px rgba(62,207,142,0)}}
.run-btn-icon{font-size:16px}
.run-btn-text{font-size:11px;font-weight:600;line-height:1.3}
.run-btn-sub{font-size:10px;color:#6b7280;margin-top:1px}
.run-log-wrap{background:#0a0c10;border:1px solid #1f2937;border-radius:10px;height:240px;overflow-y:auto;padding:14px 16px;font-size:11px;line-height:1.6;color:#9ca3af;display:none}
.run-log-wrap.visible{display:block}
.log-line-start{color:#3ecf8e;font-weight:600}
.log-line-done{color:#4f8ef7;font-weight:600}
.log-line-error{color:#e05252}
.log-line-info{color:#e2e8f0}
.run-status-bar{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:11px;color:#9ca3af;min-height:18px}
.run-spinner{display:inline-block;width:10px;height:10px;border:2px solid #374151;border-top-color:#3ecf8e;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Collectors Tab ── */
.collector-grid-lg{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.collector-card-lg{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;cursor:pointer;transition:all .15s}
.collector-card-lg:hover{border-color:var(--accent);background:rgba(79,142,247,.06);transform:translateY(-1px)}
.collector-card-lg.selected{border-color:var(--accent);background:rgba(79,142,247,.08)}
.collector-detail-panel{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:20px;margin-bottom:20px}
.signal-card{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:8px}
.signal-card-header{display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap}
.sig-fields{display:flex;flex-direction:column;gap:3px}
.sig-field{display:flex;gap:8px;font-size:11px;line-height:1.5}
.sig-key{color:var(--accent);font-weight:600;min-width:90px;flex-shrink:0;font-family:'SF Mono',monospace}
.sig-val{color:var(--muted);word-break:break-word;flex:1}
.sig-full{display:none;margin-top:8px;background:rgba(0,0,0,.3);border-radius:6px;padding:10px;font-size:10px;color:#9ca3af;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow-y:auto;font-family:'SF Mono',monospace}
.expand-btn{background:rgba(79,142,247,.1);border:1px solid rgba(79,142,247,.2);color:var(--accent);font-size:10px;cursor:pointer;padding:3px 9px;border-radius:4px;margin-top:6px;font-family:inherit}

/* ── Competitors Tab ── */
.comp-master-detail{display:flex;height:calc(100vh - 106px)}
#tab-competitors{height:calc(100vh - 106px)}
.comp-list-panel{width:280px;min-width:280px;border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
.comp-search-wrap{padding:12px;border-bottom:1px solid var(--border)}
.comp-search-input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px 10px;color:var(--text);font-size:12px;outline:none}
.comp-search-input:focus{border-color:var(--accent)}
#comp-list{flex:1;overflow-y:auto}
.comp-list-item{padding:10px 14px;border-bottom:1px solid rgba(37,43,56,.4);cursor:pointer;transition:background .15s}
.comp-list-item:hover,.comp-list-item.selected{background:rgba(79,142,247,.08)}
.comp-list-name{font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px}
.comp-list-meta{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
.comp-detail-panel{flex:1;overflow-y:auto;padding:24px}
.comp-empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;text-align:center}
.activity-dot{width:7px;height:7px;border-radius:50%;background:var(--border);flex-shrink:0}
.activity-dot.dot-active{background:var(--green);box-shadow:0 0 5px var(--green)}
.sport-tag{font-size:9px;background:rgba(79,142,247,.1);color:var(--accent);border-radius:3px;padding:1px 5px;font-weight:600}
.comp-link{color:var(--accent);text-decoration:none;font-size:11px;background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.2);border-radius:5px;padding:3px 9px}
.comp-link:hover{background:rgba(79,142,247,.16)}

/* ── Inputs Tab ── */
.add-comp-btn{background:var(--accent);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:12px;font-weight:600;cursor:pointer;transition:background .15s}
.add-comp-btn:hover{background:#3b7de8}
.add-comp-form{background:var(--card);border:1px solid var(--accent);border-radius:10px;padding:20px;margin-bottom:16px}
.form-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px}
.form-field label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:5px}
.form-input,.form-select{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px;color:var(--text);font-size:12px;outline:none;font-family:inherit}
.form-input:focus,.form-select:focus{border-color:var(--accent)}
.toggle-switch{position:relative;display:inline-block;width:34px;height:20px;vertical-align:middle}
.toggle-switch input{display:none}
.toggle-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#374151;border-radius:20px;transition:.2s}
.toggle-switch input:checked+.toggle-slider{background:var(--green)}
.toggle-slider:before{content:'';position:absolute;width:14px;height:14px;left:3px;top:3px;background:white;border-radius:50%;transition:.2s}
.toggle-switch input:checked+.toggle-slider:before{transform:translateX(14px)}
.inputs-comp-table th{padding:8px 12px}
.inputs-comp-table td{padding:9px 12px}

/* ── Threat Leaderboard ── */
.threat-leaderboard-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(37,43,56,.5)}
.threat-leaderboard-row:last-child{border-bottom:none}
.threat-rank{font-size:12px;font-weight:700;color:var(--muted);width:18px;text-align:center;flex-shrink:0}
.threat-name{font-size:12px;font-weight:600;color:var(--text);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.threat-bar-wrap{width:100px;height:6px;background:rgba(55,65,81,.5);border-radius:3px;flex-shrink:0}
.threat-bar-fill{height:100%;border-radius:3px;transition:width .4s}
.threat-score-num{font-size:11px;font-weight:700;width:30px;text-align:right;flex-shrink:0}
.threat-badge{font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;flex-shrink:0}
.threat-high{background:rgba(239,68,68,.15);color:#ef4444}
.threat-mid{background:rgba(234,179,8,.15);color:#eab308}
.threat-low{background:rgba(107,114,128,.12);color:#6b7280}

/* ── Competitor View Toggle ── */
.comp-view-toggle{display:flex;gap:6px;padding:10px 14px;border-bottom:1px solid var(--border);flex-shrink:0}
.vtab{padding:5px 14px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid var(--border);color:var(--muted);background:transparent;font-family:inherit;transition:all .15s}
.vtab.active,.vtab:hover{background:var(--accent);color:#fff;border-color:var(--accent)}

/* ── Competitive Matrix ── */
#comp-matrix-view{flex:1;overflow:auto;padding:20px}
.matrix-table{width:100%;border-collapse:collapse;font-size:11px}
.matrix-table th{text-align:left;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);border-bottom:1px solid var(--border);white-space:nowrap;position:sticky;top:0;background:var(--card)}
.matrix-table th:first-child{position:sticky;left:0;z-index:2;background:var(--card)}
.matrix-table td{padding:8px 12px;border-bottom:1px solid rgba(37,43,56,.3);cursor:pointer;transition:background .1s}
.matrix-table tr:hover td{background:rgba(79,142,247,.04)}
.matrix-table td:first-child{font-weight:600;color:var(--text);position:sticky;left:0;background:var(--bg);white-space:nowrap}
.matrix-cell{border-radius:5px;padding:3px 8px;text-align:center;display:inline-block;font-weight:600}
.cell-red{background:rgba(239,68,68,.15);color:#ef4444}
.cell-orange{background:rgba(234,128,8,.15);color:#ea8008}
.cell-yellow{background:rgba(234,179,8,.12);color:#eab308}
.cell-green{background:rgba(34,197,94,.12);color:#22c55e}
.cell-muted{color:var(--muted)}

/* ── Coverage Gaps ── */
.coverage-gap-banner{background:rgba(234,179,8,.06);border:1px solid rgba(234,179,8,.25);border-radius:10px;padding:14px 18px;margin-top:16px}
.coverage-gap-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#eab308;margin-bottom:8px}
.coverage-gap-list{font-size:11px;color:var(--muted);line-height:1.8}
.coverage-gap-btn{background:rgba(234,179,8,.12);border:1px solid rgba(234,179,8,.3);color:#eab308;border-radius:6px;padding:5px 14px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:10px;transition:all .15s}
.coverage-gap-btn:hover{background:rgba(234,179,8,.2)}

/* ── Process Intelligence Panel ── */
.proc-panel{background:linear-gradient(135deg,rgba(124,94,247,.08),rgba(79,142,247,.08));border:1px solid rgba(124,94,247,.25);border-radius:14px;padding:20px 24px;margin-top:16px}
.proc-panel-title{font-size:12px;font-weight:700;color:#a78bfa;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.proc-panel-title::after{content:'';flex:1;height:1px;background:rgba(124,94,247,.2)}
.proc-run-btn{background:linear-gradient(135deg,#7c5ef7,#4f8ef7);color:#fff;border:none;border-radius:10px;padding:12px 28px;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s;font-family:inherit}
.proc-run-btn:hover{opacity:.85}
.proc-run-btn:disabled{opacity:.4;cursor:not-allowed}
.proc-hint{font-size:11px;color:var(--muted);margin-top:10px}
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <div class="logo">DP</div>
    <div>
      <h1><span>[Company]</span> CI Bot</h1>
      <div class="header-sub">Competitive Intelligence Dashboard</div>
    </div>
  </div>
  <div class="header-right">
    <div id="scheduler-badge" class="scheduler-badge scheduler-off">Scheduler: checking...</div>
    <div id="refresh-cd"></div>
    <div id="clock"></div>
    <div class="live-badge">LIVE</div>
  </div>
</div>

<div class="tabs">
  <div class="tab active" onclick="switchTab('overview')">Overview</div>
  <div class="tab" onclick="switchTab('summary')">Agent Summary</div>
  <div class="tab" onclick="switchTab('inputs')">Inputs</div>
  <div class="tab" onclick="switchTab('collectors')">Collectors</div>
  <div class="tab" onclick="switchTab('competitors')">Competitors</div>
  <div class="tab" onclick="switchTab('outputs')">Outputs</div>
  <div class="tab" onclick="switchTab('matrix')">Matrix</div>
  <div class="tab" onclick="switchTab('prds')">PRDs</div>
  <div class="tab" onclick="switchTab('cost')">Cost</div>
  <div class="tab" onclick="switchTab(&apos;eval&apos;)" id="tab-btn-eval">Review</div>
</div>

<!-- ── OVERVIEW TAB ── -->
<div id="tab-overview" class="tab-content active">
<div class="main">
  <div class="grid-stats" id="stats-row"></div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Signals by Type</div>
      <div id="signals-chart"></div>
    </div>
    <div class="card">
      <div class="card-title">&#128293; Threat Leaderboard</div>
      <div id="threat-leaderboard-list"><div class="loading-state"><span class="spinner"></span>Loading...</div></div>
    </div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Top Competitors by Signal Volume</div>
      <table>
        <thead><tr><th>Competitor</th><th>Signals</th><th>Latest Intel</th></tr></thead>
        <tbody id="competitors-table"></tbody>
      </table>
    </div>
    <div class="card">
      <div class="card-title">Recent Changes Detected</div>
      <div id="changes-section"></div>
    </div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Recent PRDs</div>
      <div id="prds-preview"></div>
    </div>
    <div class="card">
      <div class="card-title">Recent Activity Log</div>
      <div id="activity-log"></div>
    </div>
  </div>
  <div class="grid-3">
    <div class="card">
      <div class="card-title">Schedule (IST)</div>
      <div id="schedule-section"></div>
    </div>
    <div class="card">
      <div class="card-title">Output Locations</div>
      <div id="outputs-section"></div>
    </div>
    <div class="card">
      <div class="card-title">Active Alerts</div>
      <div id="overview-alerts-mini"><div class="loading-state"><span class="spinner"></span>Loading...</div></div>
    </div>
  </div>
</div>
</div>

<!-- ── SUMMARY TAB ── -->
<div id="tab-summary" class="tab-content">
<div class="main">

  <!-- Architecture Diagram - Collapsible Dropdown -->
  <div style="margin-bottom:20px">
    <!-- Dropdown Header (click to expand) -->
    <div onclick="toggleArch()" style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.25);border-radius:10px;cursor:pointer;user-select:none" onmouseover="this.style.background='rgba(79,142,247,.14)'" onmouseout="this.style.background='rgba(79,142,247,.08)'">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:15px">&#129302;</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">[Company] CI Bot &mdash; Agent Architecture <span style="font-size:10px;background:rgba(79,142,247,.2);color:#4f8ef7;padding:2px 7px;border-radius:10px;font-weight:600;vertical-align:middle">v3</span></div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px">10 collectors &bull; 8 processors &bull; 9 DB tables &bull; 17 scheduled jobs &bull; 25 competitors</div>
        </div>
      </div>
      <span id="arch-toggle-icon" style="font-size:11px;color:var(--muted)">&#9660; Show diagram</span>
    </div>

    <!-- Collapsible Body -->
    <div id="arch-dropdown-body" style="display:none;margin-top:8px">
      <div class="arch-section">
        <div class="arch-flow-wrap">
          <svg class="arch-svg" id="arch-svg"></svg>
          <div class="arch-flow">

            <!-- ORCHESTRATOR + SUBAGENTS -->
            <div class="arch-col">
              <div class="arch-col-label">&#129302; Master Agent</div>
              <div class="arch-box" style="background:linear-gradient(135deg,rgba(79,142,247,.2),rgba(124,94,247,.2));border:2px solid #4f8ef7;color:#1e40af;margin-bottom:20px">
                <div class="arch-box-label">Orchestrator Agent</div>
                <div class="arch-box-sub">Tool-calling agentic loop<br>8 max iterations per run<br>Selects processors by signal type</div>
              </div>
              <div style="text-align:center;font-size:10px;color:#9ca3af;margin:8px 0 10px;font-weight:600;letter-spacing:.05em">SUBAGENTS (8)</div>
              <div class="arch-box box-collect" id="b-news"><div class="arch-box-label">&#128240; News Digest</div><div class="arch-box-sub">RSS + NewsAPI signals</div></div>
              <div class="arch-box box-collect" id="b-reviews"><div class="arch-box-label">&#11088; Review Sentiment</div><div class="arch-box-sub">iOS + Play Store feedback</div></div>
              <div class="arch-box box-collect" id="b-jobs"><div class="arch-box-label">&#128188; Hiring Parser</div><div class="arch-box-sub">Relevant roles only (filtered)</div></div>
              <div class="arch-box box-collect" id="b-pricing"><div class="arch-box-label">&#128176; Pricing Tracker</div><div class="arch-box-sub">Change detection + ARPU</div></div>
              <div class="arch-box box-collect" id="b-web"><div class="arch-box-label">&#127760; Feature Gap</div><div class="arch-box-sub">Competitive scoring</div></div>
              <div class="arch-box box-collect" id="b-social"><div class="arch-box-label">&#128172; Narrative Diff</div><div class="arch-box-sub">Messaging vs [Company]</div></div>
              <div class="arch-box box-collect" id="b-trends"><div class="arch-box-label">&#128200; Trend Analyzer</div><div class="arch-box-sub">HN/arXiv/PH synthesis</div></div>
              <div class="arch-box box-collect" id="b-profiles"><div class="arch-box-label">&#128101; Profile Extractor</div><div class="arch-box-sub">Pricing model + venue data</div></div>
            </div>

            <!-- AGENT TEAMS -->
            <div class="arch-col">
              <div class="arch-col-label">&#128101; Agent Teams</div>

              <div style="background:linear-gradient(135deg,rgba(16,185,129,.12),rgba(62,207,142,.12));border:2px solid #10b981;border-radius:12px;padding:12px 14px;margin-bottom:12px">
                <div style="font-size:11px;font-weight:700;color:#047857;margin-bottom:6px">&#128225; Team 1: Collectors (10)</div>
                <div style="font-size:10px;color:#059669;line-height:1.7">
                  News (RSS + NewsAPI)<br>
                  App Reviews (iOS + Play Store)<br>
                  Job Postings (Greenhouse + LI)<br>
                  Web Scraper (Playwright)<br>
                  Pricing Pages (Playwright)<br>
                  Social Signals (Reddit)<br>
                  Trend Research (HN/arXiv/PH)<br>
                  Patent Filings (USPTO)<br>
                  <span style="color:#10b981;font-weight:600">&#10133; Twitter/X (API v2)</span><br>
                  <span style="color:#10b981;font-weight:600">&#10133; LinkedIn Posts (Playwright)</span>
                </div>
              </div>

              <div style="background:linear-gradient(135deg,rgba(168,85,247,.12),rgba(124,94,247,.12));border:2px solid #a855f7;border-radius:12px;padding:12px 14px;margin-bottom:12px">
                <div style="font-size:11px;font-weight:700;color:#6b21a8;margin-bottom:6px">&#129302; Team 2: Processors (8)</div>
                <div style="font-size:10px;color:#7e22ce;line-height:1.7">
                  Feature Gap Tracker<br>
                  Review Sentiment<br>
                  Hiring Signal Parser<br>
                  Pricing Tracker<br>
                  News Digest<br>
                  Narrative Diff<br>
                  Trend Analyzer<br>
                  <span style="color:#a855f7;font-weight:600">&#10133; Profile Extractor</span>
                </div>
              </div>

              <div style="background:rgba(251,191,36,.08);border:2px solid rgba(251,191,36,.3);border-radius:12px;padding:12px 14px">
                <div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:6px">&#128451; SQLite DB (9 tables)</div>
                <div style="font-size:10px;color:#b45309;line-height:1.7">
                  raw_signals &bull; processed_intel<br>
                  competitor_snapshots &bull; changes<br>
                  jobs_seen &bull; prds &bull; outputs_sent<br>
                  <span style="color:#d97706;font-weight:600">&#10133; llm_usage (cost tracking)</span><br>
                  <span style="color:#d97706;font-weight:600">&#10133; competitor_profiles</span>
                </div>
              </div>
            </div>

            <!-- OUTPUTS -->
            <div class="arch-col">
              <div class="arch-col-label">&#128204; Outputs</div>
              <div class="arch-box box-output" id="o-brief"><div class="arch-box-label">&#128239; Weekly CI Brief</div><div class="arch-box-sub">Monday 12pm IST</div></div>
              <div class="arch-box box-output" id="o-battle"><div class="arch-box-label">&#9876; Battle Cards</div><div class="arch-box-sub">Friday 4pm IST</div></div>
              <div class="arch-box box-output" id="o-alerts"><div class="arch-box-label">&#128680; Roadmap Alerts</div><div class="arch-box-sub">Real-time on change</div></div>
              <div class="arch-box box-output" id="o-prds"><div class="arch-box-label">&#128196; PRD Generator</div><div class="arch-box-sub">Friday 5:30pm IST</div></div>
              <div class="arch-box box-output" id="o-profiles"><div class="arch-box-label" style="color:#d97706">&#128101; Competitor Profiles</div><div class="arch-box-sub">Monday 3:30pm IST</div></div>
              <div class="arch-box box-output" id="o-cost"><div class="arch-box-label" style="color:#d97706">&#128184; Cost Dashboard</div><div class="arch-box-sub">Live LLM spend tracking</div></div>
              <div class="arch-box box-output" id="o-changelog"><div class="arch-box-label">&#128203; Changelog</div><div class="arch-box-sub">All detected changes</div></div>

              <div style="margin-top:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 12px">
                <div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">&#128197; Scheduler (17 jobs, IST)</div>
                <div style="font-size:9px;color:var(--muted);line-height:1.8">
                  Mon&ndash;Fri 11:30am &rarr; News<br>
                  Mon&ndash;Fri 11:45am &rarr; App Reviews<br>
                  Mon&ndash;Fri 12:00pm &rarr; Social Signals<br>
                  Mon&ndash;Fri 12:05pm &rarr; Twitter/X<br>
                  Mon&ndash;Fri 12:15pm &rarr; Job Postings<br>
                  Mon&ndash;Fri 12:30pm &rarr; Changes + Alerts<br>
                  Mon/Thu 2:00pm &rarr; Web Scraper<br>
                  Mon/Thu 3:00pm &rarr; Pricing Pages<br>
                  Mon 3:30pm &rarr; Profile Extraction<br>
                  Tue/Fri 1:00pm &rarr; Trend Research<br>
                  Wed 2:00pm &rarr; LinkedIn Posts<br>
                  Fri 4:00pm &rarr; Battle Cards<br>
                  Fri 5:30pm &rarr; Trend Analysis + PRDs<br>
                  Sat 11:00am &rarr; Patents<br>
                  Mon 12:00pm &rarr; Weekly CI Brief
                </div>
              </div>
            </div>

          </div>
        </div>

        <div style="display:flex;gap:16px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08);flex-wrap:wrap;align-items:center">
          <span style="font-size:10px;color:var(--muted)"><span style="color:#10b981;font-weight:700">+ Green</span> = Phase 3A additions</span>
          <span style="font-size:10px;color:var(--muted)"><span style="color:#d97706;font-weight:700">+ Amber</span> = Phase 3B additions</span>
          <span style="font-size:10px;color:var(--muted)">All scheduled times in IST (Asia/Kolkata)</span>
          <button onclick="showOriginalArch();event.stopPropagation()" style="margin-left:auto;background:rgba(79,142,247,.12);border:1px solid rgba(79,142,247,.3);color:#4f8ef7;padding:3px 10px;border-radius:6px;font-size:10px;cursor:pointer">View original pipeline</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal for Original Architecture -->
  <div id="orig-arch-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:1000;overflow:auto;padding:20px" onclick="if(event.target===this) closeOriginalArch()">
    <div style="background:#1a1a2e;border-radius:14px;max-width:900px;margin:40px auto;padding:30px;position:relative">
      <button onclick="closeOriginalArch()" style="position:absolute;top:15px;right:15px;background:none;border:none;font-size:24px;cursor:pointer;color:#9ca3af">&#10005;</button>
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:18px;font-weight:700;color:#e2e8f0;margin-bottom:4px">Original Pipeline Architecture</div>
        <div style="font-size:12px;color:#9ca3af">Signal collection &rarr; Processing loop &rarr; Output</div>
      </div>
      <div style="background:#111827;border:1px solid #374151;border-radius:10px;padding:20px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px">
          <div>
            <div style="text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;color:#10b981;margin-bottom:12px">Signal Collection</div>
            <div style="font-size:10px;color:#9ca3af;line-height:2">
              Competitor pages<br>App store reviews<br>Job postings<br>Pricing pages<br>News &amp; press<br>Social signals<br>Patent filings<br>Trend research<br>Twitter/X signals<br>LinkedIn posts
            </div>
          </div>
          <div>
            <div style="text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;color:#a855f7;margin-bottom:12px">Processing Loop</div>
            <div style="font-size:10px;color:#9ca3af;line-height:2">
              Feature gap tracker<br>Review sentiment<br>Hiring signal parser<br>Pricing model tracker<br>News digest builder<br>Narrative diff engine<br>Trend analyzer<br>Profile extractor
            </div>
          </div>
          <div>
            <div style="text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;color:#ef4444;margin-bottom:12px">Output</div>
            <div style="font-size:10px;color:#9ca3af;line-height:2">
              Weekly CI brief<br>Battle card generator<br>Competitor changelog<br>Roadmap gap alerts<br>PRD generator<br>Competitor profiles<br>Cost dashboard<br>Threat leaderboard
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Run Control Panel -->
  <div class="run-panel">
    <div class="run-panel-title">&#9654; Run a Collector Now</div>
    <div class="run-grid">
      <button class="run-btn" onclick="runCollector('news')" id="rbtn-news">
        <span class="run-btn-icon">&#128240;</span>
        <div><div class="run-btn-text">News &amp; Press</div><div class="run-btn-sub">RSS + NewsAPI</div></div>
      </button>
      <button class="run-btn" onclick="runCollector('jobs')" id="rbtn-jobs">
        <span class="run-btn-icon">&#128188;</span>
        <div><div class="run-btn-text">Job Postings</div><div class="run-btn-sub">Greenhouse + LinkedIn</div></div>
      </button>
      <button class="run-btn" onclick="runCollector('trends')" id="rbtn-trends">
        <span class="run-btn-icon">&#128200;</span>
        <div><div class="run-btn-text">Trend Research</div><div class="run-btn-sub">HN &middot; arXiv &middot; ProductHunt</div></div>
      </button>
      <button class="run-btn" onclick="runCollector('pricing')" id="rbtn-pricing">
        <span class="run-btn-icon">&#128176;</span>
        <div><div class="run-btn-text">Pricing Pages</div><div class="run-btn-sub">Playwright scrape</div></div>
      </button>
      <button class="run-btn" onclick="runCollector('social')" id="rbtn-social">
        <span class="run-btn-icon">&#128172;</span>
        <div><div class="run-btn-text">Social Signals</div><div class="run-btn-sub">Reddit (PRAW)</div></div>
      </button>
      <button class="run-btn" onclick="runCollector('patents')" id="rbtn-patents">
        <span class="run-btn-icon">&#128196;</span>
        <div><div class="run-btn-text">Patent Filings</div><div class="run-btn-sub">USPTO &middot; EPO</div></div>
      </button>
      <button class="run-btn" onclick="runCollector('reviews')" id="rbtn-reviews">
        <span class="run-btn-icon">&#11088;</span>
        <div><div class="run-btn-text">App Reviews</div><div class="run-btn-sub">iOS &middot; Play Store</div></div>
      </button>
      <button class="run-btn" onclick="runCollector('twitter')" id="rbtn-twitter">
        <span class="run-btn-icon">&#128038;</span>
        <div><div class="run-btn-text">Twitter/X</div><div class="run-btn-sub">Bearer token required</div></div>
      </button>
      <button class="run-btn" onclick="runCollector('linkedin')" id="rbtn-linkedin">
        <span class="run-btn-icon">&#128188;</span>
        <div><div class="run-btn-text">LinkedIn Posts</div><div class="run-btn-sub">Playwright scrape</div></div>
      </button>
      <button class="run-btn" style="background:rgba(79,142,247,.08);border-color:#4f8ef7" onclick="runCollector('trends')" id="rbtn-all">
        <span class="run-btn-icon">&#9889;</span>
        <div><div class="run-btn-text" style="color:#4f8ef7">Quick Run (No API)</div><div class="run-btn-sub">Trends &middot; no key needed</div></div>
      </button>
    </div>
    <div class="run-status-bar" id="run-status-bar"></div>
    <div class="run-log-wrap" id="run-log"></div>
  </div>

  <!-- Process Intelligence Panel -->
  <div class="proc-panel">
    <div class="proc-panel-title">&#129504; Process Intelligence</div>
    <button class="proc-run-btn" onclick="runProcessors()" id="rbtn-processors">
      &#9654; Run All Processors (Full Pipeline)
    </button>
    <div class="proc-hint" id="proc-hint-text">
      Auto-detects which signal types have a backlog and runs the matching processors: Hiring (job_postings), Pricing, Feature Gap (web pages), News Digest. Requires Anthropic or Gemini API key in Inputs tab.
    </div>
    <div style="margin-top:10px;padding:10px;background:rgba(255,255,255,.03);border-radius:6px;border:1px solid rgba(255,255,255,.06)">
      <div style="font-size:10px;color:var(--muted);line-height:1.6">
        <b style="color:var(--text)">Signal processing coverage:</b><br>
        <span style="color:#22c55e">&#10003;</span> <b>Trend</b> signals (HN, arXiv, Product Hunt) &mdash; batch-synthesized by TrendAnalyzer weekly, marked processed after run.<br>
        <span style="color:#eab308">&#9888;</span> <b>Social</b> signals (Reddit, Google Trends, YouTube) &mdash; collected as qualitative context only. No individual LLM step processes each post. Excluded from unprocessed count.<br>
        <span style="color:var(--accent)">&#9654;</span> <b>Job, Pricing, Web, News, Reviews</b> &mdash; fully processed by dedicated processors above.
      </div>
    </div>
  </div>

  <!-- Sleep warning -->
  <div class="sleep-warning">
    <div class="sleep-icon">&#9888;&#65039;</div>
    <div class="sleep-text">
      <h4>Will the bot run when your Mac is closed?</h4>
      <p>No. macOS suspends all processes when the lid closes or the system sleeps. Keep the lid open on power, or run <code>caffeinate -i python main.py</code> to prevent sleep. Or enable <b>System Settings &gt; Battery &gt; Prevent automatic sleeping when display is off</b>.</p>
    </div>
  </div>

  <!-- Status + Collectors -->
  <div class="summary-status-grid">
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="card-title">Scheduler Status</div>
        <div id="scheduler-status-block"></div>
      </div>
      <div class="card">
        <div class="card-title">Collector Last Runs</div>
        <div class="collector-grid" id="collector-grid"></div>
      </div>
    </div>
    <div>
      <div class="card" style="margin-bottom:14px">
        <div class="card-title">Pipeline Progress</div>
        <div class="pipeline" id="pipeline-steps"></div>
      </div>
      <div class="card">
        <div class="card-title">Processor Results</div>
        <table>
          <thead><tr><th>Processor</th><th>Reports</th><th>Last Run</th></tr></thead>
          <tbody id="processor-table"></tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Full Activity Log</div>
    <div id="full-activity-log"></div>
  </div>

</div>
</div>

<!-- ── OUTPUTS TAB ── -->
<div id="tab-outputs" class="tab-content">
<div class="main">

  <!-- API Key + PRD Generation Banner -->
  <div class="prd-gen-banner" id="prd-gen-banner">
    <div class="prd-gen-title">&#129302; Generate PRDs from 118 Signals</div>
    <div class="prd-gen-sub">The Trend Analyzer needs an API key to synthesize signals into feature PRDs for [Company].</div>
    <div id="prd-banner-body">
      <div class="apikey-row" style="justify-content:center;margin-bottom:12px">
        <select id="key-provider" style="background:#1f2937;border:1px solid #374151;color:#e2e8f0;border-radius:8px;padding:9px 12px;font-size:12px">
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="gemini">Google Gemini</option>
        </select>
        <input class="apikey-input" id="key-input" type="password" placeholder="Paste your API key here..." style="max-width:360px">
        <button class="apikey-save-btn" onclick="saveApiKey()">Save &amp; Activate</button>
      </div>
      <div class="apikey-status" id="key-status"></div>
    </div>
  </div>

  <!-- Output type selector -->
  <div class="output-type-tabs">
    <div class="otab active" onclick="switchOutput('research_feed')">&#128270; Research Feed</div>
    <div class="otab" onclick="switchOutput('battle_cards')">&#9855; Battle Cards</div>
    <div class="otab" onclick="switchOutput('weekly_brief')">&#128240; Weekly Brief</div>
    <div class="otab" onclick="switchOutput('changelog')">&#128203; Changelog</div>
    <div class="otab" onclick="switchOutput('alerts')">&#128680; Alerts</div>
    <div class="otab" onclick="switchOutput('sent')">&#128228; Sent to Slack</div>
  </div>

  <div id="outputs-filter-bar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;background:var(--card);border-radius:10px;border:1px solid var(--border)">
    <select id="filter-competitor" onchange="applyOutputFilters()" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text)">
      <option value="">All competitors</option>
    </select>
    <div id="filter-type-chips" style="display:flex;gap:4px;flex-wrap:wrap"></div>
    <div style="display:flex;align-items:center;gap:6px">
      <label style="font-size:10px;color:var(--muted);white-space:nowrap">Min confidence: <span id="conf-slider-label">0</span></label>
      <input id="filter-conf-min" type="range" min="0" max="10" step="1" value="0" oninput="document.getElementById('conf-slider-label').textContent=this.value;applyOutputFilters()" style="width:80px;accent-color:var(--accent)">
    </div>
    <div id="filter-date-chips" style="display:flex;gap:4px">
      <button onclick="setDateFilter('all')" id="date-all" style="font-size:10px;padding:2px 8px;border-radius:10px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer">All time</button>
      <button onclick="setDateFilter('30d')" id="date-30d" style="font-size:10px;padding:2px 8px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer">30d</button>
      <button onclick="setDateFilter('7d')" id="date-7d" style="font-size:10px;padding:2px 8px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer">7d</button>
    </div>
    <div style="margin-left:auto;display:flex;gap:6px">
      <button onclick="setOutputGrouping('competitor')" id="grp-competitor-btn" style="font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer">By Competitor</button>
      <button onclick="setOutputGrouping('chrono')" id="grp-chrono-btn" style="font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer">Chronological</button>
    </div>
  </div>

  <div id="output-panel-research_feed" class="output-panel" style="display:block"></div>
  <div id="output-panel-changelog" class="output-panel"></div>
  <div id="output-panel-battle_cards" class="output-panel"></div>
  <div id="output-panel-alerts" class="output-panel"></div>
  <div id="output-panel-weekly_brief" class="output-panel"></div>
  <div id="output-panel-sent" class="output-panel"></div>

  <!-- Exports section -->
  <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border)">
    <div class="output-section-title">Exports</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <!-- Exec Brief -->
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">
          Executive Brief
          <button onclick="generateExecBrief(false)" id="exec-brief-btn" style="font-size:10px;padding:4px 12px;border-radius:6px;border:none;background:var(--accent);color:#fff;cursor:pointer">&#9889; Generate</button>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:10px">LLM-generated 1-page summary: top 3 threats, pricing movements, recommended actions.</div>
        <div id="exec-brief-content" style="font-size:12px;color:var(--text);line-height:1.6;white-space:pre-wrap"></div>
        <div id="exec-brief-meta" style="font-size:10px;color:var(--muted);margin-top:8px"></div>
        <div id="exec-brief-actions" style="display:none;gap:8px;margin-top:10px">
          <button onclick="copyExecBriefMarkdown()" style="font-size:10px;padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer">&#128203; Copy Markdown</button>
          <button onclick="window.print()" style="font-size:10px;padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer">&#128438; Print</button>
          <button onclick="generateExecBrief(true)" style="font-size:10px;padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer">&#8635; Regenerate</button>
        </div>
      </div>
      <!-- Sales Battlecard -->
      <div class="card">
        <div class="card-title">Sales Battlecard</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:12px">Per-competitor 1-pager: weaknesses, how to win, [Company] advantages.</div>
        <select id="battlecard-comp-select" style="width:100%;font-size:11px;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);margin-bottom:10px">
          <option value="">Select a competitor...</option>
        </select>
        <button onclick="openBattlecard()" style="font-size:11px;padding:5px 14px;border-radius:6px;border:none;background:rgba(79,142,247,.15);color:var(--accent);cursor:pointer">&#128203; Open Battlecard</button>
        <div id="battlecard-content" style="margin-top:14px;font-size:12px;color:var(--text)"></div>
      </div>
    </div>
  </div>

</div>
</div>

<!-- ── MATRIX TAB ── -->
<div id="tab-matrix" class="tab-content">
<div class="main">
  <div class="section-title">Feature Comparison Matrix</div>
  <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <button onclick="setMatrixFilter('all')" id="matrix-filter-all" style="font-size:10px;padding:3px 10px;border-radius:10px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer">All Features</button>
    <button onclick="setMatrixFilter('gaps')" id="matrix-filter-gaps" style="font-size:10px;padding:3px 10px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer">[Company] Gaps</button>
    <button onclick="setMatrixFilter('advantages')" id="matrix-filter-advantages" style="font-size:10px;padding:3px 10px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer">[Company] Advantages</button>
    <button onclick="copyMatrixMarkdown()" style="margin-left:auto;font-size:10px;padding:3px 10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer">&#128203; Copy Markdown</button>
  </div>
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;font-size:11px;color:var(--muted);flex-wrap:wrap">
    <span style="font-weight:600">Legend:</span>
    <span style="color:var(--green)">&#10003; Has feature</span>
    <span style="color:var(--red)">&#10007; Lacks feature</span>
    <span style="color:var(--yellow)">&#126; Shared</span>
    <span>&#8212; Unknown</span>
  </div>
  <div id="matrix-container"><div class="loading-state" style="padding:40px"><span class="spinner"></span>Loading matrix...</div></div>
</div>
</div>

<!-- ── PRDs TAB ── -->
<div id="tab-prds" class="tab-content">
<div class="main">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text)">Generated PRDs</div>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">Feature proposals generated by the weekly trend analysis agent</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <div id="prd-count-badge" style="font-size:12px;color:var(--muted)"></div>
      <select id="prd-sort-select" onchange="if(cachedData) renderPRDsList(cachedData.prds)" style="padding:4px 8px;background:var(--card);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px">
        <option value="date">Newest first</option>
        <option value="priority">Priority (high first)</option>
        <option value="effort">Effort (low first)</option>
      </select>
    </div>
  </div>
  <div id="prds-list"></div>
  <div class="prd-detail" id="prd-detail">
    <div class="prd-detail-header">
      <div class="prd-detail-title" id="prd-detail-title"></div>
      <button class="close-btn" onclick="closePRDDetail()">Close</button>
    </div>
    <div class="markdown-body" id="prd-detail-body"></div>
  </div>
</div>
</div>

<!-- ── COST TAB ── -->
<div id="tab-cost" class="tab-content">
<div class="main">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);margin-bottom:14px">LLM API Cost Tracking</div>
  <div id="cost-stats-row" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px"></div>
  <div class="card" style="margin-bottom:12px">
    <div class="card-title">Cost Projection</div>
    <div id="cost-projection"><div class="loading-state"><span class="spinner"></span>Loading...</div></div>
  </div>
  <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px">
    <div class="card">
      <div class="card-title">DAILY COST &mdash; LAST 14 DAYS</div>
      <canvas id="cost-chart" height="120"></canvas>
      <div id="cost-chart-empty" style="display:none;text-align:center;padding:24px;color:var(--muted);font-size:12px">No LLM calls recorded yet. Run a processor to start tracking costs.</div>
    </div>
    <div class="card">
      <div class="card-title">BY PROVIDER</div>
      <div id="cost-provider-breakdown"></div>
    </div>
  </div>
  <div class="card" style="margin-top:12px">
    <div class="card-title">BY PROCESSOR TYPE</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px" id="cost-proc-table">
      <thead><tr style="border-bottom:1px solid rgba(255,255,255,.1)">
        <th style="text-align:left;padding:6px 8px;color:var(--muted)">Processor</th>
        <th style="text-align:right;padding:6px 8px;color:var(--muted)">Calls</th>
        <th style="text-align:right;padding:6px 8px;color:var(--muted)">Tokens</th>
        <th style="text-align:right;padding:6px 8px;color:var(--muted)">Total Cost</th>
        <th style="text-align:right;padding:6px 8px;color:var(--muted)">Avg/Call</th>
      </tr></thead>
      <tbody id="cost-proc-tbody"></tbody>
    </table>
    <div id="cost-proc-empty" style="display:none;text-align:center;padding:20px;color:var(--muted);font-size:12px">No LLM usage data yet.</div>
  </div>
</div>
</div>

<!-- ── EVAL TAB ── -->
<div id="tab-eval" class="tab-content">
<div class="main">

  <!-- Sub-tab nav -->
  <div style="display:flex;gap:0;margin-bottom:20px;background:var(--card);border-radius:10px;padding:3px;border:1px solid var(--border)">
    <button id="review-subtab-queue" onclick="switchReviewSubtab('queue')" style="flex:1;padding:8px 16px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;background:var(--accent);color:#fff">
      Review Queue
    </button>
    <button id="review-subtab-health" onclick="switchReviewSubtab('health')" style="flex:1;padding:8px 16px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:var(--muted)">
      System Health
    </button>
  </div>

  <!-- Review Queue panel -->
  <div id="review-panel-queue">
    <div id="review-queue-container"></div>
  </div>

  <!-- System Health panel (existing eval content) -->
  <div id="review-panel-health" style="display:none">

    <!-- Signal Funnel -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Signal Funnel</div>
      <div id="eval-funnel-content"><div class="empty">Loading...</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="card">
        <div class="card-title">Source Performance</div>
        <div id="eval-sources-content"><div class="empty">Loading...</div></div>
      </div>
      <div class="card">
        <div class="card-title">Recent Intelligence Quality</div>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <button onclick="sortEvalIntel('date')" id="sort-date-btn" style="font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer">Latest</button>
          <button onclick="sortEvalIntel('score')" id="sort-score-btn" style="font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer">Worst first</button>
        </div>
        <div id="eval-intel-content" style="max-height:420px;overflow-y:auto"><div class="empty">Loading...</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Self-Eval Controls</div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <button onclick="runSelfEval(this)" style="background:rgba(168,85,247,.12);border:1px solid rgba(168,85,247,.3);color:#a855f7;padding:7px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">Run Self-Eval Backfill</button>
        <button onclick="runRollup(this)" style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);color:#10b981;padding:7px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">Compute Weekly Rollup</button>
        <span id="last-rollup-ts" style="font-size:11px;color:var(--muted)"></span>
      </div>
    </div>
  </div>

</div>
</div>

<!-- ── COLLECTORS TAB ── -->
<div id="tab-collectors" class="tab-content">
<div class="main">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <div>
      <div style="font-size:18px;font-weight:700;color:var(--text)">Signal Collectors</div>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">Click a collector card to browse its recent raw signals</div>
    </div>
  </div>
  <div class="collector-grid-lg" id="collector-grid-lg"></div>
  <div id="collector-coverage-gaps"></div>
  <div class="collector-detail-panel" id="collector-detail-panel" style="display:none">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div id="collector-detail-title" style="font-size:15px;font-weight:700;color:var(--accent)"></div>
      <button onclick="closeCollectorDetail()" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:5px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit">Close</button>
    </div>
    <div id="collector-signals-list"></div>
  </div>
</div>
</div>

<!-- ── COMPETITORS TAB ── -->
<div id="tab-competitors" class="tab-content">
<div style="display:flex;flex-direction:column;height:calc(100vh - 106px)">
  <!-- View toggle + profile action -->
  <div class="comp-view-toggle" style="display:flex;align-items:center;justify-content:space-between">
    <div>
      <button class="vtab active" onclick="setCompView('detail')">&#9776; Detail View</button>
      <button class="vtab" onclick="setCompView('matrix')">&#9783; Matrix View</button>
    </div>
    <button id="btn-extract-profiles" onclick="runProfileExtraction(this)" style="background:rgba(168,85,247,.12);border:1px solid rgba(168,85,247,.35);color:#a855f7;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;margin-right:4px">
      &#128101; Extract All Profiles
    </button>
  </div>
  <!-- Detail View -->
  <div id="comp-detail-view" style="display:flex;flex:1;overflow:hidden">
    <div class="comp-list-panel">
      <div class="comp-search-wrap">
        <input type="text" id="comp-search" placeholder="Search competitors..." oninput="filterCompetitors(this.value)" class="comp-search-input">
        <select id="comp-sort-select" onchange="sortAndRenderCompetitors()" style="margin-top:6px;width:100%;padding:5px 8px;background:var(--card);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px">
          <option value="name">Sort: A to Z</option>
          <option value="threat">Sort: Threat (high first)</option>
          <option value="signals">Sort: Signal volume</option>
          <option value="recent">Sort: Most recent</option>
        </select>
      </div>
      <div id="comp-list"></div>
    </div>
    <div class="comp-detail-panel" id="comp-detail-panel">
      <div class="comp-empty-state" id="comp-empty-state">
        <div style="font-size:40px;margin-bottom:12px">&#127919;</div>
        <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:8px">Select a Competitor</div>
        <div style="font-size:12px;color:var(--muted);max-width:300px">Click a competitor on the left to see their collected signals, processed intelligence, and detected changes.</div>
      </div>
      <div id="comp-detail-content" style="display:none"></div>
    </div>
  </div>
  <!-- Matrix View -->
  <div id="comp-matrix-view" style="display:none">
    <div id="comp-matrix-content"><div class="loading-state" style="padding:40px"><span class="spinner"></span>Loading competitor matrix...</div></div>
  </div>
</div>
</div>

<!-- ── INPUTS TAB ── -->
<div id="tab-inputs" class="tab-content">
<div class="main">

  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
    <div>
      <div style="font-size:18px;font-weight:700;color:var(--text)">Inputs</div>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">Manage which competitors are tracked and configure collection settings</div>
    </div>
  </div>

  <!-- API Keys -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">API Keys</div>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px">
      <select id="inputs-key-provider" class="form-select" style="width:auto">
        <option value="anthropic">Anthropic (Claude)</option>
        <option value="gemini">Google Gemini</option>
      </select>
      <div style="position:relative;max-width:320px;flex:1">
        <input class="form-input apikey-input" id="inputs-key-input" type="password" placeholder="Paste API key..." style="width:100%;padding-right:34px">
        <button onclick="togglePwVis(&apos;inputs-key-input&apos;,this)" title="Show/hide key" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;font-size:13px;line-height:1;padding:0">&#128065;</button>
      </div>
      <button class="add-comp-btn" onclick="saveApiKeyFromInputs()">Save Key</button>
    </div>
    <div class="apikey-status" id="inputs-key-status"></div>
  </div>

  <!-- My Company Context -->
  <div class="card" style="margin-bottom:16px" id="context-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div>
        <div class="card-title" style="margin-bottom:2px">My Company Context</div>
        <div style="font-size:11px;color:var(--muted)">Agents use this as the authoritative source of truth about your company. Update it when your product, positioning, or strategy changes.</div>
      </div>
      <span id="ctx-custom-badge" style="display:none;font-size:10px;background:rgba(79,142,247,.15);color:#4f8ef7;padding:2px 8px;border-radius:10px;font-weight:600">Custom</span>
    </div>
    <textarea id="ctx-textarea" style="width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px;font-family:inherit;padding:10px;resize:vertical;min-height:160px;line-height:1.6" placeholder="Describe your company, product, positioning, tech stack, target market, key features..."></textarea>
    <div style="display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap">
      <button class="add-comp-btn" onclick="saveContext()">Save Context</button>
      <label style="display:inline-flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;color:var(--text)">
        <span>&#128206; Upload Doc</span>
        <input type="file" id="ctx-file-input" accept=".txt,.md,.pdf,.doc,.docx" style="display:none" onchange="uploadContextFile(this)">
      </label>
      <button onclick="if(confirm('Reset to built-in default context? This will remove your custom context.')) resetContext()" style="background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit">Reset to Default</button>
      <span id="ctx-char-count" style="font-size:11px;color:var(--muted);margin-left:auto"></span>
    </div>
    <div id="ctx-status" style="margin-top:8px;font-size:11px"></div>
    <div id="ctx-updated-at" style="margin-top:4px;font-size:10px;color:var(--muted)"></div>
  </div>

  <!-- Competitor management -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <div style="font-size:14px;font-weight:700;color:var(--text)">Tracked Competitors</div>
    <button class="add-comp-btn" onclick="showAddCompetitorForm()">+ Add Competitor</button>
  </div>

  <!-- Add form -->
  <div id="add-comp-form" class="add-comp-form" style="display:none">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">New Competitor</div>
    <div class="form-grid">
      <div class="form-field"><label>ID (slug)</label><input class="form-input" id="new-comp-id" placeholder="e.g. my_company"></div>
      <div class="form-field"><label>Name</label><input class="form-input" id="new-comp-name" placeholder="e.g. My Company"></div>
      <div class="form-field"><label>Tier</label>
        <select class="form-select" id="new-comp-tier">
          <option value="direct">Direct</option>
          <option value="adjacent" selected>Adjacent</option>
        </select>
      </div>
      <div class="form-field"><label>Website</label><input class="form-input" id="new-comp-website" placeholder="https://..."></div>
      <div class="form-field"><label>Pricing URL</label><input class="form-input" id="new-comp-pricing" placeholder="https://..."></div>
      <div class="form-field"><label>LinkedIn Company</label><input class="form-input" id="new-comp-linkedin" placeholder="company-slug"></div>
      <div class="form-field"><label>Twitter Handle</label><input class="form-input" id="new-comp-twitter" placeholder="handle (no @)"></div>
      <div class="form-field" style="grid-column:span 2"><label>News Keywords (comma-separated)</label><input class="form-input" id="new-comp-keywords" placeholder="CompanyName, CompanyName analytics"></div>
    </div>
    <div style="margin-bottom:12px">
      <label style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);display:block;margin-bottom:6px">Sports</label>
      <label style="margin-right:14px;font-size:12px"><input type="checkbox" id="sport-padel" style="margin-right:4px">Padel</label>
      <label style="margin-right:14px;font-size:12px"><input type="checkbox" id="sport-pickleball" style="margin-right:4px">Pickleball</label>
      <label style="margin-right:14px;font-size:12px"><input type="checkbox" id="sport-tennis" style="margin-right:4px">Tennis</label>
    </div>
    <div style="margin-bottom:14px">
      <label style="font-size:12px"><input type="checkbox" id="new-comp-active" checked style="margin-right:6px">Active (start collecting immediately)</label>
    </div>
    <div style="display:flex;gap:10px">
      <button class="add-comp-btn" onclick="submitAddCompetitor()">Save Competitor</button>
      <button onclick="showAddCompetitorForm()" style="background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:8px;padding:9px 16px;font-size:12px;cursor:pointer;font-family:inherit">Cancel</button>
    </div>
  </div>

  <!-- Competitor table -->
  <div class="card" style="margin-bottom:16px">
    <div id="inputs-competitors-table"><div class="empty">Loading...</div></div>
  </div>

  <!-- Schedule -->
  <div class="card">
    <div class="card-title">Collection Schedule (IST)</div>
    <div id="inputs-schedule"></div>
  </div>

</div>
</div>

<script>
// Base path for API calls (handles proxy subpath, e.g. /competitive-dp-agent)
var BASE = window.location.pathname.split('/').slice(0,2).join('/');

// -- IST timezone helpers ------------------------------------------------------
// All DB/log timestamps are stored in UTC. These convert for display.
function toIST(isoStr) {
  if (!isoStr) return '';
  try {
    const s = isoStr.toString().trim();
    // Append Z to force UTC parsing if no timezone marker present
    const utcStr = (s.endsWith('Z') || s.includes('+') || s.includes('-', 10))
      ? s.replace(' ', 'T')
      : s.replace(' ', 'T') + 'Z';
    return new Date(utcStr).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).replace(',', '');
  } catch(e) { return isoStr.toString().slice(0, 16); }
}

function toISTDate(isoStr) {
  if (!isoStr) return '';
  try {
    const s = isoStr.toString().trim();
    const utcStr = (s.endsWith('Z') || s.includes('+')) ? s.replace(' ', 'T') : s.replace(' ', 'T') + 'Z';
    return new Date(utcStr).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
  } catch(e) { return isoStr.toString().slice(0, 10); }
}

function toISTShort(isoStr) {
  // Returns "MM-DD HH:MM" in IST -- for compact display
  if (!isoStr) return '';
  try {
    const s = isoStr.toString().trim();
    const utcStr = (s.endsWith('Z') || s.includes('+')) ? s.replace(' ', 'T') : s.replace(' ', 'T') + 'Z';
    const d = new Date(utcStr);
    const opts = {timeZone: 'Asia/Kolkata'};
    const mo = String(new Date(utcStr).toLocaleDateString('en-CA', {...opts})).slice(5, 7);
    const da = String(new Date(utcStr).toLocaleDateString('en-CA', {...opts})).slice(8, 10);
    const hm = new Date(utcStr).toLocaleTimeString('en-GB', {...opts, hour:'2-digit', minute:'2-digit'});
    return mo + '-' + da + ' ' + hm;
  } catch(e) { return isoStr.toString().slice(5, 16); }
}

function daysSinceUTC(isoStr) {
  // Calculate days since a UTC timestamp string
  if (!isoStr) return 999;
  try {
    const s = isoStr.toString().trim();
    const utcStr = (s.endsWith('Z') || s.includes('+')) ? s.replace(' ', 'T') : s.replace(' ', 'T') + 'Z';
    return (Date.now() - new Date(utcStr)) / 86400000;
  } catch(e) { return 999; }
}

// ── Human-readable labels ─────────────────────────────────────────────────
var _SIGNAL_LABELS = {
  'news':'News','social':'Social','job_posting':'Hiring','app_review':'Reviews',
  'pricing':'Pricing','web_content':'Web','web_page':'Web Page','trend':'Trends',
  'patent':'Patents','linkedin':'LinkedIn','twitter':'Twitter'
};
var _PROCESSOR_LABELS = {
  'news_digest':'News Digest','review_sentiment':'Review Sentiment',
  'feature_gap':'Feature Gap','hiring_signals':'Hiring Signals',
  'pricing_tracker':'Pricing Tracker','narrative_diff':'Narrative Diff',
  'trend_analyzer':'Trend Analyzer','social_mentions':'Social Mentions',
  'company_profile':'Company Profile'
};
function _sigLabel(k){ return _SIGNAL_LABELS[k]||(k?k.split('_').map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join(' '):'Unknown'); }
function _procLabel(k){ return _PROCESSOR_LABELS[k]||(k?k.split('_').map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join(' '):'Unknown'); }

// ── Relative timestamps ───────────────────────────────────────────────────
function _relTime(ts) {
  if (!ts) return '';
  try {
    var s = ts.toString().trim();
    var utcStr = (s.endsWith('Z')||s.includes('+')) ? s.replace(' ','T') : s.replace(' ','T')+'Z';
    var diff = Date.now() - new Date(utcStr).getTime();
    var mins = Math.floor(diff/60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins+'m ago';
    if (mins < 1440) return Math.floor(mins/60)+'h ago';
    if (mins < 10080) return Math.floor(mins/1440)+'d ago';
    return new Date(utcStr).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',month:'short',day:'numeric'});
  } catch(e){ return ts?ts.slice(0,10):''; }
}
function _tsSpan(ts) {
  if (!ts) return '<span style="color:var(--muted)">Never</span>';
  var abs = toIST(ts);
  return '<span title="'+abs+'" style="cursor:default">'+_relTime(ts)+'</span>';
}

// ── PRD helpers ───────────────────────────────────────────────────────────
function _prdScoreColor(s){ return s>=8?'var(--red)':s>=6?'var(--yellow)':'var(--green)'; }

// ── Competitor sort/filter helpers ────────────────────────────────────────
var _allCompetitors = [];
var _filteredCompetitors = [];

function sortAndRenderCompetitors() {
  var method = (document.getElementById('comp-sort-select')||{}).value || 'name';
  var list = (_filteredCompetitors.length ? _filteredCompetitors : _allCompetitors).slice();
  list.sort(function(a,b){
    if (method==='threat') return (_threatScore(b)||0)-(_threatScore(a)||0);
    if (method==='signals') return (b.signal_count||0)-(a.signal_count||0);
    if (method==='recent') return (b.last_signal||'')>(a.last_signal||'')?-1:1;
    return (a.name||'').localeCompare(b.name||'');
  });
  renderCompetitorList(list);
}

// ── Password show/hide ────────────────────────────────────────────────────
function togglePwVis(inputId, btn) {
  var inp = document.getElementById(inputId);
  if (!inp) return;
  if (inp.type==='password'){ inp.type='text'; btn.style.color='var(--accent)'; }
  else { inp.type='password'; btn.style.color='var(--muted)'; }
}

let refreshInterval = 15, countdown = refreshInterval;
let cachedData = null;
let selectedPRDId = null;

function switchTab(name) {
  const names = ['overview','summary','inputs','collectors','competitors','outputs','matrix','prds','cost','eval'];
  document.querySelectorAll('.tab').forEach((t,i) => {
    t.classList.toggle('active', names[i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'summary') setTimeout(drawArchArrows, 80);
  if (name === 'outputs' && cachedData) { _activeOutput = 'research_feed'; renderOutputsTab(cachedData); }
  if (name === 'collectors' && cachedData) renderCollectorsTab(cachedData.collector_status);
  if (name === 'competitors') loadCompetitorsTab();
  if (name === 'inputs') { loadInputsTab(); loadContext(); }
  if (name === 'cost') loadCostTab();
  if (name === 'eval') loadEvalTab();
  if (name === 'matrix') loadMatrixTab();
}

let _activeOutput = 'research_feed';
var _outputGrouping = 'competitor';
var _outputFilterCompetitor = '';
var _outputFilterTypes = [];
var _outputConfMin = 0;
var _outputDateRange = 'all';
var _allIntelForFilter = [];

function applyOutputFilters() {
  _outputFilterCompetitor = document.getElementById('filter-competitor').value;
  _outputConfMin = parseInt(document.getElementById('filter-conf-min').value || '0', 10);
  try { sessionStorage.setItem('dp_output_filters', JSON.stringify({type:_outputTypeFilter||'', conf:_outputConfMin, date:_outputDateRange, group:_outputGrouping, comp:_outputFilterCompetitor})); } catch(e){}
  renderBattleCardsPanel(_allIntelForFilter);
}
// Restore persisted filter state on load
(function(){
  try {
    var saved = JSON.parse(sessionStorage.getItem('dp_output_filters')||'{}');
    if(saved.conf !== undefined) _outputConfMin = Number(saved.conf)||0;
    if(saved.group) _outputGrouping = saved.group;
  } catch(e){}
})();

function setDateFilter(range) {
  _outputDateRange = range;
  ['all','30d','7d'].forEach(function(r) {
    var btn = document.getElementById('date-' + r);
    if (!btn) return;
    var active = r === range;
    btn.style.background = active ? 'var(--accent)' : 'transparent';
    btn.style.color = active ? '#fff' : 'var(--muted)';
    btn.style.border = active ? '1px solid var(--accent)' : '1px solid var(--border)';
  });
  renderBattleCardsPanel(_allIntelForFilter);
}

function setTypeFilter(type) {
  _outputFilterTypes = type === '' ? [] : [type];
  document.querySelectorAll('.type-chip').forEach(function(c) {
    var active = (type === '' && c.dataset.type === '') || c.dataset.type === type;
    c.style.background = active ? 'var(--accent)' : 'transparent';
    c.style.color = active ? '#fff' : 'var(--muted)';
    c.style.border = active ? '1px solid var(--accent)' : '1px solid var(--border)';
  });
  renderBattleCardsPanel(_allIntelForFilter);
}

function setOutputGrouping(mode) {
  _outputGrouping = mode;
  var cBtn = document.getElementById('grp-competitor-btn');
  var tBtn = document.getElementById('grp-chrono-btn');
  if (cBtn) { cBtn.style.background = mode === 'competitor' ? 'var(--accent)' : 'transparent'; cBtn.style.color = mode === 'competitor' ? '#fff' : 'var(--muted)'; cBtn.style.border = mode === 'competitor' ? '1px solid var(--accent)' : '1px solid var(--border)'; }
  if (tBtn) { tBtn.style.background = mode === 'chrono' ? 'var(--accent)' : 'transparent'; tBtn.style.color = mode === 'chrono' ? '#fff' : 'var(--muted)'; tBtn.style.border = mode === 'chrono' ? '1px solid var(--accent)' : '1px solid var(--border)'; }
  renderBattleCardsPanel(_allIntelForFilter);
}

function _populateFilterBar(intel) {
  var sel = document.getElementById('filter-competitor');
  if (!sel) return;
  var existing = sel.value;
  sel.innerHTML = '<option value="">All competitors</option>';
  var seen = {};
  intel.forEach(function(d) {
    if (!seen[d.competitor_id]) {
      seen[d.competitor_id] = true;
      var opt = document.createElement('option');
      opt.value = d.competitor_id;
      opt.textContent = (d.competitor_id||'').replace(/_/g,' ');
      sel.appendChild(opt);
    }
  });
  if (existing) sel.value = existing;

  // Populate type chips
  var chipsEl = document.getElementById('filter-type-chips');
  if (chipsEl) {
    var types = [
      {key:'', label:'All'},
      {key:'hiring_signals', label:'Hiring'},
      {key:'pricing', label:'Pricing'},
      {key:'feature_gap', label:'Features'},
      {key:'news_digest', label:'News'},
      {key:'review_sentiment', label:'Reviews'},
      {key:'narrative', label:'Narrative'},
    ];
    chipsEl.innerHTML = types.map(function(t) {
      var active = (t.key === '' && _outputFilterTypes.length === 0) || _outputFilterTypes[0] === t.key;
      return '<button class="type-chip" data-type="' + t.key + '" onclick="setTypeFilter(&apos;' + t.key + '&apos;)" style="font-size:10px;padding:2px 8px;border-radius:10px;cursor:pointer;' +
        (active ? 'background:var(--accent);color:#fff;border:1px solid var(--accent)' : 'background:transparent;color:var(--muted);border:1px solid var(--border)') +
        '">' + t.label + '</button>';
    }).join('');
  }
}

function switchOutput(name) {
  _activeOutput = name;
  document.querySelectorAll('.otab').forEach((t,i) => {
    const ns = ['research_feed','battle_cards','weekly_brief','changelog','alerts','sent'];
    t.classList.toggle('active', ns[i] === name);
  });
  document.querySelectorAll('.output-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById('output-panel-' + name);
  if (panel) panel.style.display = '';
}

function tick() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) + ' IST';
  countdown--;
  document.getElementById('refresh-cd').textContent = `Refresh in ${countdown}s`;
  if (countdown <= 0) { countdown = refreshInterval; loadData(); }
}

function badge(s) {
  return `<span class="badge badge-${s}">${s.toUpperCase()}</span>`;
}

// ── Threat Score ────────────────────────────────────────────────────────────
function _threatScore(comp) {
  let score = 0;
  const daysSince = daysSinceUTC(comp.last_signal);
  score += daysSince < 1 ? 20 : daysSince < 7 ? 15 : daysSince < 30 ? 5 : 0;
  score += Math.min(15, (comp.signal_count || 0) * 0.3);
  score += Math.min(20, (comp.hiring_threat || 0) * 5);
  score += Math.min(10, Math.max(0, comp.velocity_bonus || 0));
  const fg = (_intelCache && _intelCache[comp.id]) ? _intelCache[comp.id].feature_gap : null;
  if (fg) {
    const tl = fg.threat_level;
    score += tl === 'critical' ? 25 : tl === 'high' ? 18 : tl === 'medium' ? 10 : 5;
    score += Math.round((fg.gap_score || 0) * 10);
  }
  if (comp.tier === 'direct') score += 10;
  return Math.round(Math.min(100, score));
}

function _threatBreakdown(comp) {
  const lines = [];
  const daysSince = daysSinceUTC(comp.last_signal);
  const recPts = daysSince < 1 ? 20 : daysSince < 7 ? 15 : daysSince < 30 ? 5 : 0;
  const breadthPts = Math.min(15, (comp.signal_count || 0) * 0.3);
  const hiringQPts = Math.min(20, (comp.hiring_threat || 0) * 5);
  const velPts = Math.min(10, Math.max(0, comp.velocity_bonus || 0));
  const tierPts = comp.tier === 'direct' ? 10 : 0;
  lines.push('<b>Score breakdown:</b>');
  lines.push('Recency: +' + recPts + ' (last signal ' + (daysSince < 999 ? Math.round(daysSince) + 'd ago' : 'never') + ')');
  lines.push('Signal breadth: +' + breadthPts.toFixed(0) + ' (' + (comp.signal_count||0) + ' total signals)');
  if ((comp.hiring_threat || 0) > 0) {
    lines.push('Hiring quality: +' + hiringQPts + ' (' + comp.hiring_threat + ' relevant role inferences, velocity: ' + (comp.hiring_velocity_label||'') + ')');
  } else {
    const jobDisplay = comp.relevant_job_count !== undefined
      ? comp.relevant_job_count + ' relevant / ' + comp.total_job_count + ' total'
      : (comp.job_signal_count || 0) + ' jobs';
    const raw = comp.relevant_job_count !== undefined ? comp.relevant_job_count : (comp.job_signal_count || 0);
    lines.push('Hiring: +' + hiringQPts + ' (' + jobDisplay + ' postings' + (raw > 0 ? ', not yet LLM-processed &mdash; run hiring processor for quality score' : '') + ')');
  }
  if (velPts > 0) lines.push('Hiring velocity bonus: +' + velPts + ' (' + (comp.hiring_velocity_label||'') + ')');
  if (tierPts) lines.push('Tier bonus: +10 (direct competitor)');
  const fg = (_intelCache && _intelCache[comp.id]) ? _intelCache[comp.id].feature_gap : null;
  if (fg) {
    const fgPts = fg.threat_level === 'critical' ? 25 : fg.threat_level === 'high' ? 18 : fg.threat_level === 'medium' ? 10 : 5;
    lines.push('Feature gap: +' + fgPts + ' (threat=' + fg.threat_level + ', gap_score=' + (fg.gap_score||0).toFixed(2) + ')');
  } else {
    lines.push('Feature gap: +0 (not yet analyzed &mdash; run features processor)');
  }
  return lines.join('<br>');
}

function renderThreatLeaderboard(comps) {
  const el = document.getElementById('threat-leaderboard-list');
  if (!el) return;
  const scored = (comps || [])
    .filter(c => c.active !== false)
    .map(c => ({ ...c, ts: _threatScore(c) }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 7);
  if (!scored.length) { el.innerHTML = '<div class="empty">No competitor data yet.</div>'; return; }
  const max = Math.max(1, scored[0].ts);
  el.innerHTML = scored.map((c, i) => {
    const barColor = c.ts >= 70 ? '#ef4444' : c.ts >= 40 ? '#ea8008' : c.ts >= 20 ? '#eab308' : '#6b7280';
    const tierCls = c.tier === 'direct' ? 'badge-high' : 'badge-medium';
    return `<div class="threat-leaderboard-row" style="cursor:pointer" onclick="toggleThreatBreakdown('tb-${c.id}', this, ${JSON.stringify(c).replace(/</g,'&lt;')})">
      <div class="threat-rank">${i+1}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px">
          <div class="threat-name">${c.name}</div>
          <span class="badge ${tierCls}" style="font-size:8px;flex-shrink:0">${c.tier}</span>
        </div>
        <div class="threat-bar-wrap" style="margin-top:4px">
          <div class="threat-bar-fill" style="width:${(c.ts/max*100).toFixed(0)}%;background:${barColor}"></div>
        </div>
        <div id="tb-${c.id}" class="threat-breakdown-panel" style="display:none;margin-top:6px;font-size:10px;color:var(--muted);line-height:1.7;padding:6px 8px;background:rgba(255,255,255,.04);border-radius:4px"></div>
      </div>
      <div class="threat-score-num" style="color:${barColor}">${c.ts} <span style="font-size:9px;color:var(--muted)">&#9432;</span></div>
    </div>`;
  }).join('');
}

function toggleThreatBreakdown(panelId, rowEl, comp) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  if (panel.style.display === 'none') {
    panel.innerHTML = _threatBreakdown(comp);
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

function loadData() {
  fetch(BASE+'/api/data').then(r => r.json()).then(data => {
    cachedData = data;
    const fns = [
      () => renderStats(data.stats),
      () => renderSchedulerBadge(data.scheduler_running),
      () => renderSignalsChart(data.signals_by_type),
      () => renderCompetitors(data.top_competitors),
      () => renderChanges(data.recent_changes),
      () => renderPRDsPreview(data.prds),
      () => renderSchedule(data.schedule),
      () => renderOutputs(data.output_locations),
      () => renderActivityLog(data.activity_log, 'activity-log'),
      () => renderActivityLog(data.activity_log, 'full-activity-log'),
      () => renderSchedulerStatus(data.scheduler_running, data.stats),
      () => renderCollectors(data.collector_status),
      () => renderPipeline(data.stats, data.collector_status, data.processor_status),
      () => renderProcessors(data.processor_status),
      () => renderPRDsList(data.prds),
      () => { const el = document.getElementById('proc-hint-text');
               if (el && data.stats) el.innerHTML = data.stats.unprocessed > 0
                 ? '<span style="color:#eab308">&#9888;</span> ' + data.stats.unprocessed + ' unprocessed signals waiting. Run processors to generate intelligence.'
                 : '<span style="color:var(--green)">&#10003;</span> All signals processed. Run again after next collection cycle.'; },
    ];
    fns.forEach(fn => { try { fn(); } catch(e) { console.error('Render error:', e.message, e.stack); } });
    const outTab = document.getElementById('tab-outputs');
    if (outTab && outTab.classList.contains('active')) { try { renderOutputsTab(data); } catch(e) { console.error('OutputsTab error:', e); } }
    // Load competitor data for threat leaderboard (only if not already loaded)
    if (!_allCompetitors.length) {
      fetch(BASE+'/api/competitors').then(r => r.json()).then(comps => {
        _allCompetitors = comps;
        _filteredCompetitors = comps;
        try { renderThreatLeaderboard(comps); } catch(e) { console.error('Leaderboard error:', e); }
      }).catch(() => {});
    } else {
      try { renderThreatLeaderboard(_allCompetitors); } catch(e) {}
    }
  }).catch(e => console.error('loadData fetch error:', e));
}

function renderStats(s) {
  const unprocSub = s.unprocessed > 0
    ? '<a onclick="switchTab(&apos;summary&apos;)" style="color:var(--accent);cursor:pointer;font-size:9px">Run processors &#8594;</a>'
    : 'all caught up';
  const items = [
    {v:s.total_signals,  l:'Total Signals',   cls:'blue'},
    {v:s.unprocessed,    l:'Unprocessed',      cls:s.unprocessed>0?'yellow':'muted', sub:unprocSub},
    {v:s.changes,        l:'Changes Found',    cls:'green'},
    {v:s.pending_alerts, l:'Pending Alerts',   cls:s.pending_alerts>0?'red':'muted'},
    {v:s.prds,           l:'PRDs Generated',   cls:'purple'},
    {v:s.intel_reports,  l:'Intel Reports',    cls:'blue'},
    {v:s.jobs_tracked,   l:'Jobs Tracked',     cls:'green'},
  ];
  document.getElementById('stats-row').innerHTML = items.map(i=>`
    <div class="stat-card">
      <div class="stat-value ${i.cls}">${i.v}</div>
      <div class="stat-label">${i.l}</div>
      ${i.sub?`<div class="stat-sub">${i.sub}</div>`:''}
    </div>`).join('');
}

function renderSchedulerBadge(running) {
  const el = document.getElementById('scheduler-badge');
  el.className = 'scheduler-badge ' + (running ? 'scheduler-on' : 'scheduler-off');
  el.textContent = running ? 'Scheduler: Running' : 'Scheduler: Stopped';
}

function renderSignalsChart(data) {
  if (!data.length) { document.getElementById('signals-chart').innerHTML='<div class="empty">No signals yet</div>'; return; }
  const max = Math.max(...data.map(d=>d.count));
  document.getElementById('signals-chart').innerHTML = data.map(d=>`
    <div class="bar-row">
      <div class="bar-label">${_sigLabel(d.type)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(d.count/max*100).toFixed(1)}%"></div></div>
      <div class="bar-count">${d.count}</div>
    </div>`).join('');
}

function renderCompetitors(data) {
  if (!data.length) { document.getElementById('competitors-table').innerHTML='<tr><td colspan="3" class="empty">No signals</td></tr>'; return; }
  document.getElementById('competitors-table').innerHTML = data.map(d=>`
    <tr>
      <td><span class="comp-dot"></span>${d.competitor.split('_').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')}</td>
      <td style="color:var(--accent)">${d.signals}</td>
      <td style="color:var(--muted);font-size:11px">${d.latest_intel==='none yet'?'none yet':toIST(d.latest_intel||'')}</td>
    </tr>`).join('');
}

function renderChanges(data) {
  try { renderOverviewAlertsMini(data); } catch(e){}
  if (!data.length) { document.getElementById('changes-section').innerHTML='<div class="empty">No changes detected yet</div>'; return; }
  document.getElementById('changes-section').innerHTML=`<table>
    <thead><tr><th>Competitor</th><th>Type</th><th>Severity</th><th>When</th></tr></thead>
    <tbody>${data.map(d=>`<tr>
      <td>${d.competitor_id.split('_').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')}</td><td style="color:var(--muted)">${d.change_type}</td>
      <td>${badge(d.severity)}</td>
      <td style="color:var(--muted);font-size:11px">${_tsSpan(d.detected_at||'')}</td>
    </tr>`).join('')}</tbody></table>`;
}

function renderPRDsPreview(data) {
  if (!data.length) {
    document.getElementById('prds-preview').innerHTML=`<div class="empty">No PRDs yet.<br>Run: <code>python main.py --run-trend-analysis</code></div>`; return;
  }
  document.getElementById('prds-preview').innerHTML=`<table>
    <thead><tr><th>Title</th><th>Week</th><th>P</th><th>E</th></tr></thead>
    <tbody>${data.slice(0,5).map(d=>`<tr>
      <td style="color:var(--accent);font-size:12px">${d.title}</td>
      <td style="color:var(--muted)">${d.week}</td>
      <td style="color:var(--yellow)">${d.priority_score}</td>
      <td style="color:var(--muted)">${d.effort}</td>
    </tr>`).join('')}</tbody></table>
    ${data.length>5?`<div style="text-align:center;margin-top:10px"><span onclick="switchTab('prds')" style="color:var(--accent);cursor:pointer;font-size:11px">View all ${data.length} PRDs</span></div>`:''}`;
}

function renderSchedule(data) {
  document.getElementById('schedule-section').innerHTML = data.map(d=>`
    <div class="schedule-item">
      <div class="schedule-time">${d.time}</div>
      <div class="schedule-job">${d.job}</div>
    </div>`).join('');
}

function renderOutputs(data) {
  let html = [
    {l:'Database', p:data.db.path.split('/').pop(), s:data.db.size},
    {l:'Logs', p:data.log.path.split('/').pop(), s:data.log.size},
    {l:'PRDs', p:`${data.prds.count} files`, s:''},
    {l:'Snapshots', p:`${data.snapshots.count} files`, s:''},
  ].map(r=>`<div class="output-row"><div class="output-label">${r.l}</div><div class="output-path">${r.p}</div><div class="output-size">${r.s}</div></div>`).join('');
  html+=`<div style="margin:10px 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">Slack Channels</div>`;
  html+=data.slack.map(s=>`<div class="slack-channel"><span class="slack-hash">#</span><span>${s.channel.replace('#','')}</span><span style="color:var(--muted);margin-left:auto">${s.purpose}</span></div>`).join('');
  document.getElementById('outputs-section').innerHTML = html;
}

function renderActivityLog(data, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!data.length) { el.innerHTML='<div class="empty">No log entries yet</div>'; return; }
  el.innerHTML = data.map(d=>`
    <div class="log-entry">
      <div class="log-time">${d.time}</div>
      <div class="log-level ${d.level}">${d.level}</div>
      <div class="log-msg">${d.message}${d.logger?` <span style="color:var(--muted)">(${d.logger.split('.').pop()})</span>`:''}</div>
    </div>`).join('');
}

function renderSchedulerStatus(running, stats) {
  const el = document.getElementById('scheduler-status-block');
  if (running) {
    el.innerHTML=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div class="status-dot dot-green"></div>
      <span style="color:var(--green);font-weight:700;font-size:13px">Scheduler is running</span>
    </div>
    <div style="font-size:12px;color:var(--muted);line-height:1.8">
      All cron jobs active. Next scheduled run: check the schedule tab.<br>
      Stop: <code style="color:var(--accent)">Ctrl+C</code> in the terminal running main.py
    </div>`;
  } else {
    el.innerHTML=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div class="status-dot dot-red"></div>
      <span style="color:var(--red);font-weight:700;font-size:13px">Scheduler is not running</span>
    </div>
    <div style="font-size:12px;color:var(--muted);line-height:1.8;margin-bottom:12px">
      No automatic collection running. Click below to start, or run manually:<br>
      <code style="color:var(--accent)">caffeinate -i python main.py</code> (prevents Mac sleep)
    </div>
    <button onclick="startScheduler(this)" style="background:#3ecf8e;color:#0a0c10;border:none;border-radius:8px;padding:9px 20px;font-size:12px;font-weight:700;cursor:pointer">
      &#9654; Start Scheduler
    </button>`;
  }
}

function startScheduler(btn) {
  btn.disabled = true;
  btn.textContent = 'Starting...';
  fetch(BASE+'/api/start-scheduler', {method:'POST'})
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        btn.textContent = '&#10003; Started (PID ' + (d.pid||'running') + ')';
        btn.style.background = 'var(--green)';
        setTimeout(loadData, 2000);
      } else {
        btn.textContent = 'Error: ' + (d.error||'unknown');
        btn.disabled = false;
      }
    });
}

function drawArchArrows() {
  const svg = document.getElementById('arch-svg');
  if (!svg) return;
  const wrap = svg.parentElement;
  const wRect = wrap.getBoundingClientRect();

  const connections = [
    ['b-web',     'p-featuregap'], ['b-web',     'p-narrative'],
    ['b-reviews', 'p-sentiment'],  ['b-reviews', 'p-featuregap'],
    ['b-jobs',    'p-hiring'],     ['b-jobs',    'p-featuregap'],
    ['b-pricing', 'p-pricing'],    ['b-pricing', 'p-changelog'],
    ['b-news',    'p-news'],       ['b-news',    'p-featuregap'],
    ['b-social',  'p-narrative'],  ['b-social',  'p-news'],
    ['b-profiles', 'p-featuregap'], ['b-trends',  'p-trends'],
    ['p-featuregap','o-brief'],    ['p-featuregap','o-battle'],
    ['p-sentiment', 'o-brief'],    ['p-sentiment', 'o-changelog'],
    ['p-hiring',    'o-battle'],   ['p-hiring',    'o-changelog'],
    ['p-pricing',   'o-changelog'],['p-pricing',   'o-alerts'],
    ['p-news',      'o-brief'],    ['p-news',      'o-alerts'],
    ['p-narrative', 'o-investor'], ['p-narrative', 'o-alerts'],
    ['p-trends',    'o-prds'],     ['p-trends',    'o-brief'],
  ];

  let lines = '';
  connections.forEach(([fromId, toId]) => {
    const fromEl = document.getElementById(fromId);
    const toEl   = document.getElementById(toId);
    if (!fromEl || !toEl) return;
    const fR = fromEl.getBoundingClientRect();
    const tR = toEl.getBoundingClientRect();
    const x1 = fR.right  - wRect.left;
    const y1 = fR.top + fR.height/2 - wRect.top;
    const x2 = tR.left   - wRect.left;
    const y2 = tR.top + tR.height/2 - wRect.top;
    const cx1 = x1 + (x2-x1)*0.4;
    const cx2 = x2 - (x2-x1)*0.4;
    lines += `<path d="M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}" stroke="#9ca3af" stroke-width="1.5" fill="none" opacity="0.6" marker-end="url(#arr)"/>`;
  });

  svg.innerHTML = `<defs><marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#9ca3af"/></marker></defs>${lines}`;
  svg.setAttribute('height', wrap.offsetHeight);
}

function renderCollectors(data) {
  const arcMap = {
    'News Feeds': 'b-news', 'App Reviews': 'b-reviews', 'Job Postings': 'b-jobs',
    'Pricing Pages': 'b-pricing', 'Web Scraper': 'b-web', 'Social Signals': 'b-social',
    'Trend Research': 'b-trends', 'Patent Filings': 'b-profiles'
  };
  data.forEach(c => {
    const id = arcMap[c.label];
    if (id) {
      const el = document.getElementById(id);
      if (el && c.last_run) el.classList.add('lit');
    }
  });
  setTimeout(drawArchArrows, 50);
  document.getElementById('collector-grid').innerHTML = data.map(c=>`
    <div class="collector-card">
      <div class="collector-name">${c.label}</div>
      <div class="collector-last">${c.last_run ? 'Last: ' + toISTShort(c.last_run||'') : 'Never run'}</div>
      <div class="collector-count">${c.last_count !== null ? c.last_count + ' signals' : '-'}</div>
    </div>`).join('');
}

function renderPipeline(stats, collectors, processors) {
  const steps = [
    {icon:'📡', label:'Signal Collection', sub:`${stats.total_signals} signals across 8 collectors`, done: stats.total_signals > 0},
    {icon:'🤖', label:'LLM Processing', sub:`${stats.intel_reports} reports generated (${stats.unprocessed} unprocessed)`, done: stats.intel_reports > 0},
    {icon:'🔍', label:'Change Detection', sub:`${stats.changes} changes detected`, done: stats.changes > 0},
    {icon:'🚨', label:'Alerts', sub:`${stats.pending_alerts} pending high/critical alerts`, done: stats.pending_alerts === 0 && stats.changes > 0},
    {icon:'📊', label:'Trend Analysis', sub:'Weekly synthesis of all signals', done: stats.prds > 0},
    {icon:'📝', label:'PRD Generation', sub:`${stats.prds} PRDs generated with dedup`, done: stats.prds > 0},
    {icon:'📨', label:'Slack Output', sub:'Weekly brief + battle cards + alerts', done: false},
  ];
  document.getElementById('pipeline-steps').innerHTML = steps.map(s=>{
    const cls = s.done ? 'step-done' : 'step-never';
    const bCls = s.done ? 'badge-done' : 'badge-never';
    const bTxt = s.done ? 'Done' : 'Pending';
    return `<div class="pipeline-step">
      <div class="step-icon ${cls}">${s.icon}</div>
      <div style="flex:1">
        <div class="step-label">${s.label}</div>
        <div class="step-sub">${s.sub}</div>
      </div>
      <span class="badge ${bCls}">${bTxt}</span>
    </div>`;
  }).join('');
}

function renderProcessors(data) {
  const el = document.getElementById('processor-table');
  if (!data.length) { el.innerHTML='<tr><td colspan="3" class="empty">No processors run yet</td></tr>'; return; }
  el.innerHTML = data.map(d=>`<tr>
    <td>${d.processor}</td>
    <td style="color:var(--accent)">${d.count}</td>
    <td style="color:var(--muted);font-size:11px">${d.last_run||'-'}</td>
  </tr>`).join('');
}

function renderPRDsList(data) {
  const el = document.getElementById('prds-list');
  document.getElementById('prd-count-badge').textContent = data.length ? `${data.length} PRD${data.length>1?'s':''} total` : '';
  if (!data.length) {
    el.innerHTML=`<div class="empty" style="padding:60px">
      No PRDs generated yet.<br><br>
      Add an LLM API key to <code>.env</code>, then run:<br><br>
      <code>python main.py --run-trend-analysis</code><br><br>
      Or click <span class="empty-action" onclick="switchTab('summary')">Agent Summary &#8594; Run Trend Analysis</span>
    </div>`; return;
  }
  // Sort based on select
  const sortMethod = (document.getElementById('prd-sort-select')||{}).value || 'date';
  const sorted = data.slice().sort(function(a,b){
    if (sortMethod==='priority') return (b.priority_score||0)-(a.priority_score||0);
    if (sortMethod==='effort') {
      const effortOrder = {'low':0,'medium':1,'high':2};
      return (effortOrder[a.effort]||1)-(effortOrder[b.effort]||1);
    }
    return (b.created_at||'')>(a.created_at||'')?1:-1;
  });
  el.innerHTML = sorted.map(d=>`
    <div class="prd-row ${selectedPRDId===d.id?'selected':''}" onclick="loadPRD(${d.id}, '${escHtml(d.title)}')">
      <div class="prd-meta-col">
        <div class="prd-title-text">${d.title}</div>
        <div class="prd-meta">
          <span>Week: ${d.week}</span>
          <span>Effort: <b>${d.effort||'?'}</b></span>
          <span>Created: ${_tsSpan(d.created_at||'')}</span>
        </div>
        ${d.concept_summary?`<div class="prd-summary-text">${d.concept_summary.slice(0,160)}...</div>`:''}
      </div>
      <div class="prd-score-col">
        <div class="prd-score-num" style="color:${_prdScoreColor(d.priority_score||0)}">${d.priority_score||'?'}</div>
        <div class="prd-score-label">Priority</div>
      </div>
    </div>`).join('');
}

function escHtml(s) { return (s||'').replace(/'/g,"\\'"); }

function loadPRD(id, title) {
  selectedPRDId = id;
  if (cachedData) renderPRDsList(cachedData.prds);
  document.getElementById('prd-detail-title').textContent = title;
  document.getElementById('prd-detail-body').innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center">Loading...</div>';
  document.getElementById('prd-detail').classList.add('visible');
  document.getElementById('prd-detail').scrollIntoView({behavior:'smooth',block:'start'});

  fetch(BASE+'/api/prd/' + id).then(r=>r.json()).then(data => {
    if (data.markdown) {
      document.getElementById('prd-detail-body').innerHTML = renderMarkdown(data.markdown);
    } else {
      const meta = `<p><b>Week:</b> ${data.week} | <b>Priority:</b> ${data.priority_score}/10 | <b>Effort:</b> ${data.effort}</p>`;
      const summary = data.concept_summary ? `<p>${data.concept_summary}</p>` : '';
      document.getElementById('prd-detail-body').innerHTML = meta + summary + '<p style="color:var(--muted);margin-top:16px">Full markdown file not found on disk. Run trend analysis to regenerate.</p>';
    }
  });
}

function closePRDDetail() {
  selectedPRDId = null;
  document.getElementById('prd-detail').classList.remove('visible');
  if (cachedData) renderPRDsList(cachedData.prds);
}

function renderMarkdown(md) {
  return md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\\n\\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '')
    .replace(/<p><\/p>/g, '');
}

// ── Exec Brief ───────────────────────────────────────────────────────────────
var _execBriefText = '';
var _execBriefPoll = null;

function generateExecBrief(force) {
  var btn = document.getElementById('exec-brief-btn');
  var content = document.getElementById('exec-brief-content');
  var meta = document.getElementById('exec-brief-meta');
  var actions = document.getElementById('exec-brief-actions');

  if (_execBriefPoll) { clearInterval(_execBriefPoll); _execBriefPoll = null; }

  if (btn) { btn.textContent = 'Generating...'; btn.disabled = true; }
  if (content) content.innerHTML = '<div style="display:flex;align-items:center;gap:8px;color:var(--muted)"><span class="spinner"></span> Calling LLM, please wait...</div>';
  if (actions) actions.style.display = 'none';

  function startPoll() {
    var url = BASE+'/api/exec-brief' + (force ? '?force=1' : '');
    fetch(url).then(function(r){ return r.json(); }).then(function(d) {
      if (d.status === 'generating') {
        // Poll every 1.5s until done
        _execBriefPoll = setInterval(function() {
          fetch(BASE+'/api/exec-brief').then(function(r){ return r.json(); }).then(function(d2) {
            if (d2.status === 'generating') return; // still working
            clearInterval(_execBriefPoll); _execBriefPoll = null;
            renderExecBrief(d2);
          }).catch(function(e) {
            clearInterval(_execBriefPoll); _execBriefPoll = null;
            if (content) content.textContent = 'Error polling: ' + e.message;
            if (btn) { btn.innerHTML = '&#9889; Retry'; btn.disabled = false; }
          });
        }, 1500);
      } else {
        renderExecBrief(d);
      }
    }).catch(function(e) {
      if (content) content.textContent = 'Error: ' + e.message + '. Try again.';
      if (btn) { btn.innerHTML = '&#9889; Retry'; btn.disabled = false; }
    });
  }

  if (force) {
    fetch(BASE+'/api/exec-brief/invalidate', {method:'POST'}).then(startPoll).catch(function(e) {
      if (content) content.textContent = 'Error: ' + e.message;
      if (btn) { btn.innerHTML = '&#9889; Retry'; btn.disabled = false; }
    });
  } else {
    startPoll();
  }
}

function renderExecBrief(d) {
  var btn = document.getElementById('exec-brief-btn');
  var content = document.getElementById('exec-brief-content');
  var meta = document.getElementById('exec-brief-meta');
  var actions = document.getElementById('exec-brief-actions');
  _execBriefText = d.summary || '';
  if (content) content.textContent = _execBriefText;
  if (meta) meta.textContent = 'Generated: ' + (d.generated_at ? d.generated_at.replace('T',' ').slice(0,16) + ' UTC' : 'unknown');
  if (actions) actions.style.display = 'flex';
  if (btn) { btn.innerHTML = '&#9889; Generate'; btn.disabled = false; }
}

function copyExecBriefMarkdown() {
  navigator.clipboard.writeText(_execBriefText).then(function() {
    var btn = document.querySelector('[onclick="copyExecBriefMarkdown()"]');
    if (btn) { btn.textContent = 'Copied!'; setTimeout(function(){ btn.innerHTML = '&#128203; Copy Markdown'; }, 2000); }
  }).catch(function(){});
}

// ── Battlecard ────────────────────────────────────────────────────────────────
function populateBattlecardSelect() {
  var sel = document.getElementById('battlecard-comp-select');
  if (!sel || !_allCompetitors.length) return;
  if (sel.options.length > 1) return; // already populated
  _allCompetitors.forEach(function(c) {
    var opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function openBattlecard() {
  var sel = document.getElementById('battlecard-comp-select');
  var el = document.getElementById('battlecard-content');
  if (!sel || !sel.value) { if (el) el.innerHTML = '<div style="color:var(--muted)">Please select a competitor first.</div>'; return; }
  if (el) el.innerHTML = '<div style="color:var(--muted);font-size:11px">Loading...</div>';
  fetch(BASE+'/api/battlecard/' + sel.value).then(function(r){ return r.json(); }).then(function(d) {
    var html = '<div style="border:1px solid var(--border);border-radius:10px;padding:16px">';
    html += '<div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:12px">' + _esc(d.competitor_name) + ' Battlecard</div>';
    html += '<div style="margin-bottom:10px"><div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">What They Do</div><div style="font-size:11px;color:var(--text)">' + _esc(d.what_they_do) + '</div></div>';
    html += '<div style="margin-bottom:10px"><div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Pricing</div><div style="font-size:11px;color:var(--text)">' + _esc(d.pricing_summary) + '</div></div>';
    if (d.their_weaknesses && d.their_weaknesses.length) {
      html += '<div style="margin-bottom:10px"><div style="font-size:9px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Their Weaknesses</div>' +
        d.their_weaknesses.map(function(w){ return '<div style="font-size:11px;color:var(--text);padding:2px 0">&#8226; ' + _esc(w) + '</div>'; }).join('') + '</div>';
    }
    if (d.how_to_win && d.how_to_win.length) {
      html += '<div style="margin-bottom:10px"><div style="font-size:9px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">How to Win</div>' +
        d.how_to_win.map(function(w){ return '<div style="font-size:11px;color:var(--text);padding:2px 0">&#8226; ' + _esc(w) + '</div>'; }).join('') + '</div>';
    }
    if (d.dream_play_advantages && d.dream_play_advantages.length) {
      html += '<div style="margin-bottom:10px"><div style="font-size:9px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">[Company] Advantages</div>' +
        d.dream_play_advantages.map(function(w){ return '<div style="font-size:11px;color:var(--text);padding:2px 0">&#10003; ' + _esc(w) + '</div>'; }).join('') + '</div>';
    }
    html += '<button onclick="window.print()" style="margin-top:8px;font-size:10px;padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer">&#128438; Print</button>';
    html += '</div>';
    if (el) el.innerHTML = html;
  }).catch(function(e) {
    if (el) el.innerHTML = '<div style="color:var(--muted)">Error loading battlecard.</div>';
  });
}

// Populate battlecard select whenever competitors load
var _origLoadData = loadData;
var loadData = function() {
  _origLoadData();
  setTimeout(populateBattlecardSelect, 500);
};

// ── Matrix Tab ───────────────────────────────────────────────────────────────
var _matrixData = null;
var _matrixFilter = 'all';

function loadMatrixTab() {
  if (_matrixData) { renderMatrix(_matrixData); return; }
  fetch(BASE+'/api/feature-matrix').then(function(r){ return r.json(); }).then(function(d) {
    _matrixData = d;
    renderMatrix(d);
  }).catch(function() {
    var el = document.getElementById('matrix-container');
    if (el) el.innerHTML = '<div style="color:var(--muted);padding:40px;text-align:center">No feature gap data yet. Run the Feature Gap Tracker processor first.</div>';
  });
}

function setMatrixFilter(f) {
  _matrixFilter = f;
  ['all','gaps','advantages'].forEach(function(key) {
    var btn = document.getElementById('matrix-filter-' + key);
    if (!btn) return;
    var active = key === f;
    btn.style.background = active ? 'var(--accent)' : 'transparent';
    btn.style.color = active ? '#fff' : 'var(--muted)';
    btn.style.border = active ? '1px solid var(--accent)' : '1px solid var(--border)';
  });
  if (_matrixData) renderMatrix(_matrixData);
}

function renderMatrix(data) {
  var el = document.getElementById('matrix-container');
  if (!el) return;
  var features = data.features || [];
  var comps = data.competitors || [];
  var dp = data.dream_play || {};

  if (!features.length || !comps.length) {
    el.innerHTML = '<div style="color:var(--muted);padding:40px;text-align:center">No feature gap data yet. Run the Feature Gap Tracker processor first.</div>';
    return;
  }

  // Filter features based on mode
  var visibleFeatures = features.filter(function(f) {
    if (_matrixFilter === 'gaps') return dp[f] !== 'has' && comps.some(function(c){ return c.cells[f] === 'has'; });
    if (_matrixFilter === 'advantages') return dp[f] === 'has';
    return true;
  });

  function cellHtml(val) {
    if (val === 'has') return '<span style="color:var(--green);font-weight:700">&#10003;</span>';
    if (val === 'lacks') return '<span style="color:var(--red)">&#10007;</span>';
    if (val === 'shared') return '<span style="color:#f59e0b">&#126;</span>';
    return '<span style="color:var(--muted)">&#8212;</span>';
  }

  var tierColor = function(t) { return t === 'direct' ? '#e05252' : '#f59e0b'; };
  var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
  html += '<thead><tr><th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);color:var(--muted);font-size:10px;white-space:nowrap">Feature</th>';
  html += '<th style="padding:8px 10px;border-bottom:2px solid var(--border);text-align:center;white-space:nowrap"><span style="color:var(--accent);font-weight:700">[Company]</span></th>';
  comps.forEach(function(c) {
    html += '<th style="padding:8px 10px;border-bottom:2px solid var(--border);text-align:center;white-space:nowrap">' +
      '<div style="font-size:10px;font-weight:700;color:var(--text)">' + _esc(c.name) + '</div>' +
      '<div style="font-size:9px;padding:1px 5px;border-radius:4px;background:' + tierColor(c.tier) + '22;color:' + tierColor(c.tier) + ';display:inline-block">' + (c.tier||'') + '</div>' +
      '</th>';
  });
  html += '</tr></thead><tbody>';

  visibleFeatures.slice(0, 80).forEach(function(f, idx) {
    var bg = idx % 2 === 0 ? 'background:rgba(255,255,255,.02)' : '';
    html += '<tr style="' + bg + '">';
    html += '<td style="padding:7px 10px;color:var(--text);border-bottom:1px solid var(--border)">' + _esc(f) + '</td>';
    html += '<td style="text-align:center;border-bottom:1px solid var(--border)">' + cellHtml(dp[f] === 'has' ? 'has' : null) + '</td>';
    comps.forEach(function(c) {
      html += '<td style="text-align:center;border-bottom:1px solid var(--border)">' + cellHtml(c.cells[f]) + '</td>';
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  if (visibleFeatures.length > 80) {
    html += '<div style="font-size:10px;color:var(--muted);text-align:center;padding:8px">Showing 80 of ' + visibleFeatures.length + ' features</div>';
  }
  el.innerHTML = html;
}

function copyMatrixMarkdown() {
  if (!_matrixData) return;
  var features = _matrixData.features || [];
  var comps = _matrixData.competitors || [];
  var dp = _matrixData.dream_play || {};
  var cell = function(v) { return v === 'has' ? 'YES' : v === 'lacks' ? 'NO' : v === 'shared' ? '~' : '-'; };
  var header = '| Feature | [Company] | ' + comps.map(function(c){ return c.name; }).join(' | ') + ' |';
  var sep = '|' + Array(comps.length + 2).fill('---').join('|') + '|';
  var rows = features.slice(0, 50).map(function(f) {
    return '| ' + f + ' | ' + cell(dp[f] === 'has' ? 'has' : null) + ' | ' + comps.map(function(c){ return cell(c.cells[f]); }).join(' | ') + ' |';
  });
  var md = [header, sep].concat(rows).join('\\n');
  navigator.clipboard.writeText(md).then(function() {
    var btn = document.querySelector('[onclick="copyMatrixMarkdown()"]');
    if (btn) { btn.textContent = 'Copied!'; setTimeout(function(){ btn.innerHTML = '&#128203; Copy Markdown'; }, 2000); }
  }).catch(function(){});
}

// ── Escape key closes open modals ────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('[id$="-modal"],[class*="modal-overlay"]').forEach(function(m){
    if (m.style.display && m.style.display !== 'none') m.style.display = 'none';
  });
  // close battlecard modal specifically
  var bc = document.getElementById('battlecard-modal');
  if (bc) bc.style.display = 'none';
});

// ── Overview alerts mini card ─────────────────────────────────────────────
function renderOverviewAlertsMini(changes) {
  var el = document.getElementById('overview-alerts-mini');
  if (!el) return;
  var alerts = (changes||[]).filter(function(c){ return c.severity==='critical'||c.severity==='high'; }).slice(0,5);
  if (!alerts.length) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted);font-size:12px">&#10003; No active high-priority alerts</div>';
    return;
  }
  el.innerHTML = alerts.map(function(c){
    var sev = c.severity||'low';
    var cls = sev==='critical'?'badge-critical':sev==='high'?'badge-high':'badge-medium';
    return '<div style="padding:6px 0;border-bottom:1px solid rgba(37,43,56,.4);font-size:12px">' +
      '<span class="badge '+cls+'" style="margin-right:6px">'+sev.toUpperCase()+'</span>' +
      (c.competitor_id||'') + ' &mdash; ' + (c.field||c.change_type||'change') +
      '</div>';
  }).join('');
}

loadData();
setInterval(tick, 1000);
tick();

// Unread review badge on the Review tab
function refreshReviewBadge() {
  fetch(BASE+'/api/review-queue').then(function(r){ return r.json(); }).then(function(items) {
    var btn = document.getElementById('tab-btn-eval');
    if (!btn) return;
    var count = items.length;
    if (count > 0) {
      btn.innerHTML = 'Review <span style="display:inline-flex;align-items:center;justify-content:center;background:var(--red);color:#fff;font-size:9px;font-weight:700;border-radius:10px;padding:1px 5px;margin-left:4px;min-width:16px">' + count + '</span>';
    } else {
      btn.textContent = 'Review';
    }
  }).catch(function(){});
}
refreshReviewBadge();
setInterval(refreshReviewBadge, 60000);

// ── API Key ───────────────────────────────────────────────────────────────
function saveApiKey() {
  const provider = document.getElementById('key-provider').value;
  const key      = document.getElementById('key-input').value.trim();
  const status   = document.getElementById('key-status');
  if (!key) { status.innerHTML = '<span style="color:#e05252">Please paste a key first.</span>'; return; }
  status.innerHTML = 'Saving...';
  fetch(BASE+'/api/set-key', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({provider, key})})
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        status.innerHTML = '<span class="key-ok">&#10003; Key saved. You can now run trend analysis.</span>';
        document.getElementById('key-input').value = '';
        setTimeout(loadData, 500);
      } else {
        status.innerHTML = '<span style="color:#e05252">Error: ' + (d.error||'unknown') + '</span>';
      }
    });
}

function runTrendAnalysis() {
  const logWrap   = document.getElementById('run-log');
  const statusBar = document.getElementById('run-status-bar');
  if (_runActive) { alert('A process is already running.'); return; }
  // Switch to summary tab to show the log
  switchTab('summary');
  document.querySelector('.run-panel').scrollIntoView({behavior:'smooth'});
  setTimeout(() => {
    _runActive = true;
    logWrap.classList.add('visible');
    logWrap.innerHTML = '';
    statusBar.innerHTML = '<span class="run-spinner"></span>&nbsp;Running <b>Trend Analysis + PRD Generation</b>...';
    document.querySelectorAll('.run-btn').forEach(b => b.disabled = true);
    fetch(BASE+'/api/run-trend-analysis', {method:'POST'})
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          statusBar.innerHTML = '&#10060; ' + data.error;
          _runActive = false;
          document.querySelectorAll('.run-btn').forEach(b => b.disabled = false);
          return;
        }
        if (_runEvt) _runEvt.close();
        _runEvt = new EventSource(BASE+'/api/run-log');
        _runEvt.onmessage = function(e) {
          const line = e.data;
          if (line === '[IDLE]') {
            _runEvt.close(); _runActive = false;
            statusBar.innerHTML = '&#10003; Done. Check the PRDs tab for results.';
            document.querySelectorAll('.run-btn').forEach(b => b.disabled = false);
            setTimeout(loadData, 1500);
            return;
          }
          const div = document.createElement('div');
          div.className = line.startsWith('[START]') ? 'log-line-start'
                        : line.startsWith('[DONE]')  ? 'log-line-done'
                        : line.toLowerCase().includes('error') ? 'log-line-error' : 'log-line-info';
          div.textContent = line;
          logWrap.appendChild(div);
          logWrap.scrollTop = logWrap.scrollHeight;
        };
        _runEvt.onerror = function() {
          _runEvt.close(); _runActive = false;
          statusBar.innerHTML = '&#10003; Analysis complete. Check PRDs tab.';
          document.querySelectorAll('.run-btn').forEach(b => b.disabled = false);
          setTimeout(loadData, 1500);
        };
      });
  }, 400);
}

// ── Outputs Tab ───────────────────────────────────────────────────────────
function renderOutputsTab(data) {
  // API key banner
  const keys = data.api_keys || {};
  const banner = document.getElementById('prd-gen-banner');
  if (keys.anthropic || keys.gemini) {
    const provider = keys.anthropic ? 'Anthropic (Claude)' : 'Google Gemini';
    banner.innerHTML = `
      <div class="prd-gen-title">&#129302; Ready to Generate PRDs</div>
      <div class="prd-gen-sub">${provider} key active &middot; ${data.stats.total_signals} signals collected &middot; ${data.stats.prds} PRDs generated so far</div>
      <button class="prd-gen-btn" onclick="runTrendAnalysis()">&#9889; Run Trend Analysis + Generate PRDs</button>
      <div style="font-size:10px;color:var(--muted);margin-top:10px">Takes ~2 min &middot; Saves to DB + /data/prds/ &middot; Posts summary to #ci-prds</div>`;
  } else {
    document.getElementById('prd-gen-title') && (document.getElementById('prd-gen-title').textContent =
      'Generate PRDs from ' + data.stats.total_signals + ' Signals');
  }

  const outputs = data.outputs || {};

  // Render static panels
  renderChangelogPanel(outputs.changes || []);
  _allIntelForFilter = outputs.intel || [];
  _populateFilterBar(_allIntelForFilter);
  renderBattleCardsPanel(_allIntelForFilter);
  renderAlertsPanel(outputs.changes || []);
  renderWeeklyBriefPanel(data);
  renderSentPanel(outputs.sent || []);

  // Load research feed from dedicated endpoint
  fetch(BASE+'/api/research_feed')
    .then(r => r.json())
    .then(feed => renderResearchFeedPanel(feed))
    .catch(() => {
      const p = document.getElementById('output-panel-research_feed');
      if (p) p.innerHTML = emptyState('&#128270;', 'Research feed unavailable', 'Could not load signal data.');
    });

  // Always re-enforce which panel is visible after re-rendering all panels
  switchOutput(_activeOutput || 'research_feed');
}

function renderChangelogPanel(changes) {
  const p = document.getElementById('output-panel-changelog');
  if (!changes.length) {
    p.innerHTML = emptyState('&#128203;', 'No changelog entries yet', 'Changes are detected when competitor pricing, features or messaging shifts. Run the pricing or web scrapers to start detecting.');
    return;
  }
  p.innerHTML = changes.map(c => {
    const sev = c.severity || 'low';
    const sevColor = sev === 'critical' ? '#e05252' : sev === 'high' ? '#f5a623' : sev === 'medium' ? '#4f8ef7' : '#64748b';
    return `<div class="output-card">
      <div class="output-card-header">
        <span class="output-card-icon">&#128203;</span>
        <div class="output-card-title">${c.competitor_id} &mdash; ${(c.change_type||'change').replace(/_/g,' ')}</div>
        <span class="badge" style="background:${sevColor}22;color:${sevColor};border:1px solid ${sevColor}44;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">${sev.toUpperCase()}</span>
        <span class="output-card-meta">${toIST(c.detected_at||'')}</span>
      </div>
      ${c.summary ? `<div class="output-card-body">${c.summary}</div>` : ''}
    </div>`;
  }).join('');
}

function _intelCardProse(d) {
  var analysis = {};
  try { analysis = JSON.parse(d.analysis_json || d.preview || '{}'); } catch(e) {}
  var comp = d.competitor_id;
  var pt = d.processor_type;
  var confScore = d.confidence_score !== null && d.confidence_score !== undefined ? Number(d.confidence_score) : null;
  var confBadge = confScore === null
    ? '<span style="font-size:10px;color:var(--muted);border:1px solid var(--border);padding:1px 6px;border-radius:10px">not scored</span>'
    : '<span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;background:' + (confScore>=7?'rgba(16,185,129,.12)':confScore>=4?'rgba(245,158,11,.12)':'rgba(239,68,68,.1)') + ';color:' + (confScore>=7?'var(--green)':confScore>=4?'#f59e0b':'var(--red)') + '">' + confScore.toFixed(1) + '/10</span>';
  var body = '';
  if (pt === 'hiring_signals') {
    var infs = analysis.roadmap_inferences || [];
    var topInf = infs[0] || {};
    var count = (analysis.hiring_velocity || {}).total_new_roles || infs.length || '?';
    body = '<b>' + _esc(comp) + '</b> is hiring <b>' + count + ' product/engineering roles</b>.' +
      (topInf.inference ? ' Top inference: ' + _esc(topInf.inference) + (topInf.confidence ? ' (' + _esc(topInf.confidence) + ' confidence).' : '.') : '');
  } else if (pt === 'feature_gap') {
    var gaps = analysis.features_only_competitor_has || [];
    var gapScore = analysis.gap_score || '?';
    var threat = analysis.threat_level || '?';
    var action = analysis.recommended_action || '';
    body = '<b>' + _esc(comp) + '</b> has <b>' + gaps.length + ' features</b> [Company] lacks.' +
      (gaps[0] ? ' Biggest gap: ' + _esc(String(gaps[0])) + '.' : '') +
      ' Gap score: ' + gapScore + '/10 &middot; Threat: ' + _esc(String(threat)) + '.' +
      (action ? ' <em>Action: ' + _esc(String(action)) + '</em>' : '');
  } else if (pt === 'pricing') {
    var tiers = analysis.pricing_tiers || [];
    var t = tiers[0] || {};
    var vs = analysis.vs_dream_play || '';
    body = '<b>' + _esc(comp) + '</b> pricing: ' +
      (t.name ? '<b>' + _esc(t.name) + '</b> ' : '') +
      (t.price_monthly ? _esc(t.price_monthly) + '/mo' : '') +
      (t.target_segment ? ' &mdash; ' + _esc(t.target_segment) : '') + '.' +
      (vs ? ' ' + _esc(String(vs)) : '');
  } else if (pt === 'news_digest') {
    var items = analysis.items || [];
    var top = items[0] || {};
    body = top.headline
      ? '<b>' + _esc(top.headline.length > 120 ? top.headline.slice(0,120)+'...' : top.headline) + '</b>' +
        (top.insight ? ' &mdash; ' + _esc(top.insight) : '')
      : _esc(analysis.top_insight || analysis.summary || 'News digest available.');
  } else if (pt === 'review_sentiment') {
    var pains = analysis.pain_points || [];
    var p0 = pains[0] || {};
    var rating = analysis.avg_rating || '';
    body = '<b>' + _esc(comp) + '</b> users report: ' +
      (p0.theme ? '<b>' + _esc(p0.theme) + '</b>' + (p0.frequency ? ' (' + _esc(String(p0.frequency)) + ' mentions)' : '') : 'feedback available') + '.' +
      (rating ? ' Avg rating: ' + _esc(String(rating)) + '&#9733;.' : '') +
      (analysis.opportunity ? ' Opportunity: ' + _esc(String(analysis.opportunity)) : '');
  } else if (pt === 'narrative') {
    var claims = (analysis.claims_to_counter || []).map(function(c){ return c.claim || c; });
    body = '<b>' + _esc(comp) + '</b> narrative: ' +
      _esc(String(analysis.their_positioning || analysis.summary || 'positioning analysis available')) + '.' +
      (claims.length ? ' Counter: ' + _esc(String(claims[0])) + '.' : '');
  } else {
    body = _esc(d.summary || analysis.summary || 'Intelligence available.');
  }
  return { body: body, confBadge: confBadge, confScore: confScore };
}

function renderBattleCardsPanel(intel) {
  var p = document.getElementById('output-panel-battle_cards');
  // Apply all filters
  var cutoff = null;
  if (_outputDateRange === '7d') cutoff = Date.now() - 7 * 86400000;
  else if (_outputDateRange === '30d') cutoff = Date.now() - 30 * 86400000;
  var cards = intel.filter(function(c) {
    if (_outputFilterCompetitor && c.competitor_id !== _outputFilterCompetitor) return false;
    if (_outputFilterTypes.length && !_outputFilterTypes.includes(c.processor_type)) return false;
    if (_outputConfMin > 0 && (c.confidence_score === null || c.confidence_score === undefined || Number(c.confidence_score) < _outputConfMin)) return false;
    if (cutoff && new Date(c.created_at).getTime() < cutoff) return false;
    return true;
  });
  if (!cards.length) {
    p.innerHTML = emptyState('&#9855;', 'No battle cards yet', 'Battle cards are generated by running the Feature Gap Tracker and Narrative Diff processors. Add an API key and run the full pipeline.');
    return;
  }
  if (_outputGrouping === 'competitor') {
    // Group by competitor
    var groups = {};
    var order = [];
    cards.forEach(function(c) {
      if (!groups[c.competitor_id]) { groups[c.competitor_id] = []; order.push(c.competitor_id); }
      groups[c.competitor_id].push(c);
    });
    p.innerHTML = order.map(function(cid) {
      var groupCards = groups[cid];
      var groupHtml = groupCards.map(function(c) {
        var prose = _intelCardProse(c);
        return '<div class="output-card">' +
          '<div class="output-card-header">' +
          '<span class="output-card-icon">&#9855;</span>' +
          '<div class="output-card-title">' + (c.competitor_id||'').replace(/_/g,' ') + '</div>' +
          '<span class="output-card-meta">' + prose.confBadge + ' &middot; ' + (c.processor_type||'').replace(/_/g,' ') + ' &middot; ' + toIST(c.created_at||'') + '</span>' +
          '</div>' +
          '<div class="output-card-body">' + prose.body + '</div>' +
          '</div>';
      }).join('');
      return '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.08em;margin-bottom:8px;padding:4px 0;border-bottom:1px solid var(--border)">' + cid.replace(/_/g,' ') + '</div>' + groupHtml + '</div>';
    }).join('');
  } else {
    // Chronological
    p.innerHTML = cards.map(function(c) {
      var prose = _intelCardProse(c);
      return '<div class="output-card">' +
        '<div class="output-card-header">' +
        '<span class="output-card-icon">&#9855;</span>' +
        '<div class="output-card-title">' + (c.competitor_id||'').replace(/_/g,' ') + '</div>' +
        '<span class="output-card-meta">' + prose.confBadge + ' &middot; ' + (c.processor_type||'').replace(/_/g,' ') + ' &middot; ' + toIST(c.created_at||'') + '</span>' +
        '</div>' +
        '<div class="output-card-body">' + prose.body + '</div>' +
        '</div>';
    }).join('');
  }
}

function renderAlertsPanel(changes) {
  const p = document.getElementById('output-panel-alerts');
  const alerts = changes.filter(c => c.severity === 'critical' || c.severity === 'high');
  if (!alerts.length) {
    p.innerHTML = emptyState('&#128680;', 'No high-priority alerts', 'Critical and high-severity competitor changes trigger immediate Slack alerts to #ci-alerts. All clear for now.');
    return;
  }
  p.innerHTML = alerts.map(c => {
    const color = c.severity === 'critical' ? '#e05252' : '#f5a623';
    return `<div class="output-card" style="border-left:3px solid ${color}">
      <div class="output-card-header">
        <span class="output-card-icon">${c.severity === 'critical' ? '&#128680;' : '&#9888;&#65039;'}</span>
        <div class="output-card-title">${c.competitor_id}: ${(c.change_type||'').replace(/_/g,' ')}</div>
        <span class="output-card-meta">${c.alerted ? '&#10003; Sent' : 'Pending'} &middot; ${toIST(c.detected_at||'')}</span>
      </div>
      ${c.summary ? `<div class="output-card-body">${c.summary}</div>` : ''}
    </div>`;
  }).join('');
}

function renderWeeklyBriefPanel(data) {
  const p   = document.getElementById('output-panel-weekly_brief');
  const st  = data.stats || {};
  const tcs = data.top_competitors || [];
  const dateStr = new Date().toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'});
  const topRows = tcs.slice(0,5).map(c => '  ' + (c.competitor||'').padEnd(20,' ') + ' ' + (c.signals||0) + ' signals').join('\\n') || '  (Run collectors to populate)';
  const alertLine = st.pending_alerts > 0 ? st.pending_alerts + ' high/critical changes pending — check #ci-alerts' : 'No critical alerts this week';
  const prdLine   = st.prds > 0 ? st.prds + ' feature PRDs generated — see #ci-prds' : 'No PRDs yet — run trend analysis to generate';
  const body = [
    '&#128227; DREAM PLAY COMPETITIVE INTELLIGENCE',
    'Week of ' + dateStr,
    '',
    '&#128202; SIGNAL SUMMARY',
    'Total signals collected : ' + (st.total_signals || 0),
    'Changes detected        : ' + (st.changes || 0),
    'Pending alerts          : ' + (st.pending_alerts || 0),
    'PRDs generated          : ' + (st.prds || 0),
    'Intel reports           : ' + (st.intel_reports || 0),
    '',
    '&#127942; TOP COMPETITORS BY SIGNAL VOLUME',
    topRows,
    '',
    '&#128680; ALERTS',
    '  ' + alertLine,
    '',
    '&#128221; PRDS',
    '  ' + prdLine,
    '',
    '---',
    'Generated by [Company] CI Bot',
  ].join('\\n');
  p.innerHTML = '<div class="output-card">'
    + '<div class="output-card-header">'
    + '<span class="output-card-icon">&#128240;</span>'
    + '<div class="output-card-title">Weekly CI Brief &mdash; Preview</div>'
    + '<span class="output-card-meta">Auto-posted Mon 9am IST to #competitive-intel</span>'
    + '</div>'
    + '<div class="output-card-body">' + body + '</div>'
    + '</div>';
}

function renderSentPanel(sent) {
  const p = document.getElementById('output-panel-sent');
  if (!sent.length) {
    p.innerHTML = emptyState('&#128228;', 'Nothing sent to Slack yet', 'Once Slack tokens are configured and the scheduler runs, all outputs (briefs, alerts, PRDs, battle cards) will appear here.');
    return;
  }
  p.innerHTML = sent.map(s => `<div class="output-card">
    <div class="output-card-header">
      <span class="output-card-icon">&#128228;</span>
      <div class="output-card-title">${s.output_type.replace(/_/g,' ')}</div>
      <span class="output-card-meta">${s.target} &middot; ${toIST(s.created_at||'')}</span>
    </div>
  </div>`).join('');
}

function renderResearchFeedPanel(feed) {
  const p = document.getElementById('output-panel-research_feed');
  if (!p) return;

  const _esc2 = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // Section builder
  function section(icon, title, cards, count) {
    if (!cards) return '';
    return `<div style="margin-bottom:24px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;display:flex;align-items:center;gap:6px">
        <span>${icon}</span><span>${title}</span>
        ${count != null ? `<span style="font-size:10px;font-weight:400;color:var(--muted);margin-left:4px">${count} items</span>` : ''}
      </div>
      ${cards}
    </div>`;
  }

  // Intel section (all processed intelligence)
  const intelHtml = (feed.intel || []).length
    ? (feed.intel || []).map(i => {
        const a = i.analysis || {};
        const summary = a.summary || a.top_insight || a.key_findings || a.differentiation_from_dream_play
          || (a.items && a.items.length ? (a.items[0].dream_play_implication || a.items[0].title) : '') || '';
        const threat = a.threat_level;
        const tColor = threat === 'critical' ? '#e05252' : threat === 'high' ? '#f5a623' : threat === 'medium' ? '#4f8ef7' : '';
        const score = i.confidence_score ? `${Number(i.confidence_score).toFixed(1)}/10` : '';
        return `<div class="output-card" style="${tColor ? 'border-left:3px solid '+tColor : ''}">
          <div class="output-card-header">
            <span class="output-card-icon">&#129504;</span>
            <div class="output-card-title">${_esc2(i.competitor_id.replace(/_/g,' '))} &mdash; ${_esc2(i.processor_type.replace(/_/g,' '))}</div>
            ${threat ? `<span class="badge" style="background:${tColor}22;color:${tColor};border:1px solid ${tColor}44;padding:2px 8px;border-radius:6px;font-size:9px;font-weight:700">${threat}</span>` : ''}
            <span class="output-card-meta">${score} &middot; ${toIST(i.created_at||'')}</span>
          </div>
          ${summary ? `<div class="output-card-body">${_esc2(String(summary).slice(0,400))}</div>` : ''}
        </div>`;
      }).join('')
    : null;

  // News section
  const newsHtml = (feed.news || []).length
    ? (feed.news || []).map(s => {
        const c = s.content || {};
        const title = c.title || c.headline || '';
        const summary = c.summary || c.text || '';
        return `<div class="output-card">
          <div class="output-card-header">
            <span class="output-card-icon">&#128240;</span>
            <div class="output-card-title">${_esc2(title || s.competitor_id)}</div>
            <span class="output-card-meta" style="text-transform:capitalize">${_esc2(s.competitor_id.replace(/_/g,' '))} &middot; ${toISTDate(s.collected_at||'')}</span>
          </div>
          ${summary ? `<div class="output-card-body">${_esc2(String(summary).slice(0,300))}</div>` : ''}
          ${s.source_url ? `<div style="padding:6px 16px 10px"><a href="${_esc2(s.source_url)}" target="_blank" style="font-size:10px;color:var(--accent)">Read source</a></div>` : ''}
        </div>`;
      }).join('')
    : null;

  // Trends section (filter for high signal)
  const topTrends = (feed.trends || []).filter(s => {
    const c = s.content || {};
    return (c.points || c.num_comments || 0) > 5 || c.title;
  }).slice(0, 12);
  const trendsHtml = topTrends.length
    ? topTrends.map(s => {
        const c = s.content || {};
        const pts = c.points || c.num_comments || 0;
        const cat = c.signal_category || c.source || '';
        return `<div class="output-card">
          <div class="output-card-header">
            <span class="output-card-icon">&#128200;</span>
            <div class="output-card-title">${_esc2(c.title || s.competitor_id)}</div>
            <span class="output-card-meta" style="text-transform:capitalize">${_esc2(s.competitor_id.replace(/_/g,' '))}${cat ? ' &middot; '+_esc2(cat) : ''}${pts ? ' &middot; '+pts+' pts' : ''}</span>
          </div>
          ${s.source_url ? `<div style="padding:4px 16px 10px"><a href="${_esc2(s.source_url)}" target="_blank" style="font-size:10px;color:var(--accent)">View thread</a></div>` : ''}
        </div>`;
      }).join('')
    : null;

  // Social highlights (score >= 2 or has title)
  const topSocial = (feed.social || []).filter(s => {
    const c = s.content || {};
    return (c.score || 0) >= 2 || c.title || c.text;
  }).slice(0, 12);
  const socialHtml = topSocial.length
    ? topSocial.map(s => {
        const c = s.content || {};
        return `<div class="output-card">
          <div class="output-card-header">
            <span class="output-card-icon">&#128172;</span>
            <div class="output-card-title">${_esc2(c.title || 'Reddit Post')}</div>
            <span class="output-card-meta">${_esc2(s.competitor_id.replace(/_/g,' '))} &middot; r/${_esc2(c.subreddit||'')} &middot; score ${c.score||0}</span>
          </div>
          ${c.text ? `<div class="output-card-body">${_esc2(String(c.text).slice(0,280))}</div>` : ''}
        </div>`;
      }).join('')
    : null;

  // Pricing signals
  const pricingHtml = (feed.pricing || []).length
    ? (feed.pricing || []).map(s => {
        const c = s.content || {};
        const prices = Array.isArray(c.price_elements) ? c.price_elements.slice(0,4).join(', ') : '';
        return `<div class="output-card">
          <div class="output-card-header">
            <span class="output-card-icon">&#128176;</span>
            <div class="output-card-title">${_esc2(c.name || c.title || c.h1 || s.competitor_id)}</div>
            <span class="output-card-meta" style="text-transform:capitalize">${_esc2(s.competitor_id.replace(/_/g,' '))} &middot; ${toISTDate(s.collected_at||'')}</span>
          </div>
          ${prices ? `<div class="output-card-body">Prices found: ${_esc2(prices)}</div>` : ''}
          ${c.cta_text ? `<div class="output-card-body" style="padding-top:0">CTA: ${_esc2(c.cta_text)}</div>` : ''}
        </div>`;
      }).join('')
    : null;

  // Hiring signals (all recent job postings)
  const newJobs = (feed.jobs || []).slice(0, 12);
  const jobsHtml = newJobs.length
    ? newJobs.map(s => {
        const c = s.content || {};
        return `<div class="output-card">
          <div class="output-card-header">
            <span class="output-card-icon">&#128188;</span>
            <div class="output-card-title">${_esc2(c.title || 'Job Posting')}</div>
            <span class="output-card-meta" style="text-transform:capitalize">${_esc2(c.company || s.competitor_id.replace(/_/g,' '))} &middot; ${_esc2(c.location||'')} &middot; ${_esc2(c.source||'')}</span>
          </div>
        </div>`;
      }).join('')
    : null;

  const hasAny = [intelHtml, newsHtml, trendsHtml, socialHtml, pricingHtml, jobsHtml].some(Boolean);
  if (!hasAny) {
    p.innerHTML = emptyState('&#128270;', 'No research data yet', 'Run the collectors to start gathering competitive signals. They will appear here automatically.');
    return;
  }

  p.innerHTML = [
    intelHtml  ? section('&#129504;', 'Processed Intelligence', intelHtml, (feed.intel||[]).length) : '',
    newsHtml   ? section('&#128240;', 'News Signals', newsHtml, (feed.news||[]).length) : '',
    trendsHtml ? section('&#128200;', 'Trend Discussions', trendsHtml, topTrends.length) : '',
    socialHtml ? section('&#128172;', 'High-Signal Social Posts', socialHtml, topSocial.length) : '',
    pricingHtml? section('&#128176;', 'Pricing Intelligence', pricingHtml, (feed.pricing||[]).length) : '',
    jobsHtml   ? section('&#128188;', 'Hiring Activity', jobsHtml, newJobs.length) : '',
  ].join('');
}

function emptyState(icon, title, sub) {
  return `<div class="output-empty"><div class="output-empty-icon">${icon}</div>
    <div style="font-weight:600;margin-bottom:6px;color:var(--text)">${title}</div>
    <div style="font-size:12px;max-width:400px;margin:0 auto">${sub}</div></div>`;
}

function toggleArch() {
  const body = document.getElementById('arch-dropdown-body');
  const icon = document.getElementById('arch-toggle-icon');
  if (!body) return;
  if (body.style.display === 'none') {
    body.style.display = '';
    icon.textContent = '\u25B2 Hide diagram';
    // Draw arrows after the DOM is visible
    setTimeout(drawArchArrows, 50);
  } else {
    body.style.display = 'none';
    icon.textContent = '\u25BC Show diagram';
  }
}

function showOriginalArch() {
  document.getElementById('orig-arch-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeOriginalArch() {
  document.getElementById('orig-arch-modal').style.display = 'none';
  document.body.style.overflow = '';
}

// ── Collectors Tab ────────────────────────────────────────────────────────────
let _selectedCollector = null;

const _COLL_TYPE_MAP = {
  'News Feeds': 'news', 'App Reviews': 'reviews', 'Social Signals': 'social',
  'Job Postings': 'jobs', 'Web Scraper': 'web', 'Pricing Pages': 'pricing',
  'Trend Research': 'trends', 'Patent Filings': 'patents',
};
const _COLL_ICONS = {
  'News Feeds': '&#128240;', 'App Reviews': '&#11088;', 'Social Signals': '&#128172;',
  'Job Postings': '&#128188;', 'Web Scraper': '&#127760;', 'Pricing Pages': '&#128176;',
  'Trend Research': '&#128200;', 'Patent Filings': '&#128196;',
};

const _COLL_LABELS = {
  'news': 'News Feeds', 'reviews': 'App Reviews', 'social': 'Social Signals',
  'jobs': 'Job Postings', 'web': 'Web Scraper', 'pricing': 'Pricing Pages',
  'trends': 'Trend Research', 'patents': 'Patent Filings',
};

function renderCollectorsTab(collectors) {
  if (_allCompetitors.length) {
    try { renderCoverageGaps(_allCompetitors); } catch(e) {}
  } else {
    fetch(BASE+'/api/competitors').then(r=>r.json()).then(d=>{
      _allCompetitors = d;
      try { renderCoverageGaps(_allCompetitors); } catch(e) {}
    }).catch(()=>{});
  }
  const el = document.getElementById('collector-grid-lg');
  if (!el || !collectors) return;
  el.innerHTML = collectors.map(c => {
    const ctype  = _COLL_TYPE_MAP[c.label] || 'news';
    const icon   = _COLL_ICONS[c.label] || '&#128225;';
    const sel    = _selectedCollector === ctype;
    const hasRun = c.last_run !== null;
    return `<div class="collector-card-lg ${sel ? 'selected' : ''}" onclick="loadCollectorSignals('${ctype}')">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-size:22px">${icon}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${c.label}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:1px">${hasRun ? toISTShort(c.last_run||'') : 'Never run'}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:12px;color:${c.last_count ? 'var(--accent)' : 'var(--muted)'}">${c.last_count !== null ? c.last_count + ' signals' : 'No data yet'}</span>
        <span style="font-size:11px;color:var(--accent);font-weight:600">View &#8594;</span>
      </div>
    </div>`;
  }).join('');
}

function loadCollectorSignals(ctype) {
  const label = _COLL_LABELS[ctype] || ctype;
  _selectedCollector = ctype;
  if (cachedData) renderCollectorsTab(cachedData.collector_status);
  const panel  = document.getElementById('collector-detail-panel');
  const title  = document.getElementById('collector-detail-title');
  const list   = document.getElementById('collector-signals-list');
  panel.style.display = 'block';
  title.textContent = label + ' — Recent Raw Signals';
  list.innerHTML = '<div style="color:var(--muted);text-align:center;padding:30px">Loading...</div>';
  panel.scrollIntoView({behavior: 'smooth', block: 'start'});
  fetch(BASE+'/api/collector/' + ctype + '/signals')
    .then(r => r.json())
    .then(signals => {
      if (!signals.length) {
        list.innerHTML = '<div class="empty">No signals collected yet for this collector.<br>Run it from the Agent Summary tab.</div>';
        return;
      }
      list.innerHTML = signals.map((s, i) => _buildSignalCard(s, 'sc', i)).join('');
    });
}

const _SKIP_KEYS = new Set(['competitor_id','source_url']);

function _buildSignalCard(s, prefix, i) {
  let obj = {};
  try { obj = JSON.parse(s.raw_content); } catch(e) { obj = {raw: s.raw_content}; }

  // All non-empty fields except skip list and the url field (shown as link)
  const url = obj.url || s.source_url || '';
  const fields = Object.entries(obj)
    .filter(([k, v]) => !_SKIP_KEYS.has(k) && k !== 'url' && v !== null && v !== undefined && String(v).trim())
    .map(([k, v]) => {
      const val = String(v).length > 300 ? String(v).slice(0, 300) + '...' : String(v);
      return `<div class="sig-field"><span class="sig-key">${_esc(k)}</span><span class="sig-val">${_esc(val)}</span></div>`;
    }).join('');

  const fullJson = _esc(JSON.stringify(obj, null, 2));
  const linkHtml = url ? `<a href="${_esc(url)}" target="_blank" style="color:var(--accent);font-size:10px;margin-left:auto">&#8599; Source</a>` : '';
  const compBadge = s.competitor_id ? `<span class="badge badge-medium" style="text-transform:uppercase;font-size:9px">${s.competitor_id}</span>` : '';

  return `<div class="signal-card">
    <div class="signal-card-header">
      ${compBadge}
      <span style="color:var(--muted);font-size:10px">${toIST(s.collected_at||'')}</span>
      ${linkHtml}
    </div>
    <div class="sig-fields" id="${prefix}f-${i}">${fields || '<span style="color:var(--muted);font-size:11px">No structured fields</span>'}</div>
    <div class="sig-full" id="${prefix}j-${i}">${fullJson}</div>
    <button class="expand-btn" onclick="toggleSigJson('${prefix}',${i},this)">Show Full JSON</button>
  </div>`;
}

function toggleSigJson(prefix, i, btn) {
  const fields = document.getElementById(prefix + 'f-' + i);
  const full   = document.getElementById(prefix + 'j-' + i);
  if (!full) return;
  const showing = full.style.display === 'block';
  full.style.display   = showing ? 'none' : 'block';
  fields.style.display = showing ? '' : 'none';
  btn.textContent = showing ? 'Show Full JSON' : 'Hide JSON';
}

function _esc(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function closeCollectorDetail() {
  _selectedCollector = null;
  document.getElementById('collector-detail-panel').style.display = 'none';
  if (cachedData) renderCollectorsTab(cachedData.collector_status);
}

function renderCoverageGaps(competitors) {
  const el = document.getElementById('collector-coverage-gaps');
  if (!el) return;
  const gaps = (competitors || []).filter(c => c.active !== false && (c.app_store_id || c.play_store_id) && (c.app_review_count || 0) === 0);
  if (!gaps.length) { el.innerHTML = ''; return; }
  const names = gaps.map(c => c.name).join(', ');
  el.innerHTML = '<div class="coverage-gap-banner"><div class="coverage-gap-title">&#9888; App Review Coverage Gaps</div>'
    + '<div class="coverage-gap-list">' + gaps.length + ' competitors have app store IDs but no reviews collected: <strong>' + names + '</strong></div>'
    + '<button class="coverage-gap-btn" onclick="runBackfillReviews()">&#11088; Run Reviews Backfill Now</button></div>';
}

function runBackfillReviews() {
  if (_runActive) { alert('A collector is already running. Please wait.'); return; }
  _runActive = true;
  const btn = document.querySelector('.coverage-gap-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Running...'; }
  fetch(BASE+'/api/run-backfill-reviews', {method:'POST'})
    .then(r => r.json())
    .then(data => {
      if (data.error) { alert('Error: ' + data.error); _runActive = false; if (btn) { btn.disabled = false; btn.textContent = 'Run Reviews Backfill Now'; } return; }
      if (_runEvt) _runEvt.close();
      switchTab('summary');
      _runEvt = new EventSource(BASE+'/api/run-log');
      _runEvt.onmessage = function(e) { /* handled by summary tab log */ };
      _runEvt.onerror = function() { _runEvt.close(); _runActive = false; };
    });
}

// ── Process Intelligence ───────────────────────────────────────────────────────
function runProcessors() {
  if (_runActive) { alert('A process is already running. Please wait.'); return; }
  _runActive = true;
  const logWrap   = document.getElementById('run-log');
  const statusBar = document.getElementById('run-status-bar');
  const btn       = document.getElementById('rbtn-processors');
  logWrap.classList.add('visible');
  logWrap.innerHTML = '';
  statusBar.innerHTML = '<span class="run-spinner"></span>&nbsp;Running full processor pipeline...';
  if (btn) { btn.disabled = true; btn.textContent = '&#9654; Processing... (this may take a few minutes)'; }
  document.querySelectorAll('.run-btn').forEach(b => { b.disabled = true; });

  fetch(BASE+'/api/run-processors', {method:'POST'})
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        statusBar.innerHTML = '&#10060; Error: ' + data.error;
        _runActive = false;
        document.querySelectorAll('.run-btn').forEach(b => { b.disabled = false; });
        if (btn) { btn.disabled = false; btn.textContent = '&#9654; Run All Processors (Full Pipeline)'; }
        return;
      }
      if (_runEvt) _runEvt.close();
      _runEvt = new EventSource(BASE+'/api/run-log');
      _runEvt.onmessage = function(e) {
        const line = e.data;
        const div = document.createElement('div');
        div.className = line.startsWith('[START]') ? 'log-line-start' : line.startsWith('[DONE]') ? 'log-line-done' : line.toLowerCase().includes('error') ? 'log-line-error' : 'log-line-info';
        div.textContent = line;
        logWrap.appendChild(div);
        logWrap.scrollTop = logWrap.scrollHeight;
        if (line.startsWith('[DONE]')) {
          _runEvt.close();
          _runActive = false;
          statusBar.innerHTML = '&#10003; Processor pipeline complete. Refreshing data...';
          document.querySelectorAll('.run-btn').forEach(b => { b.disabled = false; });
          if (btn) { btn.disabled = false; btn.textContent = '&#9654; Run All Processors (Full Pipeline)'; }
          setTimeout(loadData, 1500);
        }
      };
      _runEvt.onerror = function() {
        _runEvt.close();
        _runActive = false;
        statusBar.innerHTML = '&#10060; Connection lost.';
        document.querySelectorAll('.run-btn').forEach(b => { b.disabled = false; });
        if (btn) { btn.disabled = false; btn.textContent = '&#9654; Run All Processors (Full Pipeline)'; }
      };
    })
    .catch(err => {
      statusBar.innerHTML = '&#10060; Failed to start: ' + err.message;
      _runActive = false;
      document.querySelectorAll('.run-btn').forEach(b => { b.disabled = false; });
      if (btn) { btn.disabled = false; btn.textContent = '&#9654; Run All Processors (Full Pipeline)'; }
    });
}

// ── Competitors Tab ───────────────────────────────────────────────────────────
let _selectedCompetitor = null;
let _compView = 'detail';
let _intelCache = {};

function loadCompetitorsTab() {
  if (_allCompetitors.length) {
    if (_compView === 'detail') renderCompetitorList(_filteredCompetitors.length ? _filteredCompetitors : _allCompetitors);
    else renderCompMatrix(_allCompetitors);
    return;
  }
  fetch(BASE+'/api/competitors')
    .then(r => r.json())
    .then(data => {
      _allCompetitors = data;
      _filteredCompetitors = data;
      if (_compView === 'detail') renderCompetitorList(data);
      else renderCompMatrix(data);
      try { renderThreatLeaderboard(data); } catch(e) {}
      try { renderCoverageGaps(data); } catch(e) {}
    });
}

function setCompView(v) {
  _compView = v;
  document.querySelectorAll('.vtab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && v === 'detail') || (i === 1 && v === 'matrix'));
  });
  document.getElementById('comp-detail-view').style.display = v === 'detail' ? 'flex' : 'none';
  document.getElementById('comp-matrix-view').style.display = v === 'matrix' ? 'block' : 'none';
  if (v === 'matrix') renderCompMatrix(_allCompetitors);
  else renderCompetitorList(_filteredCompetitors.length ? _filteredCompetitors : _allCompetitors);
}

function renderCompMatrix(comps) {
  const el = document.getElementById('comp-matrix-content');
  if (!el) return;
  if (!comps || !comps.length) { el.innerHTML = '<div class="empty" style="padding:40px;text-align:center">No competitor data loaded.</div>'; return; }

  function scoreCell(val, thresholds, labels) {
    if (val === null || val === undefined || val === '') return '<span class="matrix-cell cell-muted">N/A</span>';
    for (let i = 0; i < thresholds.length; i++) {
      if (val >= thresholds[i]) return '<span class="matrix-cell ' + labels[i].cls + '">' + labels[i].label + '</span>';
    }
    return '<span class="matrix-cell cell-muted">N/A</span>';
  }

  function daysSince(dt) { return daysSinceUTC(dt); }

  const rows = comps.slice(0, 30).map(c => {
    const ts = _threatScore(c);
    const tsColor = ts >= 70 ? 'cell-red' : ts >= 40 ? 'cell-orange' : ts >= 20 ? 'cell-yellow' : 'cell-muted';
    const sigCell = scoreCell(c.signal_count, [30, 10, 0], [
      {cls:'cell-green',label:c.signal_count+''},
      {cls:'cell-yellow',label:c.signal_count+''},
      {cls:'cell-muted',label:c.signal_count+''}
    ]);
    const jobDisplay = c.relevant_job_count !== undefined
      ? c.relevant_job_count + ' relevant / ' + c.total_job_count + ' total'
      : (c.job_signal_count || 0) + ' jobs';
    const jobCell = scoreCell(c.relevant_job_count !== undefined ? c.relevant_job_count : c.job_signal_count, [10, 3, 0], [
      {cls:'cell-red',label:jobDisplay},
      {cls:'cell-yellow',label:jobDisplay},
      {cls:'cell-muted',label:jobDisplay}
    ]);
    const ds = daysSince(c.last_signal);
    const actCell = c.last_signal
      ? '<span class="matrix-cell ' + (ds < 1 ? 'cell-green' : ds < 7 ? 'cell-yellow' : 'cell-muted') + '">' + (ds < 1 ? 'Today' : ds < 7 ? Math.round(ds)+'d ago' : Math.round(ds)+'d ago') + '</span>'
      : '<span class="matrix-cell cell-muted">None</span>';
    const tierCls = c.tier === 'direct' ? 'badge-high' : 'badge-medium';
    return '<tr onclick="setCompView(&apos;detail&apos;);loadCompetitorDetail(&apos;' + c.id + '&apos;)" style="cursor:pointer">'
      + '<td><span class="badge ' + tierCls + '" style="font-size:8px;margin-right:5px">' + c.tier + '</span>' + c.name + '</td>'
      + '<td style="text-align:center"><span class="matrix-cell ' + tsColor + '">' + ts + '</span></td>'
      + '<td style="text-align:center">' + sigCell + '</td>'
      + '<td style="text-align:center">' + jobCell + '</td>'
      + '<td style="text-align:center">' + actCell + '</td>'
      + '<td style="text-align:center"><span style="font-size:10px;color:var(--muted)">' + (c.sport||[]).slice(0,2).join(', ') + '</span></td>'
      + '</tr>';
  }).join('');

  el.innerHTML = '<table class="matrix-table"><thead><tr>'
    + '<th>Competitor</th><th>Threat Score</th><th>Signals</th><th>Job Postings</th><th>Last Activity</th><th>Sports</th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table>';
}

function renderCompetitorList(comps) {
  const el = document.getElementById('comp-list');
  if (!el) return;
  el.innerHTML = comps.map(c => {
    const sports  = (c.sport||[]).slice(0,2).map(s => `<span class="sport-tag">${s}</span>`).join('');
    const tierCls = c.tier === 'direct' ? 'badge-high' : 'badge-medium';
    const active  = c.active !== false;
    const dotCls  = active && c.signal_count > 0 ? 'activity-dot dot-active' : 'activity-dot';
    const ts = _threatScore(c);
    const tsCls = ts >= 70 ? 'threat-high' : ts >= 40 ? 'threat-mid' : 'threat-low';
    return `<div class="comp-list-item ${_selectedCompetitor === c.id ? 'selected' : ''}" onclick="loadCompetitorDetail('${c.id}')">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
        <span class="${dotCls}"></span>
        <div class="comp-list-name" style="flex:1">${c.name}</div>
        <span class="threat-badge ${tsCls}">${ts}</span>
      </div>
      <div class="comp-list-meta">
        <span class="badge ${tierCls}" style="font-size:9px">${c.tier}</span>
        ${sports}
        ${c.signal_count > 0 ? `<span style="color:var(--accent);font-size:10px;margin-left:auto">${c.signal_count}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function filterCompetitors(q) {
  q = q.toLowerCase();
  _filteredCompetitors = q ? _allCompetitors.filter(c =>
    c.name.toLowerCase().includes(q) || c.id.includes(q)
  ) : _allCompetitors;
  sortAndRenderCompetitors();
}

function loadCompetitorDetail(comp_id) {
  _selectedCompetitor = comp_id;
  const list = _filteredCompetitors.length ? _filteredCompetitors : _allCompetitors;
  renderCompetitorList(list);
  document.getElementById('comp-empty-state').style.display = 'none';
  const content = document.getElementById('comp-detail-content');
  content.style.display = 'block';
  content.innerHTML = '<div style="color:var(--muted);text-align:center;padding:40px">Loading...</div>';
  const comp = _allCompetitors.find(c => c.id === comp_id) || {id: comp_id, name: comp_id, sport:[], tier:'unknown'};
  Promise.all([
    fetch(BASE+'/api/competitor/' + comp_id + '/signals').then(r => r.json()),
    fetch(BASE+'/api/competitor/' + comp_id + '/intelligence').then(r => r.json()),
    fetch(BASE+'/api/competitor/' + comp_id + '/changes').then(r => r.json()),
  ]).then(([signals, intel, changes]) => {
    renderCompetitorDetail(comp, signals, intel, changes, content);
  });
}

function renderCompetitorDetail(comp, signals, intel, changes, container) {
  const tierCls = comp.tier === 'direct' ? 'badge-high' : 'badge-medium';
  const sports  = (comp.sport||[]).join(', ') || 'N/A';

  // Signals by type bar chart
  const sigByType = {};
  signals.forEach(s => { sigByType[s.signal_type] = (sigByType[s.signal_type]||0) + 1; });
  const maxSig = Math.max(1, ...Object.values(sigByType));
  const sigChart = Object.entries(sigByType).sort((a,b) => b[1]-a[1]).map(([t,n]) =>
    `<div class="bar-row"><div class="bar-label">${_sigLabel(t)}</div><div class="bar-track"><div class="bar-fill" style="width:${(n/maxSig*100).toFixed(0)}%"></div></div><div class="bar-count">${n}</div></div>`
  ).join('') || '<div class="empty">No signals yet.</div>';

  // Intel cards
  const intelHtml = intel.length ? intel.slice(0,8).map(i => {
    let parsed = {};
    try { parsed = JSON.parse(i.analysis_json); } catch(e) {}
    let summary  = parsed.summary || parsed.top_insight || parsed.key_findings || parsed.differentiation_from_dream_play
      || (parsed.items && parsed.items.length ? (parsed.items[0].dream_play_implication || parsed.items[0].title) : '')
      || (parsed.signals && parsed.signals.length ? parsed.signals[0].summary || parsed.signals[0].title : '') || '';
    if (!summary) {
      const vals = Object.values(parsed).filter(v => typeof v === 'string' && v.length > 20);
      summary = vals[0] || '';
    }
    const threat   = parsed.threat_level;
    const tCls     = threat === 'critical' ? 'badge-critical' : threat === 'high' ? 'badge-high' : 'badge-medium';
    return `<div style="background:rgba(79,142,247,.04);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:12px;font-weight:700;color:var(--text)">${i.processor_type.replace(/_/g,' ')}</span>
        ${threat ? `<span class="badge ${tCls}" style="font-size:9px">${threat}</span>` : ''}
        <span style="color:var(--muted);font-size:10px;margin-left:auto">${toIST(i.created_at||'')}</span>
      </div>
      <div style="font-size:11px;color:var(--muted);line-height:1.6">${summary ? _esc(String(summary).slice(0,350)) : '<em>No summary available</em>'}</div>
    </div>`;
  }).join('') : '<div class="empty">No intelligence reports yet.</div>';

  // Changes
  const changesHtml = changes.length ? changes.map(c =>
    `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid rgba(37,43,56,.4)">
      <span class="badge badge-${c.severity}" style="flex-shrink:0">${c.severity}</span>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;color:var(--text)">${(c.change_type||'').replace(/_/g,' ')}</div>
        ${c.diff_summary ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${_esc((c.diff_summary||'').slice(0,250))}</div>` : ''}
      </div>
      <span style="color:var(--muted);font-size:10px;white-space:nowrap">${toIST(c.detected_at||'')}</span>
    </div>`
  ).join('') : '<div class="empty">No changes detected yet.</div>';

  // External links
  const links = [
    comp.website       ? `<a href="${comp.website}" target="_blank" class="comp-link">&#127760; Website</a>` : '',
    comp.pricing_url   ? `<a href="${comp.pricing_url}" target="_blank" class="comp-link">&#128176; Pricing</a>` : '',
    comp.linkedin_company ? `<a href="https://linkedin.com/company/${comp.linkedin_company}" target="_blank" class="comp-link">&#128188; LinkedIn</a>` : '',
    comp.twitter_handle   ? `<a href="https://twitter.com/${comp.twitter_handle}" target="_blank" class="comp-link">&#128038; Twitter</a>` : '',
    comp.app_store_id     ? `<a href="https://apps.apple.com/app/id${comp.app_store_id}" target="_blank" class="comp-link">&#127822; App Store</a>` : '',
    comp.play_store_id    ? `<a href="https://play.google.com/store/apps/details?id=${comp.play_store_id}" target="_blank" class="comp-link">&#129302; Play Store</a>` : '',
  ].filter(Boolean).join('');

  // Raw signals list
  const rawSignalsHtml = signals.length ? signals.slice(0, 20).map((s, i) => _buildSignalCard(s, 'cd', i)).join('') : '<div class="empty">No signals collected yet.</div>';

  // Section A: header bar
  var tierColor = comp.tier === 'direct' ? 'var(--red)' : '#f59e0b';
  var sportBadges = (comp.sport || []).map(function(s) {
    return '<span style="font-size:10px;background:rgba(79,142,247,.12);color:#4f8ef7;padding:2px 7px;border-radius:10px;font-weight:600">' + _esc(s) + '</span>';
  }).join(' ');

  function _iconLink(url, icon, label) {
    if (!url) return '<span style="opacity:.3;font-size:18px;cursor:not-allowed" title="Not configured">' + icon + '</span>';
    return '<a href="' + _esc(url) + '" target="_blank" rel="noopener" title="' + _esc(label) + '" style="font-size:18px;text-decoration:none">' + icon + '</a>';
  }

  var cfgFields = ['website','pricing_url','linkedin_company','twitter_handle','app_store_id','play_store_id'];
  var cfgInputs = cfgFields.map(function(field) {
    return '<div><label style="font-size:10px;color:var(--muted)">' + field.replace(/_/g,' ') + '</label>' +
      '<input id="cfg-' + comp.id + '-' + field + '" value="' + _esc(comp[field] || '') + '" ' +
      'style="width:100%;font-size:11px;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);box-sizing:border-box;margin-top:2px"></div>';
  }).join('');

  var headerHtml =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:14px 16px;background:var(--card);border-radius:12px;border:1px solid var(--border)">' +
    '  <div>' +
    '    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
    '      <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:' + tierColor + '20;color:' + tierColor + '">' + _esc((comp.tier || 'unknown').toUpperCase()) + '</span>' +
    '      <span style="font-size:16px;font-weight:800;color:var(--text)">' + _esc(comp.name || comp.id) + '</span>' +
    '      ' + sportBadges +
    '    </div>' +
    '    <div style="display:flex;gap:12px;align-items:center">' +
    '      ' + _iconLink(comp.website, '&#127760;', 'Website') +
    '      ' + _iconLink(comp.pricing_url, '&#128176;', 'Pricing') +
    '      ' + _iconLink(comp.linkedin_company ? 'https://linkedin.com/company/' + comp.linkedin_company : null, '&#128188;', 'LinkedIn') +
    '      ' + _iconLink(comp.twitter_handle ? 'https://twitter.com/' + comp.twitter_handle : null, '&#128038;', 'Twitter') +
    '    </div>' +
    '  </div>' +
    '  <div style="display:flex;gap:8px">' +
    '    <button onclick="toggleEditConfig(&apos;' + comp.id + '&apos;)" style="font-size:11px;padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);cursor:pointer">&#9881; Edit Config</button>' +
    '    <button onclick="runProfileExtraction(this)" style="font-size:11px;padding:6px 12px;border-radius:8px;border:1px solid rgba(168,85,247,.3);background:rgba(168,85,247,.08);color:#a855f7;cursor:pointer">&#128101; Extract Profile</button>' +
    '  </div>' +
    '</div>' +
    '<div id="edit-config-' + comp.id + '" style="display:none;margin-bottom:14px;padding:14px 16px;background:var(--card);border-radius:12px;border:1px solid var(--border)">' +
    '  <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">Edit Config Overrides</div>' +
    '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + cfgInputs + '</div>' +
    '  <button onclick="saveCompConfig(&apos;' + comp.id + '&apos;)" style="margin-top:10px;font-size:11px;padding:5px 14px;border-radius:6px;border:none;background:var(--accent);color:#fff;cursor:pointer">Save</button>' +
    '  <span id="cfg-save-status-' + comp.id + '" style="font-size:10px;color:var(--green);margin-left:8px"></span>' +
    '</div>';

  // Signal coverage row (7-icon bar, async loaded)
  var coverageHtml =
    '<div class="card" style="margin-bottom:12px">' +
    '  <div class="card-title">Signal Coverage</div>' +
    '  <div id="comp-coverage-' + comp.id + '"><div class="empty" style="font-size:11px">Loading...</div></div>' +
    '</div>';

  // Section C: intel summary placeholder (async loaded below)
  var intelSummaryHtml =
    '<div class="card" style="margin-bottom:12px">' +
    '  <div class="card-title">Intelligence Summary</div>' +
    '  <div id="comp-intel-summary-' + comp.id + '"><div class="empty">Loading...</div></div>' +
    '</div>';

  // Section E: change history placeholder (async loaded below)
  var changeHistoryHtml =
    '<div class="card" style="margin-bottom:12px">' +
    '  <div class="card-title">Change History</div>' +
    '  <div id="comp-changes-' + comp.id + '"><div class="empty">Loading...</div></div>' +
    '</div>';

  // Section F: user notes
  var notesHtml =
    '<div class="card" style="margin-top:12px">' +
    '  <div class="card-title">Notes</div>' +
    '  <textarea id="comp-notes-' + comp.id + '" ' +
    '    placeholder="Add notes about this competitor..." ' +
    '    style="width:100%;min-height:80px;font-size:12px;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);resize:vertical;box-sizing:border-box" ' +
    '    onblur="saveCompNotes(&apos;' + comp.id + '&apos;, this.value)"></textarea>' +
    '  <span id="notes-status-' + comp.id + '" style="font-size:10px;color:var(--green)"></span>' +
    '</div>';

  // Trends sub-tab placeholder
  var trendsHtml =
    '<div class="card" style="margin-bottom:12px">' +
    '  <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">Trends' +
    '    <span style="font-size:10px;color:var(--muted);font-weight:400">Requires multiple intelligence runs over time</span>' +
    '  </div>' +
    '  <div id="comp-trends-' + comp.id + '" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:8px 0">' +
    '    <div id="comp-trend-pricing-' + comp.id + '" style="background:rgba(255,255,255,.03);border-radius:8px;padding:12px"><div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px">PRICING ARPU ($)</div><canvas id="chart-pricing-' + comp.id + '" height="80"></canvas></div>' +
    '    <div id="comp-trend-hiring-' + comp.id + '" style="background:rgba(255,255,255,.03);border-radius:8px;padding:12px"><div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px">HIRING VELOCITY</div><canvas id="chart-hiring-' + comp.id + '" height="80"></canvas></div>' +
    '    <div id="comp-trend-ratings-' + comp.id + '" style="background:rgba(255,255,255,.03);border-radius:8px;padding:12px"><div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px">APP RATING</div><canvas id="chart-ratings-' + comp.id + '" height="80"></canvas></div>' +
    '    <div id="comp-trend-threat-' + comp.id + '" style="background:rgba(255,255,255,.03);border-radius:8px;padding:12px"><div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:8px">THREAT SCORE</div><canvas id="chart-threat-' + comp.id + '" height="80"></canvas></div>' +
    '  </div>' +
    '</div>';

  container.innerHTML = headerHtml + coverageHtml + intelSummaryHtml + `
    <div id="comp-profile-card-${comp.id}" class="card" style="margin-bottom:12px">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">
        COMPETITOR PROFILE
        <button onclick="runProfileExtraction()" style="font-size:9px;padding:2px 8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:3px;color:var(--muted);cursor:pointer;font-family:inherit">Extract Now</button>
      </div>
      <div id="comp-profile-content-${comp.id}">
        <div style="padding:8px;color:var(--muted);font-size:11px">Loading profile...</div>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px"><div class="card-title">Signals by Type</div>${sigChart}</div>
    <div class="card" style="margin-bottom:16px"><div class="card-title">Latest Intelligence</div>${intelHtml}</div>
  ` + changeHistoryHtml + trendsHtml +
    '<div class="card" style="margin-bottom:16px"><div class="card-title">Recent Raw Signals (latest 20)</div>' + rawSignalsHtml + '</div>' +
    notesHtml;

  loadCompetitorProfile(comp.id);

  // Async load recent intel summary (Section C)
  fetch(BASE+'/api/competitor/' + comp.id + '/recent-intel')
    .then(function(r) { return r.json(); })
    .then(function(items) {
      var el = document.getElementById('comp-intel-summary-' + comp.id);
      if (!el) return;
      if (!items.length) { el.innerHTML = '<div class="empty">No intelligence yet</div>'; return; }
      el.innerHTML = items.map(function(d) {
        var prose = _intelCardProse(d);
        return '<div style="padding:10px 0;border-bottom:1px solid var(--border)">' +
          prose.confBadge + ' ' + prose.body +
          '</div>';
      }).join('');
    });

  // Async load change history (Section E)
  fetch(BASE+'/api/competitor/' + comp.id + '/changes')
    .then(function(r) { return r.json(); })
    .then(function(changes) {
      var el = document.getElementById('comp-changes-' + comp.id);
      if (!el) return;
      if (!changes.length) { el.innerHTML = '<div class="empty">No changes detected yet</div>'; return; }
      var sevColor = {'critical':'var(--red)','high':'#f97316','medium':'#f59e0b','low':'var(--muted)'};
      el.innerHTML = changes.map(function(c) {
        return '<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' + (sevColor[c.severity]||'var(--muted)') + ';flex-shrink:0;margin-top:4px"></span>' +
          '<div>' +
          '  <span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">' + _esc(c.change_type||'') + '</span>' +
          '  <span style="font-size:10px;color:var(--muted);margin-left:8px">' + (c.detected_at||'').split('T')[0] + '</span>' +
          '  <div style="font-size:12px;color:var(--text);margin-top:2px">' + _esc((c.diff_summary||'').slice(0,120)) + '</div>' +
          '</div>' +
          '</div>';
      }).join('');
    });

  // Async load notes (Section F)
  fetch(BASE+'/api/competitor/' + comp.id + '/notes')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var ta = document.getElementById('comp-notes-' + comp.id);
      if (ta && d.notes) ta.value = d.notes;
    });

  // Async load trend charts
  loadTrendCharts(comp.id);

  // Async load signal coverage row
  fetch(BASE+'/api/competitor/' + comp.id + '/signals-summary')
    .then(function(r) { return r.json(); })
    .then(function(summary) {
      var el = document.getElementById('comp-coverage-' + comp.id);
      if (!el) return;
      var now = Date.now();
      var icons = [
        { type: 'news',        icon: '&#128240;', label: 'News' },
        { type: 'job_posting', icon: '&#128188;', label: 'Jobs' },
        { type: 'pricing',     icon: '&#128176;', label: 'Pricing' },
        { type: 'web_page',    icon: '&#127760;', label: 'Web' },
        { type: 'app_review',  icon: '&#11088;',  label: 'Reviews' },
        { type: 'social',      icon: '&#128172;', label: 'Social' },
        { type: 'trend',       icon: '&#128200;', label: 'Trends' },
      ];
      var byType = {};
      (summary || []).forEach(function(s) { byType[s.signal_type] = s; });
      el.innerHTML = '<div style="display:flex;gap:16px;flex-wrap:wrap;padding:4px 0">' +
        icons.map(function(cfg) {
          var s = byType[cfg.type];
          var color, tip;
          if (!s) {
            color = 'var(--muted)'; tip = 'Never collected';
          } else {
            var daysOld = (now - new Date(s.latest).getTime()) / 86400000;
            if (daysOld <= 14) { color = 'var(--green)'; }
            else if (daysOld <= 60) { color = '#f59e0b'; }
            else { color = 'var(--red)'; }
            tip = s.count + ' signals, last: ' + s.latest.split('T')[0];
          }
          return '<div title="' + cfg.label + ': ' + tip + '" style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:default">' +
            '<span style="font-size:20px;filter:drop-shadow(0 0 4px ' + color + ')">' + cfg.icon + '</span>' +
            '<span style="font-size:9px;color:' + color + ';font-weight:600">' + cfg.label + '</span>' +
            (s ? '<span style="font-size:8px;color:var(--muted)">' + s.count + '</span>' : '<span style="font-size:8px;color:var(--muted)">0</span>') +
            '</div>';
        }).join('') +
        '</div>';
    })
    .catch(function() {
      var el = document.getElementById('comp-coverage-' + comp.id);
      if (el) el.innerHTML = '<div class="empty" style="font-size:11px">Coverage data unavailable</div>';
    });
}

async function loadCompetitorProfile(compId) {
  const el = document.getElementById('comp-profile-content-' + compId);
  if (!el) return;
  try {
    const r = await fetch(BASE+'/api/competitor-profile/' + compId);
    const data = await r.json();
    if (!data.profile) {
      el.innerHTML = '<div style="padding:8px;color:var(--muted);font-size:11px">Profile not yet extracted. Run web scraper first, then click <b>Extract Now</b>.</div>';
      return;
    }
    const p = data.profile;
    const sports = (p.key_sports||[]).join(', ') || 'Unknown';
    const diffs = (p.key_differentiators||[]).map(d => `<span class="badge badge-medium" style="font-size:9px">${_esc(d)}</span>`).join(' ');
    el.innerHTML = `
      <div style="padding:10px">
        <div style="font-size:12px;color:var(--text);margin-bottom:10px;line-height:1.5">${_esc(p.description || '')}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
          <div style="padding:6px 8px;background:rgba(255,255,255,.04);border-radius:4px">
            <div style="font-size:9px;color:var(--muted);margin-bottom:2px">PRICING MODEL</div>
            <div style="font-size:11px;color:var(--text)">${_esc(p.pricing_model||'Unknown')}</div>
            <div style="font-size:9px;color:var(--muted);margin-top:2px">${_esc(p.pricing_details||'')}</div>
          </div>
          <div style="padding:6px 8px;background:rgba(255,255,255,.04);border-radius:4px">
            <div style="font-size:9px;color:var(--muted);margin-bottom:2px">AVAILABILITY</div>
            <div style="font-size:11px;color:var(--text)">${_esc(p.availability||'Unknown')}</div>
          </div>
          <div style="padding:6px 8px;background:rgba(255,255,255,.04);border-radius:4px">
            <div style="font-size:9px;color:var(--muted);margin-bottom:2px">VENUES / COURTS</div>
            <div style="font-size:11px;color:var(--text)">${_esc(p.venue_count||'N/A')}</div>
          </div>
          <div style="padding:6px 8px;background:rgba(255,255,255,.04);border-radius:4px">
            <div style="font-size:9px;color:var(--muted);margin-bottom:2px">FUNDING</div>
            <div style="font-size:11px;color:var(--text)">${_esc(p.funding_stage||'Unknown')}</div>
          </div>
          <div style="padding:6px 8px;background:rgba(255,255,255,.04);border-radius:4px">
            <div style="font-size:9px;color:var(--muted);margin-bottom:2px">FOUNDED</div>
            <div style="font-size:11px;color:var(--text)">${p.founded_year||'?'}</div>
          </div>
          <div style="padding:6px 8px;background:rgba(255,255,255,.04);border-radius:4px">
            <div style="font-size:9px;color:var(--muted);margin-bottom:2px">SPORTS</div>
            <div style="font-size:11px;color:var(--text)">${_esc(sports)}</div>
          </div>
        </div>
        <div style="margin-bottom:8px">${diffs}</div>
        <div style="padding:8px;background:rgba(239,68,68,.08);border-radius:4px;border-left:3px solid rgba(239,68,68,.4)">
          <span style="font-size:9px;color:#ef4444;font-weight:600">THREAT TO DREAM PLAY: </span>
          <span style="font-size:11px;color:var(--text)">${_esc(p.threat_summary||'')}</span>
        </div>
        <div style="font-size:9px;color:var(--muted);margin-top:6px">Last extracted: ${(toISTDate(data.extracted_at||'')||'Unknown')}</div>
      </div>`;
  } catch(e) {
    if (el) el.innerHTML = '<div style="padding:8px;color:var(--muted);font-size:11px">Could not load profile.</div>';
  }
}

var _trendChartInstances = {};

function _drawTrendChart(canvasId, points, label, color) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (_trendChartInstances[canvasId]) {
    _trendChartInstances[canvasId].destroy();
    delete _trendChartInstances[canvasId];
  }
  if (!points || points.length < 2) {
    canvas.parentElement.innerHTML += '<div style="font-size:10px;color:var(--muted);text-align:center;margin-top:8px">Not enough data yet</div>';
    return;
  }
  var ctx = canvas.getContext('2d');
  _trendChartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: points.map(function(p){ return p.date; }),
      datasets: [{
        label: label,
        data: points.map(function(p){ return p.value; }),
        borderColor: color,
        backgroundColor: color + '22',
        tension: 0.3,
        pointRadius: 3,
        borderWidth: 2,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: '#252b38' } },
        y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: '#252b38' } },
      },
    },
  });
}

function loadTrendCharts(compId) {
  var chartDefs = [
    { route: BASE+'/api/trends/pricing/' + compId, canvasId: 'chart-pricing-' + compId, label: 'Pricing ARPU', color: '#4f8ef7' },
    { route: BASE+'/api/trends/hiring/' + compId,  canvasId: 'chart-hiring-' + compId,  label: 'Hiring Velocity', color: '#3ecf8e' },
    { route: BASE+'/api/trends/ratings/' + compId, canvasId: 'chart-ratings-' + compId, label: 'App Rating',      color: '#f59e0b' },
    { route: BASE+'/api/trends/threat/' + compId,  canvasId: 'chart-threat-' + compId,  label: 'Threat Score',   color: '#e05252' },
  ];
  chartDefs.forEach(function(def) {
    fetch(def.route)
      .then(function(r){ return r.json(); })
      .then(function(points){ _drawTrendChart(def.canvasId, points, def.label, def.color); })
      .catch(function(){});
  });
}

function runProfileExtraction() {
  fetch(BASE+'/api/run-profile-extraction', {method:'POST'})
    .then(r => r.json())
    .then(d => { if (d.ok) alert('Profile extraction started. Refresh competitor detail in a minute.'); })
    .catch(e => console.error(e));
}

// ── Inputs Tab ────────────────────────────────────────────────────────────────
function loadInputsTab() {
  fetch(BASE+'/api/competitors')
    .then(r => r.json())
    .then(data => renderInputsTable(data));
  if (cachedData) {
    const el = document.getElementById('inputs-schedule');
    if (el) el.innerHTML = (cachedData.schedule||[]).map(d =>
      `<div class="schedule-item"><div class="schedule-time">${d.time}</div><div class="schedule-job">${d.job}</div></div>`
    ).join('');
  }
}

function renderInputsTable(comps) {
  const el = document.getElementById('inputs-competitors-table');
  if (!el) return;
  el.innerHTML = `<table class="inputs-comp-table" style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th>Competitor</th><th>Sports</th><th>Tier</th><th>Signals</th><th>Keywords</th><th>Active</th>
    </tr></thead>
    <tbody>
    ${comps.map(c => {
      const sports  = (c.sport||[]).join(', ');
      const tierCls = c.tier === 'direct' ? 'badge-high' : 'badge-medium';
      const active  = c.active !== false;
      const kw = (c.news_keywords||[]).slice(0,2).join(', ') + (c.news_keywords&&c.news_keywords.length>2 ? '...' : '');
      return `<tr>
        <td><div style="font-weight:600">${c.name}</div><div style="font-size:10px;color:var(--muted)">${c.id}</div></td>
        <td style="color:var(--muted);font-size:11px">${sports}</td>
        <td><span class="badge ${tierCls}" style="font-size:9px">${c.tier}</span></td>
        <td style="color:var(--accent);font-weight:600">${c.signal_count}</td>
        <td style="color:var(--muted);font-size:10px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${kw}</td>
        <td><label class="toggle-switch"><input type="checkbox" ${active ? 'checked' : ''} onchange="toggleCompActive('${c.id}',this)"><span class="toggle-slider"></span></label></td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
}

function toggleCompActive(comp_id, checkbox) {
  fetch(BASE+'/api/competitor/' + comp_id + '/toggle', {method: 'POST'})
    .then(r => r.json())
    .then(d => { if (!d.ok) checkbox.checked = !checkbox.checked; });
}

function showAddCompetitorForm() {
  const f = document.getElementById('add-comp-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function submitAddCompetitor() {
  const get = id => document.getElementById(id).value;
  const sport = [];
  ['padel','pickleball','tennis'].forEach(s => {
    if (document.getElementById('sport-' + s).checked) sport.push(s);
  });
  const data = {
    id: get('new-comp-id'), name: get('new-comp-name'), sport,
    tier: get('new-comp-tier'), website: get('new-comp-website'),
    pricing_url: get('new-comp-pricing'), linkedin_company: get('new-comp-linkedin'),
    twitter_handle: get('new-comp-twitter'), news_keywords: get('new-comp-keywords'),
    active: document.getElementById('new-comp-active').checked,
  };
  if (!data.id || !data.name) { alert('ID and Name are required'); return; }
  fetch(BASE+'/api/competitor/add', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data),
  }).then(r => r.json()).then(d => {
    if (d.ok) {
      document.getElementById('add-comp-form').style.display = 'none';
      _allCompetitors = [];
      loadInputsTab();
    } else {
      alert('Error: ' + (d.error||'unknown'));
    }
  });
}

function saveApiKeyFromInputs() {
  const provider = document.getElementById('inputs-key-provider').value;
  const key      = document.getElementById('inputs-key-input').value.trim();
  const status   = document.getElementById('inputs-key-status');
  if (!key) { status.innerHTML = '<span style="color:var(--red)">Please paste a key first.</span>'; return; }
  status.textContent = 'Saving...';
  fetch(BASE+'/api/set-key', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({provider, key})})
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        status.innerHTML = '<span class="key-ok">&#10003; Key saved successfully.</span>';
        document.getElementById('inputs-key-input').value = '';
        setTimeout(loadData, 500);
      } else {
        status.innerHTML = '<span style="color:var(--red)">Error: ' + (d.error||'unknown') + '</span>';
      }
    });
}

// ── Company Context ───────────────────────────────────────────────────────────

function loadContext() {
  fetch(BASE+'/api/settings/company-context')
    .then(function(r){ return r.json(); })
    .then(function(d) {
      var ta = document.getElementById('ctx-textarea');
      if (ta) ta.value = d.context || '';
      updateCtxCharCount();
      var badge = document.getElementById('ctx-custom-badge');
      if (badge) badge.style.display = d.is_custom ? '' : 'none';
      var updEl = document.getElementById('ctx-updated-at');
      if (updEl) updEl.textContent = d.updated_at ? ('Last saved: ' + toIST(d.updated_at)) : 'Using built-in default';
    })
    .catch(function(){});
}

function updateCtxCharCount() {
  var ta = document.getElementById('ctx-textarea');
  var cc = document.getElementById('ctx-char-count');
  if (!ta || !cc) return;
  var n = ta.value.length;
  cc.textContent = n.toLocaleString() + ' / 20,000 chars';
  cc.style.color = n > 18000 ? 'var(--red)' : 'var(--muted)';
}

function saveContext() {
  var ta  = document.getElementById('ctx-textarea');
  var st  = document.getElementById('ctx-status');
  var ctx = (ta ? ta.value : '').trim();
  if (!ctx) { st.innerHTML = '<span style="color:var(--red)">Context cannot be empty.</span>'; return; }
  st.textContent = 'Saving...';
  fetch(BASE+'/api/settings/company-context', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({context: ctx})
  })
  .then(function(r){ return r.json(); })
  .then(function(d) {
    if (d.ok) {
      st.innerHTML = '<span style="color:#22c55e">&#10003; Context saved. Agents will use this on the next run.</span>';
      var badge = document.getElementById('ctx-custom-badge');
      if (badge) badge.style.display = '';
      var updEl = document.getElementById('ctx-updated-at');
      if (updEl && d.updated_at) updEl.textContent = 'Last saved: ' + toIST(d.updated_at);
      setTimeout(function(){ st.textContent = ''; }, 4000);
    } else {
      st.innerHTML = '<span style="color:var(--red)">Error: ' + (d.error || 'unknown') + '</span>';
    }
  })
  .catch(function(){ st.innerHTML = '<span style="color:var(--red)">Network error. Try again.</span>'; });
}

function uploadContextFile(input) {
  var file = input.files[0];
  if (!file) return;
  var st = document.getElementById('ctx-status');
  st.textContent = 'Reading file...';
  var fd = new FormData();
  fd.append('file', file);
  fetch(BASE+'/api/settings/company-context/upload', {method: 'POST', body: fd})
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (d.ok) {
        var ta = document.getElementById('ctx-textarea');
        if (ta) { ta.value = d.extracted_text; updateCtxCharCount(); }
        st.innerHTML = '<span style="color:#22c55e">&#10003; File loaded (' + (d.char_count || 0).toLocaleString() + ' chars). Click Save to apply.</span>';
      } else {
        st.innerHTML = '<span style="color:var(--red)">' + (d.error || 'Upload failed') + '</span>';
      }
    })
    .catch(function(){ st.innerHTML = '<span style="color:var(--red)">Upload error. Try again.</span>'; });
  input.value = '';
}

function resetContext() {
  if (!confirm('Reset to the built-in default context? Your custom text will be removed.')) return;
  var st = document.getElementById('ctx-status');
  fetch(BASE+'/api/settings/company-context/reset', {method: 'POST'})
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (d.ok) {
        loadContext();
        st.innerHTML = '<span style="color:var(--muted)">Reset to default.</span>';
        setTimeout(function(){ st.textContent = ''; }, 3000);
      }
    })
    .catch(function(){});
}

// Wire up char counter
(function() {
  function _wireCtx() {
    var ta = document.getElementById('ctx-textarea');
    if (ta && !ta._ctxWired) {
      ta.addEventListener('input', updateCtxCharCount);
      ta._ctxWired = true;
    }
  }
  document.addEventListener('DOMContentLoaded', _wireCtx);
  setTimeout(_wireCtx, 1000);
})();

// ── Cost Tab ──────────────────────────────────────────────────────────────────
function _drawBarChart(canvasId, labels, datasets) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || canvas.parentElement.offsetWidth || 400;
  canvas.width = W;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!labels || !labels.length) return;
  const allVals = datasets.flatMap(d => d.data);
  const maxVal = Math.max(...allVals, 0.000001);
  const pad = {top: 10, right: 10, bottom: 30, left: 50};
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const barW = Math.max(4, chartW / labels.length - 2);
  // Y axis
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (i / 4) * chartH;
    const v = (maxVal * i / 4);
    ctx.fillText(v < 0.01 ? v.toFixed(5) : '$' + v.toFixed(3), pad.left - 4, y + 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
  }
  // Bars
  datasets.forEach(ds => {
    ctx.fillStyle = ds.color || '#a78bfa';
    labels.forEach((lbl, i) => {
      const val = ds.data[i] || 0;
      const barH = (val / maxVal) * chartH;
      const x = pad.left + i * (chartW / labels.length) + 1;
      const y = pad.top + chartH - barH;
      ctx.fillRect(x, y, barW, barH);
    });
  });
  // X labels
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  const step = Math.ceil(labels.length / 7);
  labels.forEach((lbl, i) => {
    if (i % step === 0) {
      const x = pad.left + i * (chartW / labels.length) + barW / 2 + 1;
      ctx.fillText(lbl, x, H - 6);
    }
  });
}

async function loadCostTab() {
  try {
    const r = await fetch(BASE+'/api/costs');
    const d = await r.json();

    // Stats row
    const statsEl = document.getElementById('cost-stats-row');
    if (statsEl) {
      const fmt = v => v < 0.001 ? '$0.00' : '$' + v.toFixed(4);
      statsEl.innerHTML = [
        {v: fmt(d.grand_total||0), l:'Total All-Time', cls:''},
        {v: fmt(d.this_month||0), l:'This Month', cls:''},
        {v: fmt(d.avg_daily_7d||0), l:'Avg Daily (7d)', cls:'muted'},
      ].map(s => `<div class="stat-card"><div class="stat-value ${s.cls}">${s.v}</div><div class="stat-label">${s.l}</div></div>`).join('');
    }
    // Cost projection
    const projEl = document.getElementById('cost-projection');
    if (projEl) {
      const avgDay = d.avg_daily_7d || 0;
      if (avgDay === 0) {
        projEl.innerHTML = '<span style="color:var(--muted);font-size:12px">Not enough data yet. Run processors to start tracking costs.</span>';
      } else {
        const mo = (avgDay*30).toFixed(4);
        const yr = (avgDay*365).toFixed(2);
        projEl.innerHTML = '<div style="display:flex;gap:28px;flex-wrap:wrap">' +
          '<div><div style="font-size:22px;font-weight:800;color:var(--accent)">$'+mo+'</div><div style="font-size:10px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px">Projected / month</div></div>' +
          '<div><div style="font-size:22px;font-weight:800;color:var(--accent2)">$'+yr+'</div><div style="font-size:10px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:1px">Projected / year</div></div>' +
          '<div style="display:flex;align-items:center"><span style="font-size:10px;color:var(--muted)">Based on 7-day avg of $'+avgDay.toFixed(5)+'/day</span></div>' +
          '</div>';
      }
    }

    // Daily chart
    const chartEl = document.getElementById('cost-chart');
    const emptyEl = document.getElementById('cost-chart-empty');
    if (d.daily && d.daily.length > 0 && chartEl) {
      chartEl.style.display = '';
      if (emptyEl) emptyEl.style.display = 'none';
      const byDay = {};
      d.daily.forEach(row => {
        if (!byDay[row.day]) byDay[row.day] = 0;
        byDay[row.day] += row.cost;
      });
      const days = Object.keys(byDay).sort().slice(-14);
      const vals = days.map(dy => byDay[dy] || 0);
      const lbls = days.map(dy => dy.slice(5));
      setTimeout(() => _drawBarChart('cost-chart', lbls, [{label:'Cost ($)', data: vals, color:'#a78bfa'}]), 50);
    } else if (chartEl) {
      chartEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = '';
    }

    // Provider breakdown
    const provEl = document.getElementById('cost-provider-breakdown');
    if (provEl) {
      if (!d.totals || d.totals.length === 0) {
        provEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">No data yet</div>';
      } else {
        provEl.innerHTML = d.totals.map(t => `
          <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600;color:var(--text)">${t.provider}</span>
              <span style="color:var(--accent);font-size:13px">$${(t.total_cost||0).toFixed(4)}</span>
            </div>
            <div style="font-size:10px;color:var(--muted);margin-top:3px">
              ${(t.total_input||0).toLocaleString()} in + ${(t.total_output||0).toLocaleString()} out tokens &bull; ${t.total_calls} calls
            </div>
          </div>`).join('');
      }
    }

    // Processor table
    const tbody = document.getElementById('cost-proc-tbody');
    const procEmpty = document.getElementById('cost-proc-empty');
    if (tbody) {
      if (!d.by_processor || d.by_processor.length === 0) {
        tbody.innerHTML = '';
        if (procEmpty) procEmpty.style.display = '';
      } else {
        if (procEmpty) procEmpty.style.display = 'none';
        tbody.innerHTML = d.by_processor.map(p => `<tr style="border-bottom:1px solid rgba(255,255,255,.05)">
          <td style="padding:6px 8px">${_procLabel(p.processor_type || 'unknown')}</td>
          <td style="text-align:right;padding:6px 8px;color:var(--muted)">${p.calls}</td>
          <td style="text-align:right;padding:6px 8px;color:var(--muted)">${(p.tokens||0).toLocaleString()}</td>
          <td style="text-align:right;padding:6px 8px;color:var(--accent)">$${(p.cost||0).toFixed(4)}</td>
          <td style="text-align:right;padding:6px 8px;color:var(--muted)">$${(p.avg_cost||0).toFixed(4)}</td>
        </tr>`).join('');
      }
    }
  } catch(e) {
    console.error('Cost tab load error:', e);
  }
}

// ── Run Collector ─────────────────────────────────────────────────────────
let _runActive = false;
let _runEvt    = null;

function runCollector(name) {
  if (_runActive) { alert('A collector is already running. Please wait.'); return; }
  _runActive = true;
  const logWrap   = document.getElementById('run-log');
  const statusBar = document.getElementById('run-status-bar');
  const btn       = document.getElementById('rbtn-' + name);
  logWrap.classList.add('visible');
  logWrap.innerHTML = '';
  statusBar.innerHTML = '<span class="run-spinner"></span>&nbsp;Running <b>' + name + '</b> collector...';
  if (btn) { btn.classList.add('running'); btn.disabled = true; }
  document.querySelectorAll('.run-btn').forEach(b => { if (b !== btn) b.disabled = true; });

  fetch(BASE+'/api/run/' + name, {method:'POST'})
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        statusBar.innerHTML = '&#10060; Error: ' + data.error;
        _runActive = false;
        document.querySelectorAll('.run-btn').forEach(b => { b.disabled = false; b.classList.remove('running'); });
        return;
      }
      if (_runEvt) _runEvt.close();
      _runEvt = new EventSource(BASE+'/api/run-log');
      _runEvt.onmessage = function(e) {
        const line = e.data;
        if (line === '[IDLE]') {
          _runEvt.close();
          _runActive = false;
          statusBar.innerHTML = '&#10003; Done. Signals saved to database.';
          if (btn) { btn.classList.remove('running'); btn.disabled = false; }
          document.querySelectorAll('.run-btn').forEach(b => b.disabled = false);
          setTimeout(loadData, 1500);
          return;
        }
        const div = document.createElement('div');
        const cls = line.startsWith('[START]') ? 'log-line-start'
                  : line.startsWith('[DONE]')  ? 'log-line-done'
                  : line.toLowerCase().includes('error') ? 'log-line-error'
                  : 'log-line-info';
        div.className = cls;
        div.textContent = line;
        logWrap.appendChild(div);
        logWrap.scrollTop = logWrap.scrollHeight;
      };
      _runEvt.onerror = function() {
        _runEvt.close();
        _runActive = false;
        statusBar.innerHTML = '&#10003; Collector finished.';
        if (btn) { btn.classList.remove('running'); btn.disabled = false; }
        document.querySelectorAll('.run-btn').forEach(b => b.disabled = false);
        setTimeout(loadData, 1500);
      };
    })
    .catch(err => {
      statusBar.innerHTML = '&#10060; Request failed: ' + err;
      _runActive = false;
      document.querySelectorAll('.run-btn').forEach(b => { b.disabled = false; b.classList.remove('running'); });
    });
}

// ── EVAL / REVIEW TAB ─────────────────────────────────────────────
var _evalData = null;
var _evalSortMode = 'date';
var _healthLoaded = false;

// ── Review Queue ──────────────────────────────────────────────────
var _reviewQueue = [];
var _reviewIdx = 0;
var _reviewTotal = 0;

function switchReviewSubtab(tab) {
  document.getElementById('review-panel-queue').style.display = tab === 'queue' ? '' : 'none';
  document.getElementById('review-panel-health').style.display = tab === 'health' ? '' : 'none';
  var qBtn = document.getElementById('review-subtab-queue');
  var hBtn = document.getElementById('review-subtab-health');
  qBtn.style.background = tab === 'queue' ? 'var(--accent)' : 'transparent';
  qBtn.style.color = tab === 'queue' ? '#fff' : 'var(--muted)';
  hBtn.style.background = tab === 'health' ? 'var(--accent)' : 'transparent';
  hBtn.style.color = tab === 'health' ? '#fff' : 'var(--muted)';
  if (tab === 'health') loadEvalHealthPanel();
}

function loadEvalTab() {
  loadReviewQueue();
}

function loadReviewQueue() {
  fetch(BASE+'/api/review-queue')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      _reviewQueue = data;
      _reviewIdx = 0;
      _reviewTotal = data.length;
      renderReviewCard();
    })
    .catch(function() {
      document.getElementById('review-queue-container').innerHTML = '<div class="empty">Failed to load queue</div>';
    });
}

function loadEvalHealthPanel() {
  fetch(BASE+'/api/system-health')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      _evalData = data;
      renderEvalFunnel(data.funnel || {});
      renderEvalSources(data.all_sources || data.top_sources || []);
      renderEvalIntelList(data.recent_intel || []);
      var ts = document.getElementById('last-rollup-ts');
      if (ts && data.last_rollup) ts.textContent = 'Last rollup: ' + data.last_rollup;
    });
}

function renderReviewCard() {
  var el = document.getElementById('review-queue-container');
  if (!el) return;

  if (_reviewQueue.length === 0) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:48px">' +
      '<div style="font-size:40px;margin-bottom:12px">&#10003;</div>' +
      '<div style="font-size:16px;font-weight:700;color:var(--green);margin-bottom:8px">Queue empty</div>' +
      '<div style="font-size:12px;color:var(--muted)">All intelligence items have been reviewed.</div>' +
      '</div>';
    return;
  }

  var item = _reviewQueue[_reviewIdx];
  if (!item) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:48px">' +
      '<div style="font-size:40px;margin-bottom:12px">&#10003;</div>' +
      '<div style="font-size:16px;font-weight:700;color:var(--green);margin-bottom:8px">All done!</div>' +
      '<div style="font-size:12px;color:var(--muted)">You reviewed ' + _reviewTotal + ' items this session.</div>' +
      '<button onclick="loadReviewQueue()" style="margin-top:16px;background:var(--accent);color:#fff;border:none;padding:8px 20px;border-radius:8px;font-size:12px;cursor:pointer">Reload Queue</button>' +
      '</div>';
    return;
  }

  var reviewed = _reviewIdx;
  var total = _reviewTotal;
  var pct = total > 0 ? Math.round(reviewed / total * 100) : 0;

  var evalNotes = {};
  try { evalNotes = JSON.parse(item.eval_notes || '{}'); } catch(e) {}
  var confScore = item.confidence_score !== null && item.confidence_score !== undefined ? Number(item.confidence_score) : null;
  var confColor = confScore === null ? 'var(--muted)' : (confScore >= 7 ? 'var(--green)' : (confScore >= 4 ? '#f59e0b' : 'var(--red)'));

  var analysis = {};
  try { analysis = JSON.parse(item.analysis_json || '{}'); } catch(e) {}
  var summaryText = item.summary || analysis.summary || analysis.top_insight || analysis.narrative_summary || 'No summary available.';

  var processorLabel = {
    'hiring_signals': '&#128188; Hiring Analysis',
    'feature_gap': '&#127760; Feature Gap',
    'pricing': '&#128176; Pricing',
    'news_digest': '&#128240; News Digest',
    'review_sentiment': '&#11088; App Reviews',
    'narrative': '&#128172; Narrative'
  }[item.processor_type] || item.processor_type;

  var dateStr = item.created_at ? item.created_at.split('T')[0] : '';

  var reasonBtns = ['Too generic', 'Already known', 'Wrong competitor', 'Not actionable', 'Field service role'].map(function(r) {
    return '<button onclick="reviewAction(' + item.id + ', -1, &apos;' + r + '&apos;)" style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:var(--red);cursor:pointer">' + r + '</button>';
  }).join('');

  el.innerHTML =
    '<div style="margin-bottom:12px">' +
    '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
    '    <span style="font-size:12px;font-weight:700;color:var(--muted)">' + reviewed + ' / ' + total + ' reviewed</span>' +
    '    <button onclick="skipAllReviews()" style="font-size:10px;color:var(--muted);background:none;border:none;cursor:pointer;text-decoration:underline">Skip all &rsaquo;</button>' +
    '  </div>' +
    '  <div style="background:var(--border);border-radius:4px;height:6px"><div style="background:var(--accent);height:6px;border-radius:4px;width:' + pct + '%"></div></div>' +
    '</div>' +
    '<div class="card" style="padding:24px">' +
    '  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">' +
    '    <div style="font-size:15px;font-weight:700;color:var(--text)">' + (item.competitor_name || item.competitor_id).toUpperCase() + '</div>' +
    '    <div style="font-size:11px;color:var(--muted)">&middot;</div>' +
    '    <div style="font-size:12px;color:var(--muted)">' + processorLabel + '</div>' +
    '    <div style="font-size:11px;color:var(--muted)">&middot;</div>' +
    '    <div style="font-size:11px;color:var(--muted)">' + dateStr + '</div>' +
    '  </div>' +
    (confScore !== null ?
    '  <div style="display:flex;gap:16px;margin-bottom:14px;font-size:11px">' +
    '    <span>Confidence: <b style="color:' + confColor + '">' + confScore.toFixed(1) + ' / 10</b></span>' +
    (evalNotes.specificity !== undefined ? '<span>Spec: <b>' + evalNotes.specificity + '</b></span>' : '') +
    (evalNotes.novelty_vs_prior !== undefined ? '<span>Nov: <b>' + evalNotes.novelty_vs_prior + '</b></span>' : '') +
    (evalNotes.actionability !== undefined ? '<span>Act: <b>' + evalNotes.actionability + '</b></span>' : '') +
    '  </div>' : '') +
    '  <div style="background:var(--bg);border-radius:10px;padding:14px 16px;margin-bottom:14px;font-size:13px;color:var(--text);line-height:1.6">' +
    '    ' + _esc(String(summaryText)) +
    '  </div>' +
    (evalNotes.reasoning ?
    '  <div style="font-size:11px;color:var(--muted);font-style:italic;margin-bottom:16px;padding:0 4px">' +
    '    Eval: ' + _esc(String(evalNotes.reasoning)) +
    '  </div>' : '') +
    '  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
    '    <button onclick="reviewAction(' + item.id + ', 1, null)" style="background:rgba(16,185,129,.12);border:2px solid rgba(16,185,129,.3);color:var(--green);padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">&#128077; Relevant</button>' +
    '    <button onclick="showReasonPicker(' + item.id + ')" style="background:rgba(239,68,68,.08);border:2px solid rgba(239,68,68,.25);color:var(--red);padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">&#128078; Not Relevant</button>' +
    '    <button onclick="reviewSkip(' + item.id + ')" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:10px 18px;border-radius:10px;font-size:12px;cursor:pointer">&rarr; Skip</button>' +
    '    <span style="font-size:10px;color:var(--muted);margin-left:4px">Keyboard: Y / N / Space</span>' +
    '  </div>' +
    '  <div id="reason-picker-' + item.id + '" style="display:none;margin-top:12px;padding:12px;background:rgba(239,68,68,.05);border-radius:8px;border:1px solid rgba(239,68,68,.2)">' +
    '    <div style="font-size:11px;color:var(--red);font-weight:700;margin-bottom:8px">Why not relevant?</div>' +
    '    <div style="display:flex;gap:6px;flex-wrap:wrap">' + reasonBtns + '</div>' +
    '  </div>' +
    '</div>';

  document.onkeydown = function(e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (e.key === 'y' || e.key === 'Y') reviewAction(item.id, 1, null);
    else if (e.key === 'n' || e.key === 'N') showReasonPicker(item.id);
    else if (e.key === ' ') { e.preventDefault(); reviewSkip(item.id); }
  };
}

function showReasonPicker(intelId) {
  var picker = document.getElementById('reason-picker-' + intelId);
  if (picker) picker.style.display = '';
}

function reviewAction(intelId, feedback, reason) {
  fetch(BASE+'/api/intelligence/' + intelId + '/feedback', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({feedback: feedback, reason: reason})
  }).then(function() {
    _reviewIdx++;
    renderReviewCard();
  }).catch(function() {
    _reviewIdx++;
    renderReviewCard();
  });
}

function reviewSkip(intelId) {
  fetch(BASE+'/api/intelligence/' + intelId + '/skip', {method: 'POST'})
    .catch(function(){})
    .finally(function() {
      _reviewIdx++;
      renderReviewCard();
    });
}

function skipAllReviews() {
  if (!confirm('Mark all remaining items as reviewed without recording feedback?')) return;
  fetch(BASE+'/api/review-queue/skip-all', {method: 'POST'})
    .then(function() { loadReviewQueue(); });
}

function renderEvalFunnel(funnel) {
  var el = document.getElementById('eval-funnel-content');
  if (!el) return;
  if (!funnel || !funnel.collected) {
    el.innerHTML = '<span style="color:var(--muted);font-size:12px">No data yet \u2014 collect and process signals first.</span>';
    return;
  }
  var stages = [
    {label: 'Collected', val: funnel.collected, color: '#6ee7b7'},
    {label: 'Quality Filtered', val: funnel.quality_filtered, color: '#fcd34d', note: 'skipped pre-LLM'},
    {label: 'Processed', val: funnel.processed, color: '#93c5fd'},
    {label: 'Eval-Scored', val: funnel.eval_scored, color: '#c4b5fd'},
    {label: 'Useful', val: funnel.useful, color: '#6ee7b7'},
  ];
  var html = '';
  stages.forEach(function(s, i) {
    html += '<div style="display:flex;flex-direction:column;align-items:center;min-width:90px">';
    html += '<div style="font-size:22px;font-weight:800;color:' + s.color + '">' + (s.val || 0) + '</div>';
    html += '<div style="font-size:10px;color:var(--muted);text-align:center">' + s.label + '</div>';
    if (s.note) html += '<div style="font-size:9px;color:#f87171">' + s.note + '</div>';
    html += '</div>';
    if (i < stages.length - 1) {
      html += '<div style="font-size:18px;color:var(--muted);margin:0 4px;align-self:center">&rarr;</div>';
    }
  });
  // Waste rate
  if (funnel.collected > 0) {
    var wasteRate = Math.round((funnel.quality_filtered || 0) / funnel.collected * 100);
    html += '<div style="margin-left:auto;font-size:11px;color:var(--muted);align-self:center">' + wasteRate + '% filtered before LLM</div>';
  }
  el.innerHTML = html;
}

function renderEvalSources(sources) {
  var el = document.getElementById('eval-sources-content');
  if (!el) return;
  if (!sources || !sources.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--muted)">No source data yet. Run the weekly rollup or wait for Sunday 9pm.</div>';
    return;
  }
  // Dedupe by collector_type (take most recent)
  var seen = {};
  var deduped = [];
  sources.forEach(function(s) {
    if (!seen[s.collector_type]) {
      seen[s.collector_type] = true;
      deduped.push(s);
    }
  });
  var html = '<table style="width:100%;border-collapse:collapse;font-size:11px">';
  html += '<thead><tr style="color:var(--muted)">';
  html += '<th style="text-align:left;padding:4px 6px">Source</th>';
  html += '<th style="text-align:right;padding:4px 6px">Signals</th>';
  html += '<th style="text-align:right;padding:4px 6px">Quality</th>';
  html += '<th style="text-align:right;padding:4px 6px">Eval</th>';
  html += '<th style="text-align:right;padding:4px 6px">+ve%</th>';
  html += '</tr></thead><tbody>';
  deduped.forEach(function(s) {
    var evalScore = s.avg_eval_score;
    var rowColor = evalScore === null ? '' : evalScore >= 7 ? 'rgba(16,185,129,.08)' : evalScore >= 4 ? 'rgba(251,191,36,.08)' : 'rgba(239,68,68,.08)';
    var evalBadge = evalScore === null ? '<span style="color:var(--muted)">-</span>' :
      evalScore >= 7 ? '<span style="color:#10b981;font-weight:700">' + evalScore.toFixed(1) + '</span>' :
      evalScore >= 4 ? '<span style="color:#f59e0b;font-weight:700">' + evalScore.toFixed(1) + '</span>' :
      '<span style="color:#ef4444;font-weight:700">' + evalScore.toFixed(1) + '</span>';
    var qualBadge = s.avg_quality_score ? (s.avg_quality_score >= 0.6 ? '<span style="color:#10b981">' : s.avg_quality_score >= 0.4 ? '<span style="color:#f59e0b">' : '<span style="color:#ef4444">') + s.avg_quality_score.toFixed(2) + '</span>' : '<span style="color:var(--muted)">-</span>';
    html += '<tr style="background:' + rowColor + ';border-bottom:1px solid rgba(255,255,255,.04)">';
    html += '<td style="padding:5px 6px;font-weight:600">' + s.collector_type + '</td>';
    html += '<td style="text-align:right;padding:5px 6px">' + (s.total_signals || 0) + '</td>';
    html += '<td style="text-align:right;padding:5px 6px">' + qualBadge + '</td>';
    html += '<td style="text-align:right;padding:5px 6px">' + evalBadge + '</td>';
    html += '<td style="text-align:right;padding:5px 6px">' + (s.user_positive_pct !== null ? s.user_positive_pct + '%' : '-') + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function sortEvalIntel(mode) {
  _evalSortMode = mode;
  var dateBtn = document.getElementById('sort-date-btn');
  var scoreBtn = document.getElementById('sort-score-btn');
  if (dateBtn) { dateBtn.style.background = mode === 'date' ? 'var(--accent)' : 'transparent'; dateBtn.style.color = mode === 'date' ? '#fff' : 'var(--muted)'; }
  if (scoreBtn) { scoreBtn.style.background = mode === 'score' ? 'var(--accent)' : 'transparent'; scoreBtn.style.color = mode === 'score' ? '#fff' : 'var(--muted)'; }
  if (_evalData) renderEvalIntelList(_evalData.recent_intel || []);
}

function renderEvalIntelList(items) {
  var el = document.getElementById('eval-intel-content');
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--muted)">No evaluated intelligence yet. Run &ldquo;Self-Eval Backfill&rdquo; below.</div>';
    return;
  }
  var sorted = items.slice();
  if (_evalSortMode === 'score') {
    sorted.sort(function(a, b) { return (a.confidence_score || 10) - (b.confidence_score || 10); });
  }
  var html = '';
  sorted.forEach(function(item) {
    var score = item.confidence_score;
    var badgeStyle = score === null ? 'background:rgba(156,163,175,.2);color:var(--muted)' :
      score >= 7 ? 'background:rgba(16,185,129,.2);color:#10b981' :
      score >= 4 ? 'background:rgba(251,191,36,.2);color:#f59e0b' :
      'background:rgba(239,68,68,.2);color:#ef4444';
    var scoreLabel = score !== null ? score.toFixed(1) + '/10' : 'unscored';
    html += '<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">';
    html += '<span style="font-size:11px;font-weight:700;color:var(--text)">' + (item.competitor_id || '') + '</span>';
    html += '<span style="font-size:9px;color:var(--muted)">' + (item.processor_type || '') + '</span>';
    html += '<span style="margin-left:auto;font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;' + badgeStyle + '">' + scoreLabel + '</span>';
    // Thumbs up/down
    html += '<button onclick="sendFeedback(' + item.id + ',1,this)" title="Useful" style="background:none;border:none;font-size:14px;cursor:pointer;padding:0 2px;opacity:.6" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.6">&#128077;</button>';
    html += '<button onclick="sendFeedback(' + item.id + ',-1,this)" title="Not useful" style="background:none;border:none;font-size:14px;cursor:pointer;padding:0 2px;opacity:.6" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.6">&#128078;</button>';
    html += '</div>';
    if (item.reasoning) {
      html += '<div style="font-size:10px;color:var(--muted);line-height:1.5">' + item.reasoning + '</div>';
    }
    html += '</div>';
  });
  el.innerHTML = html;
}

function sortEvalBy(mode) {
  sortEvalIntel(mode);
}

function sendFeedback(intelId, feedback, btn) {
  // Disable both sibling buttons to prevent double submit
  var parent = btn.parentElement;
  var btns = parent.querySelectorAll('button[onclick^="sendFeedback"]');
  btns.forEach(function(b) { b.disabled = true; b.style.opacity = '0.3'; });
  fetch(BASE+'/api/intelligence/' + intelId + '/feedback', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({feedback: feedback})
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    btn.textContent = feedback === 1 ? '\u2705' : '\u274C';
    btn.style.opacity = '1';
  })
  .catch(function() {
    btns.forEach(function(b) { b.disabled = false; b.style.opacity = '0.6'; });
  });
}

function runSelfEval(btn) {
  btn.disabled = true;
  btn.textContent = 'Running...';
  fetch(BASE+'/api/run-self-eval', {method: 'POST'})
    .then(function(r) { return r.json(); })
    .then(function(data) {
      btn.textContent = '\u2713 Queued ' + (data.queued || 0) + ' rows';
      setTimeout(function() {
        btn.textContent = 'Run Self-Eval Backfill';
        btn.disabled = false;
        loadEvalHealthPanel();
      }, 3000);
    })
    .catch(function() {
      btn.textContent = 'Run Self-Eval Backfill';
      btn.disabled = false;
    });
}

function runRollup(btn) {
  btn.disabled = true;
  btn.textContent = 'Computing...';
  fetch(BASE+'/api/run-rollup', {method: 'POST'})
    .then(function(r) { return r.json(); })
    .then(function() {
      btn.textContent = '\u2713 Rollup queued';
      setTimeout(function() {
        btn.textContent = 'Compute Weekly Rollup';
        btn.disabled = false;
        loadEvalHealthPanel();
      }, 4000);
    })
    .catch(function() {
      btn.textContent = 'Compute Weekly Rollup';
      btn.disabled = false;
    });
}

function runProfileExtraction(btn) {
  btn.disabled = true;
  btn.textContent = '\u23F3 Extracting profiles...';
  fetch(BASE+'/api/run-profiles', {method: 'POST'})
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) {
        btn.textContent = '\u26A0 ' + data.error;
        setTimeout(function() {
          btn.textContent = '\U0001F465 Extract All Profiles';
          btn.disabled = false;
        }, 3000);
        return;
      }
      // Switch to collectors tab to show live log
      switchTab('summary');
      // Poll run-status until done, then refresh competitor data
      var poll = setInterval(function() {
        fetch(BASE+'/api/run-status').then(function(r){ return r.json(); }).then(function(d) {
          if (!d.active) {
            clearInterval(poll);
            btn.textContent = '\u2713 Profiles extracted';
            btn.disabled = false;
            // Reload competitor data so profiles appear
            fetch(BASE+'/api/competitors').then(function(r){ return r.json(); }).then(function(d) {
              _allCompetitors = d;
              renderThreatLeaderboard(d);
            });
          }
        });
      }, 3000);
    })
    .catch(function() {
      btn.textContent = '\U0001F465 Extract All Profiles';
      btn.disabled = false;
    });
}

function toggleEditConfig(compId) {
  var el = document.getElementById('edit-config-' + compId);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

function saveCompConfig(compId) {
  var fields = ['website','pricing_url','linkedin_company','twitter_handle','app_store_id','play_store_id'];
  var updates = {};
  fields.forEach(function(f) {
    var el = document.getElementById('cfg-' + compId + '-' + f);
    if (el) updates[f] = el.value.trim();
  });
  fetch(BASE+'/api/competitor/' + compId + '/config', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(updates)
  }).then(function(r) { return r.json(); }).then(function() {
    var s = document.getElementById('cfg-save-status-' + compId);
    if (s) { s.textContent = 'Saved!'; setTimeout(function(){ s.textContent=''; }, 2000); }
  });
}

function saveCompNotes(compId, notes) {
  fetch(BASE+'/api/competitor/' + compId + '/notes', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({notes: notes})
  }).then(function() {
    var s = document.getElementById('notes-status-' + compId);
    if (s) { s.textContent = 'Saved'; setTimeout(function(){ s.textContent=''; }, 1500); }
  });
}
</script>
</body>
</html>"""


@app.route("/")
def index():
    return Response(HTML, mimetype="text/html")


@app.route("/api/system-health")
def api_system_health():
    try:
        from processors.source_performance_rollup import get_health_panel_data
        return jsonify(get_health_panel_data())
    except Exception as e:
        return jsonify({"error": str(e), "top_sources": [], "bottom_sources": [],
                        "waste_rate": 0, "funnel": {}, "all_sources": [], "recent_intel": []})

@app.route("/api/intelligence/<int:intel_id>/feedback", methods=["POST"])
def api_intelligence_feedback(intel_id):
    body = request.get_json(silent=True) or {}
    feedback = body.get("feedback")
    reason = str(body.get("reason", ""))[:200] if body.get("reason") else None
    if feedback not in (1, -1):
        return jsonify({"error": "feedback must be 1 or -1"}), 400
    conn = database.get_connection()
    cursor = conn.execute(
        "INSERT INTO intelligence_feedback (intelligence_id, feedback, reason) VALUES (?, ?, ?) RETURNING id",
        (intel_id, feedback, reason),
    )
    new_id = cursor.fetchone()[0]
    conn.execute(
        "UPDATE processed_intelligence SET reviewed_at = CURRENT_TIMESTAMP WHERE id = ?",
        (intel_id,),
    )
    conn.commit()
    return jsonify({"ok": True, "id": new_id})

@app.route("/api/run-self-eval", methods=["POST"])
def api_run_self_eval():
    import threading
    def _run():
        from processors.self_evaluator import SelfEvaluator
        unscored = database.get_uneval_intelligence(limit=50)
        ids = [r["id"] for r in unscored]
        if ids:
            SelfEvaluator().evaluate_batch(ids)
    unscored_count = len(database.get_uneval_intelligence(limit=50))
    threading.Thread(target=_run, daemon=True).start()
    return jsonify({"ok": True, "queued": unscored_count})

@app.route("/api/run-rollup", methods=["POST"])
def api_run_rollup():
    import threading
    def _run():
        from processors.source_performance_rollup import run_weekly_rollup
        run_weekly_rollup()
    threading.Thread(target=_run, daemon=True).start()
    return jsonify({"ok": True})


@app.route("/api/run-profiles", methods=["POST"])
def api_run_profiles():
    """Run profile extraction for all active competitors. Streams progress via /api/run-log."""
    with _run_lock:
        if _active_proc["proc"] and _active_proc["proc"].poll() is None:
            return jsonify({"error": "A process is already running", "active": _active_proc["name"]}), 409

    proj = _os.path.dirname(_os.path.abspath(__file__))
    py   = _PY
    env  = _os.environ.copy()

    with _run_lock:
        _run_log.clear()
        _run_log.append("[START] Extracting competitor profiles (LLM — competitors with web/pricing signals only)...\n")

    quoted_py = _shlex.quote(py)
    cmd = f'{quoted_py} main.py --run-processor profiles'
    proc = subprocess.Popen(
        ["bash", "-c", cmd],
        cwd=proj, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, text=True, bufsize=1, env=env,
    )
    with _run_lock:
        _active_proc["proc"] = proc
        _active_proc["name"] = "profiles"
    _threading.Thread(target=_stream_proc, args=(proc, "profiles"), daemon=True).start()
    return jsonify({"ok": True})


@app.route("/api/review-queue")
def api_review_queue():
    items = database.get_review_queue(limit=50)
    from config.competitors import COMPETITORS
    all_comps = {**COMPETITORS}
    for item in items:
        cfg = all_comps.get(item["competitor_id"], {})
        item["competitor_name"] = cfg.get("name", item["competitor_id"])
    return jsonify(items)


@app.route("/api/review-queue/skip-all", methods=["POST"])
def api_skip_all_reviews():
    conn = database.get_connection()
    conn.execute("UPDATE processed_intelligence SET reviewed_at = CURRENT_TIMESTAMP WHERE reviewed_at IS NULL")
    conn.commit()
    return jsonify({"ok": True})


@app.route("/api/intelligence/<int:intel_id>/skip", methods=["POST"])
def api_intelligence_skip(intel_id):
    conn = database.get_connection()
    conn.execute("UPDATE processed_intelligence SET reviewed_at = CURRENT_TIMESTAMP WHERE id = ?", (intel_id,))
    conn.commit()
    return jsonify({"ok": True})


@app.route("/api/competitor/<comp_id>/signals-summary")
def api_competitor_signals_summary(comp_id):
    return jsonify(database.get_competitor_signal_summary(comp_id))


@app.route("/api/competitor/<comp_id>/recent-intel")
def api_competitor_recent_intel(comp_id):
    return jsonify(database.get_competitor_recent_intel(comp_id))


@app.route("/api/competitor/<comp_id>/changes")
def api_competitor_changes(comp_id):
    return jsonify(database.get_competitor_changes(comp_id, limit=10))


@app.route("/api/competitor/<comp_id>/notes", methods=["GET", "POST"])
def api_competitor_notes(comp_id):
    import json as _json
    notes_path = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "data", "competitor_notes.json")
    if request.method == "GET":
        try:
            with open(notes_path) as f:
                notes = _json.load(f)
            return jsonify({"notes": notes.get(comp_id, "")})
        except FileNotFoundError:
            return jsonify({"notes": ""})
    else:
        body = request.get_json(silent=True) or {}
        notes_text = str(body.get("notes", ""))[:5000]
        try:
            with open(notes_path) as f:
                notes = _json.load(f)
        except (FileNotFoundError, ValueError):
            notes = {}
        notes[comp_id] = notes_text
        with open(notes_path, "w") as f:
            _json.dump(notes, f, indent=2)
        return jsonify({"ok": True})


@app.route("/api/competitor/<comp_id>/config", methods=["POST"])
def api_competitor_config(comp_id):
    import json as _json
    custom_path = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "data", "competitors_custom.json")
    EDITABLE_FIELDS = {"twitter_handle", "pricing_url", "linkedin_company", "greenhouse_slug", "app_store_id", "play_store_id", "website"}
    body = request.get_json(silent=True) or {}
    updates = {k: v for k, v in body.items() if k in EDITABLE_FIELDS}
    try:
        with open(custom_path) as f:
            custom = _json.load(f)
    except (FileNotFoundError, ValueError):
        custom = {}
    if comp_id not in custom:
        custom[comp_id] = {}
    custom[comp_id].update(updates)
    with open(custom_path, "w") as f:
        _json.dump(custom, f, indent=2)
    return jsonify({"ok": True, "updated": updates})


# ── Trend chart API routes ──────────────────────────────────────────────────

@app.route("/api/trends/pricing/<comp_id>")
def api_trends_pricing(comp_id):
    import json as _json
    with database.get_db() as conn:
        rows = conn.execute(
            "SELECT created_at, analysis_json FROM processed_intelligence "
            "WHERE competitor_id=? AND processor_type='pricing' ORDER BY created_at",
            (comp_id,),
        ).fetchall()
    points = []
    for r in rows:
        try:
            a = _json.loads(r["analysis_json"] or "{}")
            arpu = a.get("estimated_consumer_arpu_monthly") or a.get("estimated_arpu_monthly") or ""
            tiers = a.get("pricing_tiers") or a.get("tiers") or []
            price = None
            if arpu and arpu != "unknown":
                import re as _re
                nums = _re.findall(r"\d+\.?\d*", str(arpu))
                if nums:
                    price = float(nums[0])
            if price is None and tiers:
                t0 = tiers[0]
                raw = t0.get("price_monthly") or t0.get("price") or ""
                import re as _re
                nums = _re.findall(r"\d+\.?\d*", str(raw))
                if nums:
                    price = float(nums[0])
            if price is not None:
                points.append({"date": r["created_at"][:10], "value": price})
        except Exception:
            pass
    return jsonify(points)


@app.route("/api/trends/hiring/<comp_id>")
def api_trends_hiring(comp_id):
    import json as _json
    with database.get_db() as conn:
        rows = conn.execute(
            "SELECT created_at, analysis_json FROM processed_intelligence "
            "WHERE competitor_id=? AND processor_type='hiring_signals' ORDER BY created_at",
            (comp_id,),
        ).fetchall()
    points = []
    for r in rows:
        try:
            a = _json.loads(r["analysis_json"] or "{}")
            infs = a.get("roadmap_inferences") or []
            velocity = a.get("hiring_velocity") or {}
            count = velocity.get("total_new_roles") if isinstance(velocity, dict) else None
            if count is None:
                count = len(infs)
            points.append({"date": r["created_at"][:10], "value": int(count)})
        except Exception:
            pass
    return jsonify(points)


@app.route("/api/trends/ratings/<comp_id>")
def api_trends_ratings(comp_id):
    import json as _json
    with database.get_db() as conn:
        rows = conn.execute(
            "SELECT created_at, analysis_json FROM processed_intelligence "
            "WHERE competitor_id=? AND processor_type='review_sentiment' ORDER BY created_at",
            (comp_id,),
        ).fetchall()
    points = []
    for r in rows:
        try:
            a = _json.loads(r["analysis_json"] or "{}")
            rating = a.get("avg_rating")
            if rating is not None:
                points.append({"date": r["created_at"][:10], "value": float(rating)})
        except Exception:
            pass
    return jsonify(points)


@app.route("/api/trends/threat/<comp_id>")
def api_trends_threat(comp_id):
    with database.get_db() as conn:
        rows = conn.execute(
            "SELECT created_at, confidence_score FROM processed_intelligence "
            "WHERE competitor_id=? AND confidence_score IS NOT NULL ORDER BY created_at",
            (comp_id,),
        ).fetchall()
    return jsonify([{"date": r["created_at"][:10], "value": float(r["confidence_score"])} for r in rows])


# ── Feature comparison matrix ────────────────────────────────────────────────

@app.route("/api/feature-matrix")
def api_feature_matrix():
    import json as _json
    from config.competitors import get_active_competitors
    active = get_active_competitors()
    feature_counts: dict = {}
    competitor_data: list = []
    dream_play_feats: dict = {}

    with database.get_db() as conn:
        for comp_id, cfg in active.items():
            row = conn.execute(
                "SELECT analysis_json FROM processed_intelligence "
                "WHERE competitor_id=? AND processor_type='feature_gap' ORDER BY created_at DESC LIMIT 1",
                (comp_id,),
            ).fetchone()
            if not row:
                continue
            try:
                a = _json.loads(row["analysis_json"] or "{}")
            except Exception:
                continue

            cells: dict = {}
            for feat in (a.get("shared_features") or []):
                f = str(feat).strip()
                if f:
                    cells[f] = "shared"
                    feature_counts[f] = feature_counts.get(f, 0) + 1
            for feat in (a.get("features_only_competitor_has") or []):
                f = str(feat).strip()
                if f:
                    cells[f] = "has"
                    feature_counts[f] = feature_counts.get(f, 0) + 1
            for feat in (a.get("features_only_dream_play_has") or []):
                f = str(feat).strip()
                if f:
                    cells[f] = "lacks"
                    dream_play_feats[f] = "has"

            competitor_data.append({
                "id": comp_id,
                "name": cfg.get("name", comp_id),
                "tier": cfg.get("tier", "unknown"),
                "cells": cells,
            })

    features = sorted(feature_counts.keys(), key=lambda f: feature_counts[f], reverse=True)
    return jsonify({"features": features, "competitors": competitor_data, "dream_play": dream_play_feats})


# ── Exec brief ───────────────────────────────────────────────────────────────

_exec_brief_state = {"status": "idle", "result": None, "error": None}
_exec_brief_lock = _threading.Lock()
_EXEC_BRIEF_CACHE = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "data", "exec_brief_cache.json")


def _generate_exec_brief_bg():
    """Background worker: generates the exec brief via LLM and caches it."""
    import json as _json, datetime as _dt
    try:
        with database.get_db() as conn:
            rows = conn.execute(
                """SELECT competitor_id, processor_type, summary, confidence_score, created_at
                   FROM processed_intelligence
                   WHERE summary IS NOT NULL AND summary != ''
                   ORDER BY created_at DESC LIMIT 30"""
            ).fetchall()

        if not rows:
            result = {"summary": "No intelligence data available yet. Run processors first.",
                      "generated_at": _dt.datetime.utcnow().isoformat()}
            with _exec_brief_lock:
                _exec_brief_state["status"] = "done"
                _exec_brief_state["result"] = result
            return

        intel_text = "\n".join(
            f"- [{r['competitor_id']}] {r['processor_type']}: {r['summary']}"
            for r in rows
        )

        from utils.llm_client import LLMClient
        llm = LLMClient()
        prompt = (
            "You are a competitive intelligence analyst for [Company] "
            "(AI sports video platform for Padel/Pickleball).\n\n"
            "Here is recent competitive intelligence gathered this week:\n\n"
            f"{intel_text[:5000]}\n\n"
            "Write a concise executive brief (max 300 words) covering:\n"
            "1. Top 3 competitor threats right now (be specific: name the competitor and the threat)\n"
            "2. Key pricing or product movements detected\n"
            "3. 3 recommended actions [Company] should take this week\n\n"
            "Format as plain text paragraphs. Be direct and executive-friendly."
        )

        summary = llm.complete(system="You are a competitive intelligence analyst.", user=prompt)
        if isinstance(summary, dict):
            summary = summary.get("summary", str(summary))

        result = {"summary": str(summary), "generated_at": _dt.datetime.utcnow().isoformat()}
        try:
            _os.makedirs(_os.path.dirname(_EXEC_BRIEF_CACHE), exist_ok=True)
            with open(_EXEC_BRIEF_CACHE, "w") as f:
                _json.dump(result, f)
        except Exception:
            pass

        with _exec_brief_lock:
            _exec_brief_state["status"] = "done"
            _exec_brief_state["result"] = result

    except Exception as exc:
        with _exec_brief_lock:
            _exec_brief_state["status"] = "error"
            _exec_brief_state["error"] = str(exc)


@app.route("/api/exec-brief")
def api_exec_brief():
    import json as _json, datetime as _dt
    force = request.args.get("force", "0") in ("1", "true")

    # Check cache (24h TTL) unless force refresh requested
    if not force:
        try:
            with open(_EXEC_BRIEF_CACHE) as f:
                cached = _json.load(f)
            gen_at = _dt.datetime.fromisoformat(cached.get("generated_at", "2000-01-01"))
            if (_dt.datetime.utcnow() - gen_at).total_seconds() < 86400:
                return jsonify(cached)
        except Exception:
            pass

    # Check if already generating
    with _exec_brief_lock:
        if _exec_brief_state["status"] == "generating":
            return jsonify({"status": "generating"})
        if _exec_brief_state["status"] == "done" and _exec_brief_state["result"]:
            result = _exec_brief_state["result"]
            _exec_brief_state["status"] = "idle"
            _exec_brief_state["result"] = None
            return jsonify(result)
        if _exec_brief_state["status"] == "error":
            error = _exec_brief_state["error"]
            _exec_brief_state["status"] = "idle"
            _exec_brief_state["error"] = None
            return jsonify({"summary": f"Could not generate exec brief: {error}",
                            "generated_at": _dt.datetime.utcnow().isoformat()})

    # Start background generation
    with _exec_brief_lock:
        _exec_brief_state["status"] = "generating"
        _exec_brief_state["result"] = None
        _exec_brief_state["error"] = None
    _threading.Thread(target=_generate_exec_brief_bg, daemon=True).start()
    return jsonify({"status": "generating"})


@app.route("/api/exec-brief/invalidate", methods=["POST"])
def api_exec_brief_invalidate():
    try:
        _os.remove(_EXEC_BRIEF_CACHE)
    except FileNotFoundError:
        pass
    with _exec_brief_lock:
        _exec_brief_state["status"] = "idle"
        _exec_brief_state["result"] = None
    return jsonify({"ok": True})


# ── Sales battlecard ─────────────────────────────────────────────────────────

@app.route("/api/battlecard/<comp_id>")
def api_battlecard(comp_id):
    import json as _json
    from config.competitors import COMPETITORS
    cfg = COMPETITORS.get(comp_id, {})

    with database.get_db() as conn:
        def latest(proc_type):
            row = conn.execute(
                "SELECT analysis_json FROM processed_intelligence "
                "WHERE competitor_id=? AND processor_type=? ORDER BY created_at DESC LIMIT 1",
                (comp_id, proc_type),
            ).fetchone()
            if not row:
                return {}
            try:
                return _json.loads(row["analysis_json"] or "{}")
            except Exception:
                return {}

        fg = latest("feature_gap")
        rs = latest("review_sentiment")
        na = latest("narrative")
        pr = latest("pricing")

    tiers = pr.get("pricing_tiers") or pr.get("tiers") or []
    pricing_summary = ""
    if tiers:
        t0 = tiers[0]
        pricing_summary = f"{t0.get('name','?')}: {t0.get('price_monthly','?')}/mo — {t0.get('target_segment','?')}"
    elif pr.get("primary_model"):
        pricing_summary = f"Model: {pr.get('primary_model')} · {pr.get('pricing_vs_dream_play','')}"

    return jsonify({
        "competitor_name": cfg.get("name", comp_id),
        "what_they_do": na.get("their_positioning") or na.get("summary") or "No narrative analysis yet.",
        "pricing_summary": pricing_summary or "No pricing data yet.",
        "their_weaknesses": [p.get("theme", str(p)) for p in (rs.get("pain_points") or [])[:5]],
        "how_to_win": [c.get("counter", str(c)) for c in (na.get("claims_to_counter") or [])[:4]],
        "dream_play_advantages": (fg.get("features_only_dream_play_has") or [])[:8],
    })


# ── Company context (Dreamplay) settings routes ─────────────────────────────

@app.route("/api/settings/company-context", methods=["GET"])
def api_get_company_context():
    meta = database.get_setting_meta("company_context")
    if meta:
        return jsonify({"context": meta["value"], "updated_at": meta["updated_at"], "is_custom": True})
    from config.company_context import DEFAULT_CONTEXT
    return jsonify({"context": DEFAULT_CONTEXT, "updated_at": None, "is_custom": False})


@app.route("/api/settings/company-context", methods=["POST"])
def api_set_company_context():
    body = request.get_json(silent=True) or {}
    ctx = (body.get("context") or "").strip()
    if not ctx:
        return jsonify({"ok": False, "error": "context cannot be empty"}), 400
    if len(ctx) > 20000:
        return jsonify({"ok": False, "error": "context exceeds 20,000 character limit"}), 400
    database.set_setting("company_context", ctx)
    meta = database.get_setting_meta("company_context")
    return jsonify({"ok": True, "updated_at": meta["updated_at"] if meta else None})


@app.route("/api/settings/company-context/upload", methods=["POST"])
def api_upload_company_context():
    import os as _os2
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "No file provided"}), 400
    f = request.files["file"]
    filename = (f.filename or "").lower()
    _ALLOWED = (".txt", ".md", ".pdf", ".doc", ".docx")
    if not any(filename.endswith(ext) for ext in _ALLOWED):
        return jsonify({"ok": False, "error": "Supported formats: .txt, .md, .pdf, .docx"}), 400

    if filename.endswith(".pdf"):
        try:
            import pypdf
            reader = pypdf.PdfReader(f)
            pages_text = [page.extract_text() or "" for page in reader.pages]
            text = "\n\n".join(p.strip() for p in pages_text if p.strip())
        except ImportError:
            return jsonify({
                "ok": False,
                "error": "pypdf is not installed. Run: pip install pypdf. Or upload a .txt, .md, or .docx file instead."
            }), 400
        except Exception as e:
            return jsonify({"ok": False, "error": f"Could not read PDF: {e}"}), 400

    elif filename.endswith(".docx") or filename.endswith(".doc"):
        try:
            import docx as _docx
            import io
            doc = _docx.Document(io.BytesIO(f.read()))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            text = "\n\n".join(paragraphs)
        except ImportError:
            return jsonify({
                "ok": False,
                "error": "python-docx is not installed. Run: pip install python-docx"
            }), 400
        except Exception as e:
            return jsonify({"ok": False, "error": f"Could not read Word document: {e}"}), 400

    else:
        try:
            text = f.read().decode("utf-8")
        except UnicodeDecodeError:
            return jsonify({"ok": False, "error": "File must be UTF-8 encoded text"}), 400

    text = text.strip()
    if not text:
        return jsonify({"ok": False, "error": "File appears to be empty"}), 400
    if len(text) > 20000:
        text = text[:20000]

    return jsonify({"ok": True, "extracted_text": text, "char_count": len(text)})


@app.route("/api/settings/company-context/reset", methods=["POST"])
def api_reset_company_context():
    """Remove the custom context, reverting to the built-in default."""
    with database.get_db() as conn:
        conn.execute("DELETE FROM app_settings WHERE key='company_context'")
    return jsonify({"ok": True})


if __name__ == "__main__":
    import webbrowser, threading, time
    def open_browser():
        time.sleep(0.8)
        webbrowser.open("http://localhost:5050")
    threading.Thread(target=open_browser, daemon=True).start()
    print("[Company] CI Bot Dashboard running at http://localhost:5050")
    print("Press Ctrl+C to stop.")
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port, debug=False)
