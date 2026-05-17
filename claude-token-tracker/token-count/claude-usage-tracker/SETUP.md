# Setup — Claude Usage Tracker

## Option 1: Let Claude Code set it up (recommended)

1. Unzip the folder
2. Open it in Claude Code: `claude /path/to/claude-usage-tracker`
3. Paste the prompt below and press Enter

---

### Claude Code setup prompt

```
I have the Claude Usage Tracker app in this folder. It's a macOS menubar app (Electron) that reads the JSONL files written by Claude Code and Cowork to show live token usage, cost, and session breakdowns.

Please do the following:
1. Run `npm install` to install dependencies
2. Run `npm start` to launch the app
3. Confirm the app icon appears in the menu bar and the dashboard opens correctly
4. If anything fails, diagnose and fix it

No proxy or system configuration is needed. The app reads data directly from:
- ~/.claude/projects/ (Claude Code sessions)
- ~/Library/Application Support/Claude/local-agent-mode-sessions/ (Cowork sessions)

Let me know when it's running.
```

---

## Option 2: Manual setup

```bash
# 1. Install dependencies
npm install

# 2. Start the app
npm start
```

The app icon will appear in your macOS menu bar. Click it to open the dashboard or see today's cost inline.

To have it start automatically at login, add it as a Login Item in System Settings > General > Login Items.

---

## What you'll see

- **Menu bar**: live cost and token count, updates every 5 seconds
- **Dashboard**: daily/weekly/monthly totals, 7-day charts, per-session breakdown
- **Sessions tab**: every Claude Code and Cowork session with full token breakdown, cache stats, and tools used
- **Pricing banner**: appears automatically if Anthropic changes their rates (checked weekly)

---

## Requirements

- macOS (tested on Sonoma and Sequoia)
- Node.js v18 or later (`node --version` to check)
