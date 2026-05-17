# Talent Hub (SportsAI Hiring) — Full Prompt Sheet

**Purpose:** Single reference for AI assistants and developers to understand, run, and extend this project. Use this document as the main context when making changes.

---

## 1. Project identity

- **Product name:** SportsAI Hiring  
- **Codebase name:** Talent Hub  
- **Type:** Applicant Tracking System (ATS) — full recruitment lifecycle from requisition to offer and onboarding.  
- **Default currency:** INR (Indian Rupee). Salaries are stored in rupees; display uses `formatSalary()` (₹ and `en-IN` locale).  
- **Deployment:** Single Next.js app; dev server runs on port **3050** with **hostname 0.0.0.0** (reachable on LAN).

---

## 2. How to run

| Task | Command | Notes |
|------|---------|--------|
| **Dev server (live)** | `npm run dev` (from repo root) | Turbo runs all workspaces; web app at **http://localhost:3050** and **http://0.0.0.0:3050** |
| **Web app only** | `cd apps/web && npm run dev` | Same port and hostname if Turbo fails |
| **DB schema sync** | `npm run db:push` | Prisma push (no migrations in dev); run after schema changes |
| **Seed database** | `npm run db:seed` | Idempotent: creates org, users, departments, locations, sample jobs (incl. [Company]–style), candidates, applications, requisitions, offers; fixes offer-stage consistency |
| **Prisma Studio** | `npm run db:studio` | Inspect/edit DB |
| **Build** | `npm run build` | Turbo build |

**Environment:** `apps/web/.env.local` — set `DATABASE_URL` (e.g. `file:../db/prisma/dev.db` for SQLite) and NextAuth `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (e.g. `http://localhost:3050`). Optional: Google OAuth credentials.

**Demo logins (after seed):**  
- Admin: `admin@dream-sports.com` / `admin123`  
- Recruiter: `recruiter@dream-sports.com` / `admin123`  
- Hiring Manager: `manager@dream-sports.com` / `admin123`

---

## 3. Repo structure

```
TA/
├── apps/web/                 # Next.js app (App Router)
│   ├── src/app/              # Routes: (auth)/login, (dashboard)/dashboard/*
│   ├── src/components/      # UI: layout, jobs, candidates, offers, interviews, etc.
│   └── src/lib/              # get-session, auth, resume-parser, utils (formatSalary, etc.)
├── packages/
│   ├── db/                   # Prisma schema, client, seed
│   │   ├── prisma/schema.prisma
│   │   └── src/seed.ts
│   └── shared/               # Constants (roles, permissions), Zod validators
├── docs/                     # PROJECT_OVERVIEW.md, this file, SETUP_IDE_PYTHON.md, etc.
├── package.json              # Workspaces, packageManager npm@10.8.2, scripts
└── turbo.json
```

**Key entry points:**  
- **Auth/session:** `apps/web/src/lib/get-session.ts` (`requireAuth()`, `requirePermission()`, `hasPermission()`).  
- **Permissions:** `packages/shared/src/constants.ts` — roles and permission strings.  
- **Schema:** `packages/db/prisma/schema.prisma` — single source of truth for data model.

---

## 4. Tech stack (concise)

- **Front end:** Next.js 16 (App Router), React 19, Tailwind CSS 4, lucide-react, react-hook-form + Zod, @dnd-kit (pipeline drag-and-drop), sonner (toasts).  
- **Back end:** Next.js API routes, Prisma, SQLite (dev), NextAuth (credentials + optional Google), bcryptjs.  
- **Monorepo:** npm workspaces, Turborepo.  
- **Resume parsing:** pdf-parse, mammoth (bulk upload).  
- **Validation:** Zod in `packages/shared/src/validators.ts` (createJobSchema, createOfferSchema, etc.); defaults use INR.

---

## 5. Main routes and flows

| Area | Paths | Notes |
|------|--------|------|
| **Auth** | `/login` | Credentials; demo one-click fill; theme toggle |
| **Dashboard** | `/dashboard` | Stats, recent applications; **All / Mine** toggle (Mine = recruiter-assigned or HM’s jobs) |
| **Jobs** | `/dashboard/jobs`, `/dashboard/jobs/[id]`, `/dashboard/jobs/new` | List, detail + pipeline board (drag-drop), create (with “Use template” for JD) |
| **Candidates** | `/dashboard/candidates`, `[id]`, `new`, `upload` | List, profile (applications, notes, docs, interviews, offer), add, bulk upload |
| **Interviews** | `/dashboard/interviews` | Upcoming / Past tabs; schedule (timezone, panelist picker, meeting link); “Submit feedback” → candidate profile |
| **Offers** | `/dashboard/offers` | List; create from candidate profile; status SENT/ACCEPTED/DECLINED |
| **Requisitions** | `/dashboard/requisitions`, `new` | List, create; approvals |
| **Analytics** | `/dashboard/analytics` | Pipeline, source effectiveness, time-to-hire, time-to-fill, offer acceptance rate, top jobs |
| **Settings** | `/dashboard/settings/*` | Team, organization, emails, webhooks, API keys, **Job description template**, compliance |

---

## 6. Data model (high level)

- **Organization** → Users, Jobs, Candidates, Requisitions, etc. (all scoped by `organizationId`).  
- **Job** — title, slug (unique per org), description, requirements, benefits, status, salary band (INR default), `hiringManagerId`, `requisitionId`, pipeline stages (PipelineStage).  
- **Candidate** — name, email, phone, company, title, source, expectedCtc, noticePeriod, tags.  
- **Application** — candidateId, jobId, currentStageId, status (ACTIVE/HIRED/REJECTED/etc.), **recruiterId** (optional). Uniqueness: (candidateId, jobId).  
- **StageHistory** — applicationId, stageId, enteredAt, exitedAt, movedById.  
- **Interview** — applicationId, title, type, scheduledAt, durationMinutes, timezone, meetingLink, status; InterviewPanelist.  
- **Offer** — applicationId, title, salary, salaryCurrency (default INR), salaryPeriod, status (DRAFT/PENDING_APPROVAL/SENT/ACCEPTED/DECLINED), sentAt, acceptedAt, declinedAt.  
- **Requisition** — title, department, location, headcount, priority, status, approvals (RequisitionApproval).  
- **User** — role (SUPER_ADMIN, ADMIN, RECRUITER, HIRING_MANAGER, INTERVIEWER, LIMITED), organizationId.

**Important rule:** An offer must not be shown as SENT (or ACCEPTED/DECLINED) until the application is in the **Offer** pipeline stage. When creating or fixing offers, move the application to the Offer stage (update `currentStageId` and StageHistory) so pipeline progress and offer status stay consistent.

---

## 7. API patterns

- **Auth:** Use `getSession()` or `requireAuth()`; for permission-gated routes use `requirePermission("permission.string")`.  
- **Org scoping:** All list/create/update queries filter by `(session.user as any).organizationId`.  
- **Currency:** Default `salaryCurrency` is INR in schema, validators, and API (jobs, offers, requisitions).  
- **Salary display:** Use `formatSalary(amount, currency, period?)` from `@/lib/utils` (INR → ₹ + en-IN locale).  
- **Key APIs:**  
  - `PATCH /api/applications/[id]` — update recruiterId.  
  - `POST /api/applications/move` — move application to a stage (StageHistory updated).  
  - `GET /api/users` — org users (for panelist picker, recruiter dropdown).  
  - `GET/PATCH /api/settings/job-description-template` — JD template in org settings.  
  - `POST /api/jobs` — create job (default stages, INR).  
  - `POST /api/offers/create` — create offer (INR default).  
  - `POST /api/interviews/create` — timezone, panelistIds array, meetingLink.

---

## 8. Conventions and business rules

- **Pipeline:** Each job has PipelineStages (e.g. New, Screen, Interview, Offer, Hired). Moving a card updates Application.currentStageId and StageHistory.  
- **Offer lifecycle:** Create as DRAFT → approvals (if any) → SENT. Only move to Offer stage before sending; seed and fix scripts ensure applications with SENT/ACCEPTED/DECLINED offers are in the Offer stage.  
- **Recruiter assignment:** Optional on Application; shown on pipeline card; dropdown in job pipeline (org users).  
- **Dashboard “Mine”:** Applications where recruiterId = current user or job.hiringManagerId = current user.  
- **Interviews:** Upcoming = SCHEDULED/CONFIRMED and scheduledAt >= now; Past = rest. Include `candidate.id` in serialized payload for “Submit feedback” link.  
- **Seed:** Idempotent; does not duplicate jobs/candidates/offers by unique keys; creates sample requisitions and fixes offer-stage consistency and time-to-hire backdates.

---

## 9. Key files (quick reference)

| Purpose | File |
|--------|------|
| Prisma schema | `packages/db/prisma/schema.prisma` |
| Seed | `packages/db/src/seed.ts` |
| Roles & permissions | `packages/shared/src/constants.ts` |
| Zod schemas | `packages/shared/src/validators.ts` |
| Session & auth | `apps/web/src/lib/get-session.ts` |
| Auth API | `apps/web/src/app/api/auth/[...nextauth]/route.ts` |
| Salary formatting | `apps/web/src/lib/utils.ts` (`formatSalary`) |
| Dashboard layout/sidebar | `apps/web/src/app/(dashboard)/layout.tsx`, `components/layout/sidebar.tsx` |
| Pipeline board | `apps/web/src/components/jobs/pipeline-board.tsx` |
| Interview client | `apps/web/src/components/interviews/interviews-page-client.tsx` |
| Offer list/create | `apps/web/src/components/offers/offers-list.tsx`, `create-offer-modal.tsx` |

---

## 10. How to extend (prompt-style guidance)

- **One clear ask per turn** — e.g. “Add a field X to model Y and show it on page Z.”  
- **Mention the stack** — “Next.js App Router, Prisma, session from get-session, existing permission pattern.”  
- **Reference files** — “In `packages/db/prisma/schema.prisma` add …” and “In `apps/web/src/app/(dashboard)/dashboard/…”  
- **Acceptance criteria** — “Recruiters see a dropdown to assign recruiter on each pipeline card.”  
- **Schema → API → UI** — For new features that touch data: (1) schema + db:push, (2) API routes and session/org checks, (3) UI using existing components and formatSalary/INR where relevant.  
- **Idempotent seed** — When adding new sample data, check for existing by unique key before create; for offers, move application to Offer stage before creating SENT/ACCEPTED/DECLINED offers.

---

## 11. Sample prompts for common tasks

**Add a new field to Candidate and show on profile**  
“Add optional field `linkedInProfileUrl` (String) to Candidate in `packages/db/prisma/schema.prisma`. Run db:push. In candidate create API and profile page (`apps/web/src/app/(dashboard)/dashboard/candidates/[id]/page.tsx`), include this field in form and display. Use existing pattern for optional fields (e.g. expectedCtc).”

**Add validation before sending an offer**  
“Before allowing offer status to change to SENT, ensure the application’s current pipeline stage is an Offer stage (PipelineStage.type === 'OFFER'). Add this check in the API that updates offer status (e.g. `apps/web/src/app/api/offers/[id]/status/route.ts`). Return 400 with a clear message if the application is not in Offer stage.”

**New dashboard metric**  
“In `apps/web/src/app/(dashboard)/dashboard/analytics/page.tsx`, add a new summary card: ‘Avg time in Offer stage’ — for applications that have an offer (any status), compute average days between entering the Offer stage (from StageHistory) and either offer.acceptedAt or offer.declinedAt or now if still open. Use existing Prisma queries and date math; show N/A when no data.”

**Fix display bug**  
“On the candidate profile, the offer section shows salary as plain number. Use `formatSalary(app.offer.salary, app.offer.salaryCurrency)` from `@/lib/utils` so INR shows as ₹ with Indian locale. Ensure the offer block has access to salaryPeriod for the subtitle.”

---

## 12. Environment and config summary

- **DATABASE_URL:** SQLite in dev: `file:../db/prisma/dev.db` (relative to app) or absolute path.  
- **NEXTAUTH_SECRET:** Required for session encryption.  
- **NEXTAUTH_URL:** e.g. `http://localhost:3050` (or `http://0.0.0.0:3050` for LAN access).  
- **Google OAuth:** Optional; set in NextAuth provider if needed.  
- **Port:** 3050. **Hostname:** 0.0.0.0 in dev/start so the server is reachable on the network.

---

## 13. Summary checklist for AI/developer

- [ ] Use this document as primary context for changes.  
- [ ] Run `npm run dev` for live server at http://localhost:3050 and http://0.0.0.0:3050.  
- [ ] Default currency is INR; use `formatSalary()` for display; default salaryCurrency in schema/validators/APIs is INR.  
- [ ] Offers: application must be in Offer stage when offer is SENT/ACCEPTED/DECLINED; seed and fix scripts enforce this.  
- [ ] Org-scope all data; use requireAuth() / requirePermission(); GET /api/users for org users.  
- [ ] Add features in order: schema → API → UI; keep seed idempotent; reference exact file paths in prompts.  
- [ ] For full product/feature description, see `docs/PROJECT_OVERVIEW.md`; for progress and next steps, see `docs/PROGRESS_AND_NEXT_STEPS.md`.
