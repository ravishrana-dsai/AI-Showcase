# Slack Agentic Bot

> A persistent Slack bot that listens to every message in your workspace and autonomously structures them into tasks, content, and HRBP-style one-on-one notes, all stored in PostgreSQL for later querying and analysis.

## AI Stack

| Component | Technology |
|---|---|
| Message classification | Claude Sonnet (via API) |
| Structured data extraction | LLM-powered parsing (tasks, action items, issues) |
| Transport | Slack Bolt SDK (Socket Mode) |

## Key Achievements

- Autonomous classification: every incoming Slack message is analyzed and classified into one of four structured types (raw message, task, content, 1:1 HRBP note)
- HRBP note extraction: in one-on-one channels, the bot extracts issues and action items from conversation and stores them as structured records
- Persistent memory: all classified data is stored in PostgreSQL, enabling downstream querying, dashboards, and analytics
- Socket Mode operation: no public webhook required, works behind any firewall
- Listens across public channels, private groups, and DMs simultaneously

## Tech Stack

- **Language:** TypeScript (Node.js 18+)
- **Slack SDK:** `@slack/bolt` v3 (Socket Mode)
- **Database:** PostgreSQL (`pg`)
- **Runtime:** ts-node (dev), compiled JS (production)

## How to Run

### 1. Create a Slack app

Go to [api.slack.com/apps](https://api.slack.com/apps):
- Enable **Socket Mode** and create an App-Level Token with `connections:write`
- Subscribe to bot events: `message.channels`, `message.groups`, `message.im`
- Add OAuth scopes: `channels:history`, `channels:read`, `groups:history`, `groups:read`, `im:history`, `im:read`

### 2. Install and configure

```bash
npm install
cp .env.example .env
# Set SLACK_APP_TOKEN, SLACK_BOT_TOKEN, DATABASE_URL
```

### 3. Set up the database

```bash
createdb slack_bot
npm run db:migrate
```

### 4. Run

```bash
npm run dev       # development with ts-node
npm run build && npm start   # production
```
