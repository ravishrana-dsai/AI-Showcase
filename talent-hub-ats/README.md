# Talent Hub ATS

> A full-stack Applicant Tracking System with AI-assisted screening, automated candidate scoring, Kanban pipeline management, and Slack notifications for hiring teams.

## AI Stack

| Component | Technology |
|---|---|
| Resume screening | Claude Sonnet 4.6 (Anthropic) |
| Interview scorecard analysis | Claude Sonnet 4.6 |
| Background jobs | BullMQ (Redis-backed queue) |

## Key Achievements

- AI-assisted resume screening: Claude evaluates uploaded resumes against job requirements and produces a structured fit score with reasoning
- Interview scorecard generation: structured scoring rubric assessed by Claude for consistency across interviewers
- Kanban pipeline: drag-and-drop candidate pipeline from Applied through Offer with stage-level analytics
- Full background job system (BullMQ + Redis) for async document processing, email dispatch, and webhook delivery
- S3-compatible document storage (MinIO) for resumes, scorecards, and offer letters
- REST API + Webhooks for integration with external HR systems
- EEO/OFCCP compliance tracking built into the pipeline
- Monorepo architecture (Turborepo) with shared Prisma schema, types, and validators across web app and background workers

## Architecture

```
Browser (Next.js 15)
     |
     v
Next.js API Routes (NextAuth.js auth)
     |-- Job management
     |-- Candidate pipeline (Kanban)
     |-- Interview scheduling + scorecards
     |-- Offer workflows
     |
     v
BullMQ workers (Redis)
     |-- Resume parsing + AI screening
     |-- Email notifications
     |-- Webhook delivery
     |
     v
PostgreSQL (Prisma ORM) + MinIO (documents)
```

## Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **Backend:** Next.js API routes, NextAuth.js
- **Database:** PostgreSQL + Prisma ORM
- **Queue:** Redis + BullMQ
- **Storage:** MinIO (S3-compatible)
- **Monorepo:** npm workspaces + Turborepo
- **Infra:** Docker + Docker Compose

## How to Run

```bash
npm install
docker compose up -d   # starts PostgreSQL, Redis, MinIO
npm run db:push
npm run db:seed
npm run dev
```

Open http://localhost:3050.

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@company.com | admin123 |
| Recruiter | recruiter@company.com | admin123 |
| Hiring Manager | manager@company.com | admin123 |
| Interviewer | interviewer@company.com | admin123 |
