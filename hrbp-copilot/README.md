# HRBP AI Copilot

> Paste employee 1:1 meeting notes and get a structured HRBP analysis: sentiment, concern level, risk flags, pattern tracking across sessions, and a running memory card per employee, all powered by Claude.

## AI Stack

| Component | Technology |
|---|---|
| Meeting analysis + report generation | Claude Sonnet 4.6 (Anthropic) |
| Cross-session pattern detection | Claude Sonnet 4.6 with accumulated session history |
| Structured output | JSON extraction from Claude responses |

## Key Achievements

- Claude analyzes raw 1:1 meeting notes against a detailed HRBP system prompt and produces a consistent two-section structured report every time
- Section 1 (Meeting Analysis): executive summary, sentiment score, concern level (Low/Watch/Medium/High), key themes, 5-dimension signal detection (engagement, frustration, career, manager/team, wellbeing), risk flags with verbatim quote evidence, and suggested actions
- Section 2 (Longitudinal Patterns): Claude reviews all prior sessions for the employee and identifies emerging trends, escalating risks, and how the employee's narrative has evolved over time
- Running employee memory card: after each session, Claude updates a structured summary card capturing the employee's current state, open actions, and trajectory
- Evidence-first design: every risk flag and recommendation is required to cite a verbatim quote from the notes with the session date
- Per-employee session database: all notes and analysis stored in `data/hrbp-copilot-db.json` (local) or localStorage (browser-only mode)
- Auth-protected local server when running in full `dev` mode

## Architecture

```
React frontend (App.jsx)
     |-- Paste 1:1 notes + employee context
     |-- View structured HRBP report
     |-- Browse session history per employee
     v
api.js (Claude API calls)
     |-- callClaude(notes + session history, HRBP_SYSTEM prompt)
     |-- Extract meta JSON (sentiment, concern, flags)
     |-- Update employee memory card
     v
Express server (dev mode)
     |-- Auth middleware (session + login)
     |-- /api/sessions (read/write JSON file DB)
```

## Tech Stack

- **Frontend:** React 18, React Scripts
- **AI:** Anthropic Claude Sonnet 4.6 (direct API call from browser or via server)
- **Backend:** Express.js (local dev server with auth)
- **Storage:** JSON file database (`data/hrbp-copilot-db.json`) or localStorage

## How to Run

```bash
npm install
# Create .env with:
# REACT_APP_ANTHROPIC_API_KEY=your_key
# HRBP_AUTH_USER_ID=your_user
# HRBP_AUTH_PASSWORD=your_password
# HRBP_SESSION_SECRET=random_string

npm run dev     # React app + local auth server (recommended)
# or
npm start       # React only, no auth, localStorage mode
```

Open http://localhost:3000.
