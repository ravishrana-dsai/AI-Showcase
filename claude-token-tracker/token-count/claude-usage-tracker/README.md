# Claude Usage Tracker

A macOS menubar app that tracks Claude token usage and cost across **Claude Code** and **Cowork** sessions in real time.

- Live cost and token count in the menu bar
- Daily, weekly, and monthly summaries
- Per-session breakdown with cache hit rates and tools used
- Weekly pricing check against the latest Anthropic rates

---

## Requirements

- macOS
- Node.js v18 or later

---

## Setup

The fastest way is to open the folder in **Claude Code** and paste the prompt from `SETUP.md`. Claude Code will handle everything.

Or run manually:

```bash
npm install
npm start
```

The app icon appears in your menu bar. Click it to open the dashboard.

---

## What it tracks

| Source | How |
|---|---|
| Claude Code | Reads JSONL files from `~/.claude/projects/` |
| Cowork | Reads JSONL files from `~/Library/Application Support/Claude/local-agent-mode-sessions/` |

No network proxy or system configuration needed.

---

## Pricing

Rates are bundled in `src/pricing.js`. The app checks [LiteLLM's pricing registry](https://github.com/BerriAI/litellm) weekly and shows a banner in the dashboard if any rates have changed. You decide whether to apply the update.
