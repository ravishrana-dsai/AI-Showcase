# Claude Token Tracker

> Two complementary tools for tracking and visualizing Claude API token usage and cost: a menubar Electron app that intercepts API calls system-wide, and a Next.js dashboard that tracks cost per business unit (e.g., cost per match, cost per report).

## AI Stack

| Component | Technology |
|---|---|
| API call interception | HTTPS proxy (Electron + node-forge) |
| Cost analytics | SQLite (better-sqlite3) |
| Cost per feature tracking | Google Gemini API (demo calls) |
| Dashboard | Next.js 16 + Tailwind CSS |

## Key Achievements

### token-count (Electron menubar app)
- Intercepts all Claude API calls system-wide via a local HTTPS proxy, no code changes required in any project
- Tracks token usage, cost, and request metadata across every product and API key simultaneously
- Lives in the macOS menubar: always visible, zero friction

### token-sense (Next.js dashboard)
- Tracks cost per business unit, not just per API key. Answers: what does one match cost us in AI? What does one report generation cost?
- Business unit cost metric is the critical metric for AI product pricing decisions
- Auto-refreshing dashboard (30-second intervals) with spend breakdown by feature, by provider, and by custom dimension
- Flags anomalous API calls in a dedicated calls table with the specific issue highlighted
- Live demo mode: one-click demo buttons fire real Gemini API calls and populate the dashboard instantly

## Structure

```
claude-token-tracker/
  token-count/       # Electron menubar app (system-wide API interception)
  token-sense/       # Next.js cost-per-unit analytics dashboard
```

## Tech Stack

- **token-count:** Electron, node-forge (HTTPS proxy), fs-extra
- **token-sense:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, SQLite (better-sqlite3), Google Gemini API

## How to Run

### token-count (Electron app)

```bash
cd token-count/claude-usage-tracker
npm install
npm start
```

### token-sense (Dashboard)

```bash
cd token-sense/tokensense
npm install
npm run dev
```

Open http://localhost:1010.
