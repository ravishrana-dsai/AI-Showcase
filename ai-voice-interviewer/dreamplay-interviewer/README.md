# [Company] Interview Agent

An AI-powered voice interview system for first-round hiring screening. Aria, the AI interviewer, conducts structured 20-minute voice conversations with candidates, scores them across 5 dimensions, and pushes results to a hiring dashboard and Slack.

## Architecture

```
Candidate browser       Next.js (Vercel)         Pipecat Server (EC2)
  Daily WebRTC  <---->  /interview/[token]  <-->  FastAPI + Pipecat pipeline
                        /admin                         |
                        /api/...                  Deepgram (STT)
                                                  Claude Sonnet (LLM)
                                                  Cartesia (TTS)
```

## Prerequisites

You will need accounts and API keys for:

| Service | Purpose | URL |
|---------|---------|-----|
| Anthropic | Claude LLM for interview brain + scoring | https://console.anthropic.com |
| Deepgram | Speech-to-text (Nova-2) | https://console.deepgram.com |
| Cartesia | Text-to-speech (Sonic English) | https://play.cartesia.ai |
| Daily.co | WebRTC transport | https://dashboard.daily.co |
| Slack | Webhook for result notifications | https://api.slack.com/apps |

## Local Development Setup

### 1. Clone and install

```bash
git clone <repo>
cd ai-voice-interviewer
```

### 2. Set up the Python server

```bash
cd server
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Fill in all keys in server/.env
```

Start the server:

```bash
uvicorn main:app --reload --port 8000
```

### 3. Set up the Next.js app

```bash
cd web
npm install

cp .env.example .env.local
# Fill in all values in web/.env.local

# Push schema to your dev database
npm run db:push

# Seed default roles (run once)
npm run db:seed   # see web/prisma/seed.ts if you add one
```

Start the web app:

```bash
npm run dev
```

The app runs at http://localhost:3000.
Admin dashboard: http://localhost:3000/admin (PIN: `[REDACTED]`)

### 4. Run with Docker (server + Postgres only)

```bash
# From repo root
cp server/.env.example server/.env
# Fill in server/.env

docker compose up -d
```

This starts Postgres and the Pipecat server. Run the Next.js app separately with `npm run dev`.

## Seeding Default Roles

The three default roles (Software Engineer, Data Scientist, Partnerships Manager) need to be inserted into your database. You can do this via the Admin UI or with a seed script:

```bash
cd web
npx prisma db seed
```

Or via the Admin dashboard at `/admin/roles` using "New Role".

## Creating a New Interview

### Via Admin Dashboard

1. Go to `/admin`
2. Click "New Interview"
3. Enter candidate name, email, and select a role
4. Copy the generated link and send it to the candidate

### Via API

```bash
curl -X POST http://localhost:3000/api/interviews/create \
  -H "Content-Type: application/json" \
  -d '{
    "candidateName": "Alex Johnson",
    "candidateEmail": "alex@example.com",
    "roleSlug": "software_engineer"
  }'
```

Response:

```json
{
  "interviewId": "...",
  "token": "...",
  "link": "https://yourapp.com/interview/abc123",
  "candidateName": "Alex Johnson",
  "roleSlug": "software_engineer"
}
```

Send the `link` to the candidate. No login required.

## Candidate Flow

1. Candidate opens the link
2. Reads the briefing and clicks "Start Interview"
3. Browser requests microphone access
4. Daily WebRTC connects to the Pipecat server
5. Aria greets the candidate and conducts 6 questions (~20 min)
6. Call ends, transcript is saved, Claude scores the interview
7. Scorecard is pushed to the dashboard and Slack

## Production Deployment

### Pipecat Server (AWS EC2)

Recommended: `t3.medium` or larger (Silero VAD is CPU-intensive).

```bash
# On EC2
sudo apt-get update && sudo apt-get install -y docker.io docker-compose
git clone <repo>
cd ai-voice-interviewer
cp server/.env.example server/.env
# Fill in all keys

docker compose up -d

# Set up nginx reverse proxy to port 8000
# Obtain SSL cert (certbot)
```

Set `PIPECAT_SERVER_URL=https://your-ec2-domain.com` in your Vercel environment variables.

### Next.js App (Vercel)

1. Connect the `web/` directory to a Vercel project
2. Set all environment variables from `web/.env.example` in Vercel dashboard
3. Set `DATABASE_URL` to your production Postgres (AWS RDS recommended)
4. Deploy: `git push` or via Vercel CLI

### Database (AWS RDS)

```bash
# After RDS is running, run migrations
cd web
DATABASE_URL=postgresql://... npx prisma migrate deploy
```

## Creating a New Role

Via the Admin UI at `/admin/roles`:

1. Click "New Role"
2. Enter role name and slug (e.g. `growth_marketer`)
3. Add 6 interview questions
4. Adjust scoring weights (must total ~100%)
5. Click "Create Role"

The new role is immediately available when creating interviews.

## Environment Variable Reference

### server/.env

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `DEEPGRAM_API_KEY` | Deepgram API key |
| `CARTESIA_API_KEY` | Cartesia API key |
| `DAILY_API_KEY` | Daily.co API key |
| `DATABASE_URL` | PostgreSQL connection string |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL |
| `SERVER_PORT` | Port for the FastAPI server (default: 8000) |
| `NEXTJS_API_URL` | Base URL of the Next.js app (e.g. http://localhost:3000) |

### web/.env.local

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PIPECAT_SERVER_URL` | URL of the Pipecat server (e.g. http://localhost:8000) |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL |
| `NEXT_PUBLIC_APP_URL` | Public URL of the Next.js app |
| `ADMIN_PIN` | Admin dashboard PIN (default: [REDACTED]) |

## Interview Scoring Dimensions

| Dimension | What is evaluated |
|-----------|------------------|
| Communication | Clarity, structure, conciseness |
| Role Fit | Relevant experience and skills |
| Motivation | Genuine interest in [Company] and the role |
| Culture Fit | Startup mindset, adaptability, sports passion |
| Problem Solving | Analytical thinking, approach to challenges |

Scores are 1-10 per dimension. Overall score is a weighted average based on the role's `scoringWeights`.

Recommendation thresholds:
- `strong_pass`: weighted overall >= 8.0
- `pass`: 6.5 to 7.9
- `hold`: 5.0 to 6.4
- `reject`: below 5.0
