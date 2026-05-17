"""
[Company] CI Bot — Live Terminal Dashboard
Run with: python dashboard.py

Shows:
- Live DB stats (signals, changes, PRDs)
- Per-competitor signal counts and threat levels
- Recent changes detected
- Recent PRDs generated
- Scheduler next-run times
- Recent log tail
"""

import json
import time
from datetime import datetime
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.columns import Columns
from rich.layout import Layout
from rich.live import Live
from rich.text import Text
from rich.rule import Rule
from rich import box
from rich.padding import Padding


console = Console()

SEVERITY_STYLE = {
    "critical": "bold red",
    "high": "bold orange3",
    "medium": "yellow",
    "low": "dim",
}

SEVERITY_EMOJI = {
    "critical": "[red]●[/red]",
    "high": "[orange3]●[/orange3]",
    "medium": "[yellow]●[/yellow]",
    "low": "[dim]●[/dim]",
}


def _get_db_stats() -> dict:
    try:
        from db.database import get_db
        with get_db() as conn:
            total_signals = conn.execute("SELECT COUNT(*) as c FROM raw_signals").fetchone()["c"]
            unprocessed = conn.execute("SELECT COUNT(*) as c FROM raw_signals WHERE processed=0").fetchone()["c"]
            total_changes = conn.execute("SELECT COUNT(*) as c FROM changes").fetchone()["c"]
            unalerted = conn.execute("SELECT COUNT(*) as c FROM changes WHERE alerted=0").fetchone()["c"]
            total_prds = conn.execute("SELECT COUNT(*) as c FROM prds").fetchone()["c"]
            total_intel = conn.execute("SELECT COUNT(*) as c FROM processed_intelligence").fetchone()["c"]
            total_jobs = conn.execute("SELECT COUNT(*) as c FROM jobs_seen").fetchone()["c"]

            signal_by_type = conn.execute("""
                SELECT signal_type, COUNT(*) as cnt
                FROM raw_signals GROUP BY signal_type ORDER BY cnt DESC
            """).fetchall()

            recent_changes = conn.execute("""
                SELECT competitor_id, change_type, severity, diff_summary, detected_at, alerted
                FROM changes ORDER BY detected_at DESC LIMIT 8
            """).fetchall()

            recent_prds = conn.execute("""
                SELECT title, week, priority_score, effort, created_at
                FROM prds ORDER BY created_at DESC LIMIT 6
            """).fetchall()

            competitor_signals = conn.execute("""
                SELECT competitor_id, COUNT(*) as cnt
                FROM raw_signals
                WHERE competitor_id != 'market'
                GROUP BY competitor_id ORDER BY cnt DESC LIMIT 12
            """).fetchall()

            competitor_intel = conn.execute("""
                SELECT competitor_id, processor_type, summary, updated_at
                FROM processed_intelligence
                ORDER BY updated_at DESC LIMIT 10
            """).fetchall()

        return {
            "total_signals": total_signals,
            "unprocessed": unprocessed,
            "total_changes": total_changes,
            "unalerted": unalerted,
            "total_prds": total_prds,
            "total_intel": total_intel,
            "total_jobs": total_jobs,
            "signal_by_type": [dict(r) for r in signal_by_type],
            "recent_changes": [dict(r) for r in recent_changes],
            "recent_prds": [dict(r) for r in recent_prds],
            "competitor_signals": [dict(r) for r in competitor_signals],
            "competitor_intel": [dict(r) for r in competitor_intel],
        }
    except Exception as e:
        return {"error": str(e)}


def _get_scheduler_status() -> list[dict]:
    """Try to read scheduler state from a status file if the scheduler is running."""
    status_file = Path("data/scheduler_status.json")
    if status_file.exists():
        try:
            with status_file.open() as f:
                return json.load(f)
        except Exception:
            pass
    return []


def _get_recent_logs(n: int = 8) -> list[str]:
    log_file = Path("data/ci_bot.log")
    if not log_file.exists():
        return ["No log file found yet."]
    try:
        lines = log_file.read_text(encoding="utf-8").splitlines()
        recent = lines[-n:] if len(lines) >= n else lines
        parsed = []
        for line in recent:
            try:
                entry = json.loads(line)
                level = entry.get("level", "info").upper()
                ts = entry.get("timestamp", "")[:19].replace("T", " ")
                event = entry.get("event", "")
                logger = entry.get("logger", "").split(".")[-1]
                style_map = {"ERROR": "red", "WARNING": "yellow", "INFO": "green", "DEBUG": "dim"}
                style = style_map.get(level, "white")
                parsed.append(f"[dim]{ts}[/dim] [{style}]{level:<7}[/{style}] [{style}]{event}[/{style}] [dim]({logger})[/dim]")
            except Exception:
                parsed.append(f"[dim]{line[:120]}[/dim]")
        return parsed or ["No log entries yet."]
    except Exception:
        return ["Could not read log file."]


def _get_prd_list() -> list[dict]:
    try:
        from db.database import get_db
        with get_db() as conn:
            rows = conn.execute("""
                SELECT title, week, priority_score, effort, concept_summary, file_path, created_at
                FROM prds ORDER BY created_at DESC
            """).fetchall()
            return [dict(r) for r in rows]
    except Exception:
        return []


def build_header() -> Panel:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")
    text = Text(justify="center")
    text.append("[Company] CI Bot", style="bold white")
    text.append("  |  ", style="dim")
    text.append("Competitive Intelligence Dashboard", style="bold cyan")
    text.append(f"  |  {now}", style="dim")
    return Panel(text, box=box.HEAVY_HEAD, style="bold blue")


def build_stats_row(stats: dict) -> Columns:
    def stat_panel(label: str, value: str, style: str = "white", subtitle: str = "") -> Panel:
        t = Text(justify="center")
        t.append(value, style=f"bold {style}")
        if subtitle:
            t.append(f"\n{subtitle}", style="dim")
        return Panel(t, title=f"[dim]{label}[/dim]", box=box.ROUNDED, padding=(0, 1))

    unproc = stats.get("unprocessed", 0)
    unalerted = stats.get("unalerted", 0)
    return Columns([
        stat_panel("Total Signals", str(stats.get("total_signals", 0)), "cyan"),
        stat_panel("Unprocessed", str(unproc), "yellow" if unproc > 0 else "green", "need LLM run"),
        stat_panel("Changes Found", str(stats.get("total_changes", 0)), "white"),
        stat_panel("Pending Alerts", str(unalerted), "red" if unalerted > 0 else "green"),
        stat_panel("PRDs Generated", str(stats.get("total_prds", 0)), "magenta"),
        stat_panel("Intel Reports", str(stats.get("total_intel", 0)), "blue"),
        stat_panel("Jobs Tracked", str(stats.get("total_jobs", 0)), "white"),
    ], equal=True)


def build_signals_table(stats: dict) -> Table:
    table = Table(
        title="[bold]Signals by Type[/bold]",
        box=box.SIMPLE_HEAVY,
        show_header=True,
        header_style="bold cyan",
        min_width=28,
    )
    table.add_column("Type", style="white")
    table.add_column("Count", justify="right", style="bold cyan")
    table.add_column("Bar", style="green")

    signal_by_type = stats.get("signal_by_type", [])
    max_cnt = max((s["cnt"] for s in signal_by_type), default=1)
    for s in signal_by_type:
        bar_len = int(s["cnt"] / max_cnt * 12)
        bar = "█" * bar_len + "░" * (12 - bar_len)
        table.add_row(s["signal_type"], str(s["cnt"]), f"[green]{bar}[/green]")

    return table


def build_competitor_table(stats: dict) -> Table:
    table = Table(
        title="[bold]Top Competitors by Signal Volume[/bold]",
        box=box.SIMPLE_HEAVY,
        show_header=True,
        header_style="bold cyan",
        min_width=38,
    )
    table.add_column("Competitor", style="white")
    table.add_column("Signals", justify="right", style="cyan")
    table.add_column("Latest Intel", style="dim", max_width=30)

    # Build a quick lookup of latest intel per competitor
    intel_map: dict[str, str] = {}
    for i in stats.get("competitor_intel", []):
        if i["competitor_id"] not in intel_map:
            intel_map[i["competitor_id"]] = i.get("summary", "")[:30] or i["processor_type"]

    from config.competitors import COMPETITORS
    for row in stats.get("competitor_signals", []):
        cid = row["competitor_id"]
        name = COMPETITORS.get(cid, {}).get("name", cid)
        intel = intel_map.get(cid, "[dim]none yet[/dim]")
        table.add_row(name, str(row["cnt"]), intel)

    return table


def build_changes_table(stats: dict) -> Table:
    table = Table(
        title="[bold]Recent Changes Detected[/bold]",
        box=box.SIMPLE_HEAVY,
        show_header=True,
        header_style="bold cyan",
    )
    table.add_column("", width=2)
    table.add_column("Competitor", style="white", min_width=14)
    table.add_column("Type", style="dim")
    table.add_column("Summary", style="white", max_width=45)
    table.add_column("When", style="dim", min_width=10)

    from config.competitors import COMPETITORS
    changes = stats.get("recent_changes", [])
    if not changes:
        table.add_row("", "[dim]No changes detected yet[/dim]", "", "", "")
    for c in changes:
        cid = c["competitor_id"]
        name = COMPETITORS.get(cid, {}).get("name", cid)
        emoji = SEVERITY_EMOJI.get(c["severity"], "●")
        alerted_mark = "" if c["alerted"] else " [yellow]*[/yellow]"
        detected = (c.get("detected_at") or "")[:10]
        summary = (c.get("diff_summary") or "")[:45]
        table.add_row(emoji, name + alerted_mark, c["change_type"], summary, detected)

    return table


def build_prds_table(stats: dict) -> Table:
    table = Table(
        title="[bold]Generated PRDs[/bold]",
        box=box.SIMPLE_HEAVY,
        show_header=True,
        header_style="bold cyan",
    )
    table.add_column("Title", style="white", max_width=38)
    table.add_column("Week", style="dim")
    table.add_column("P", justify="center", style="bold magenta")
    table.add_column("E", justify="center", style="cyan")

    prds = stats.get("recent_prds", [])
    if not prds:
        table.add_row("[dim]No PRDs yet. Run --run-trend-analysis[/dim]", "", "", "")
    for p in prds:
        priority = str(int(p["priority_score"])) if p.get("priority_score") else "?"
        table.add_row(
            (p.get("title") or "?")[:38],
            p.get("week", "?"),
            priority,
            p.get("effort", "?"),
        )
    return table


def build_log_panel(log_lines: list[str]) -> Panel:
    text = Text()
    for line in log_lines:
        text.append_text(Text.from_markup(line + "\n"))
    return Panel(text, title="[dim]Recent Activity Log[/dim]", box=box.SIMPLE_HEAVY, padding=(0, 1))


def build_schedule_panel() -> Panel:
    schedule = [
        ("Daily 6:00am",  "News collection"),
        ("Daily 6:30am",  "App reviews"),
        ("Daily 7:00am",  "Social signals (Reddit)"),
        ("Daily 8:00am",  "Job postings"),
        ("Daily 9:30am",  "Change detection + alerts"),
        ("Mon/Thu 3am",   "Web scrape (Playwright)"),
        ("Mon/Thu 4am",   "Pricing scrape"),
        ("Tue/Fri 5am",   "Trend research"),
        ("Sun 10pm",      "Trend analysis + PRDs"),
        ("Mon 11am",      "Weekly CI brief → Slack"),
        ("Fri 3pm",       "Battle card refresh"),
    ]
    lines = []
    for time_str, job in schedule:
        lines.append(f"[dim]{time_str:<16}[/dim] [white]{job}[/white]")
    return Panel(
        "\n".join(lines),
        title="[dim]Schedule (IST)[/dim]",
        box=box.SIMPLE_HEAVY,
        padding=(0, 1),
    )


def build_prd_detail_panel() -> Panel:
    """Show full PRD list from disk files."""
    prds_dir = Path("data/prds")
    if not prds_dir.exists():
        return Panel("[dim]No PRDs generated yet.[/dim]", title="[bold magenta]PRD Library[/bold magenta]")

    lines = []
    prd_files = sorted(prds_dir.rglob("*.md"), reverse=True)

    if not prd_files:
        lines.append("[dim]No PRD files found. Run: python main.py --run-trend-analysis[/dim]")
    else:
        for f in prd_files[:10]:
            week = f.parent.name
            title = f.stem.replace("-", " ").title()
            size = f.stat().st_size
            lines.append(f"[magenta]{week}[/magenta]  [white]{title:<40}[/white]  [dim]{size}b[/dim]")

    return Panel(
        "\n".join(lines) or "[dim]None yet[/dim]",
        title=f"[bold magenta]PRD Library ({len(prd_files)} files)[/bold magenta]",
        box=box.SIMPLE_HEAVY,
        padding=(0, 1),
    )


def build_output_locations() -> Panel:
    db_size = "N/A"
    db_path = Path("data/ci_bot.db")
    if db_path.exists():
        db_size = f"{db_path.stat().st_size / 1024:.1f}KB"

    log_size = "N/A"
    log_path = Path("data/ci_bot.log")
    if log_path.exists():
        log_size = f"{log_path.stat().st_size / 1024:.1f}KB"

    prd_count = len(list(Path("data/prds").rglob("*.md"))) if Path("data/prds").exists() else 0
    snap_count = len(list(Path("data/snapshots").rglob("*.json"))) if Path("data/snapshots").exists() else 0

    lines = [
        f"[dim]Database[/dim]      [cyan]data/ci_bot.db[/cyan]       [dim]{db_size}[/dim]",
        f"[dim]Logs[/dim]          [cyan]data/ci_bot.log[/cyan]      [dim]{log_size}[/dim]",
        f"[dim]PRDs[/dim]          [magenta]data/prds/YYYY-WW/*.md[/magenta]  [dim]{prd_count} files[/dim]",
        f"[dim]Snapshots[/dim]     [dim]data/snapshots/[/dim]        [dim]{snap_count} files[/dim]",
        "",
        "[dim]Slack outputs:[/dim]",
        "  [green]#competitive-intel[/green]   Weekly CI brief",
        "  [green]#ci-alerts[/green]           Critical/high changes",
        "  [green]#ci-prds[/green]             Weekly PRD summaries",
    ]
    return Panel(
        "\n".join(lines),
        title="[dim]Output Locations[/dim]",
        box=box.SIMPLE_HEAVY,
        padding=(0, 1),
    )


def render_dashboard(stats: dict, log_lines: list[str]) -> Layout:
    layout = Layout()

    layout.split_column(
        Layout(name="header", size=3),
        Layout(name="stats", size=6),
        Layout(name="main"),
        Layout(name="bottom"),
        Layout(name="footer"),
    )

    layout["header"].update(build_header())
    layout["stats"].update(build_stats_row(stats))

    layout["main"].split_row(
        Layout(name="left"),
        Layout(name="right"),
    )

    layout["main"]["left"].split_column(
        Layout(build_signals_table(stats), name="sig_type"),
        Layout(build_competitor_table(stats), name="competitors"),
    )

    layout["main"]["right"].split_column(
        Layout(build_changes_table(stats), name="changes"),
        Layout(build_prds_table(stats), name="prds"),
    )

    layout["bottom"].split_row(
        Layout(build_schedule_panel(), name="schedule"),
        Layout(build_output_locations(), name="outputs"),
        Layout(build_prd_detail_panel(), name="prd_files"),
    )

    layout["footer"].update(build_log_panel(log_lines))

    return layout


def run_dashboard(refresh_seconds: int = 10):
    """Run the live dashboard with auto-refresh."""
    console.clear()

    with Live(console=console, refresh_per_second=1, screen=True) as live:
        while True:
            try:
                stats = _get_db_stats()
                log_lines = _get_recent_logs(6)

                if "error" in stats:
                    live.update(Panel(
                        f"[red]DB Error: {stats['error']}[/red]\n"
                        "Run [bold]python main.py --init-db[/bold] first.",
                        title="Dashboard Error",
                    ))
                else:
                    layout = render_dashboard(stats, log_lines)
                    live.update(layout)

                time.sleep(refresh_seconds)

            except KeyboardInterrupt:
                break
            except Exception as e:
                live.update(Panel(f"[red]Dashboard error: {e}[/red]"))
                time.sleep(5)

    console.print("\n[dim]Dashboard closed.[/dim]")


def run_static_snapshot():
    """Print a single static snapshot (no live refresh)."""
    stats = _get_db_stats()
    log_lines = _get_recent_logs(8)

    if "error" in stats:
        console.print(Panel(f"[red]DB Error: {stats['error']}[/red]\nRun python main.py --init-db first."))
        return

    console.print(build_header())
    console.print()
    console.print(build_stats_row(stats))
    console.print()

    console.print(Columns([
        build_signals_table(stats),
        build_competitor_table(stats),
    ]))
    console.print()

    console.print(build_changes_table(stats))
    console.print()

    console.print(Columns([
        build_prds_table(stats),
        build_prd_detail_panel(),
    ]))
    console.print()

    console.print(Columns([
        build_schedule_panel(),
        build_output_locations(),
    ]))
    console.print()

    console.print(build_log_panel(log_lines))


if __name__ == "__main__":
    import sys
    if "--snapshot" in sys.argv or "--once" in sys.argv:
        run_static_snapshot()
    else:
        refresh = 10
        for arg in sys.argv[1:]:
            if arg.startswith("--refresh="):
                try:
                    refresh = int(arg.split("=")[1])
                except ValueError:
                    pass
        console.print(f"[dim]Starting live dashboard (refresh every {refresh}s). Press Ctrl+C to exit.[/dim]")
        time.sleep(0.5)
        run_dashboard(refresh_seconds=refresh)
