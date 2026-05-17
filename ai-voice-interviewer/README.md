# AI Voice Interviewer

> An AI interviewer that conducts structured 20-minute voice interviews, scores candidates across 5 dimensions, and pushes results to a hiring dashboard and Slack, all without a human in the room.

## AI Stack

| Component | Technology |
|---|---|
| LLM (interview brain + scoring) | Claude Sonnet 4.6 (Anthropic) |
| Speech-to-text | Deepgram Nova-2 |
| Text-to-speech | Cartesia Sonic English |
| Voice pipeline orchestration | Pipecat (Python) |
| WebRTC transport | Daily.co |

## Key Achievements

- Conducts full 20-minute structured first-round interviews autonomously
- Scores each candidate across 5 dimensions: Communication, Role Fit, Motivation, Culture Fit, Problem Solving
- Real-time voice conversation: STT (Deepgram) feeds Claude, Claude responds via TTS (Cartesia) over WebRTC (Daily.co)
- Structured scoring rubric: Claude evaluates transcript and produces a JSON scorecard per dimension
- Slack webhook notifications push interview results to the hiring team instantly
- Admin dashboard to manage roles, view candidate scorecards, and replay sessions
- Supports multiple roles with fully customizable question sets

## Architecture

```
Candidate browser       Next.js web app          Pipecat server (Python/FastAPI)
  Daily WebRTC  <---->  /interview/[token]  <-->  Pipecat pipeline
                        /admin                         |
                        /api/...                  Deepgram Nova-2 (STT)
                                                  Claude Sonnet 4.6 (LLM)
                                                  Cartesia Sonic (TTS)
```

The Pipecat pipeline manages the real-time audio stream: audio chunks in, transcribed text to Claude, Claude response text to Cartesia, synthesized audio back to the candidate via Daily WebRTC.

## Tech Stack

- **Web:** Next.js (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL
- **Backend:** Python, FastAPI, Pipecat
- **Infra:** Docker, AWS EC2 (Pipecat server), AWS RDS (production DB)
- **Auth:** NextAuth.js
- **Notifications:** Slack Webhooks

## How to Run

### Prerequisites

API keys needed: Anthropic, Deepgram, Cartesia, Daily.co, Slack (webhook).

### Python server (Pipecat)

```bash
cd ai-voice-interviewer/server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in API keys
uvicorn main:app --reload --port 8000
```

### Next.js web app

```bash
cd ai-voice-interviewer/web
npm install
cp .env.example .env.local   # fill in all values
npm run db:push
npm run db:seed
npm run dev
```

Open http://localhost:3000. Admin dashboard at `/admin`.
