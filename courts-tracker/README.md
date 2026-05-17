# Courts Tracker

> An operations management platform for tracking sports court partner onboarding, request pipelines, SLA compliance, and real-time alerts, with a full analytics dashboard for ops and leadership teams.

## AI Stack

| Component | Technology |
|---|---|
| Background jobs + webhooks | Redis-backed async processing |
| Data layer | Prisma ORM + PostgreSQL |
| Auth + RBAC | NextAuth.js (ADMIN / OPS / LEADERSHIP roles) |

## Key Achievements

- Full court lifecycle management: ACTIVE, INACTIVE, ONBOARDING, SUSPENDED statuses with stage-by-stage pipeline tracking
- Request pipeline with multi-stage workflow and SLA enforcement: SLA_WARNING and SLA_BREACH alerts fire automatically when deadlines are at risk
- Real-time alerts dashboard surfaces flagged courts and overdue requests across the ops team
- Role-based access: ADMIN, OPS, and LEADERSHIP views with appropriate data scoping per role
- CSV import for bulk court onboarding, plus webhook endpoint for external integrations
- Analytics dashboard with request volume, stage conversion, SLA metrics, and per-court drill-downs
- Redis for session caching and real-time state

## Architecture

```
Browser (Next.js App Router)
     |
     v
API Routes (NextAuth.js RBAC)
  /api/courts       - CRUD + status transitions
  /api/requests     - Pipeline stage management
  /api/alerts       - SLA breach detection
  /api/analytics    - Aggregated metrics
  /api/import       - CSV bulk import
  /api/webhook      - External integrations
     |
     v
PostgreSQL (Prisma) + Redis (session/cache)
```

## Tech Stack

- **Framework:** Next.js (App Router), TypeScript, Tailwind CSS
- **Auth:** NextAuth.js with Prisma adapter
- **Database:** PostgreSQL + Prisma ORM
- **Cache:** Redis
- **UI:** Shadcn/UI components

## How to Run

```bash
npm install
cp .env.example .env.local
# Set DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET
npm run db:push
npm run db:seed
npm run dev
```

Open http://localhost:3000.
