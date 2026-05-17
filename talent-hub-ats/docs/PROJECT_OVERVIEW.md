# SportsAI Hiring (Talent Hub) — Project Overview

A detailed document for understanding the vision, structure, capabilities, roadmap, and technical stack of the project.

---

## 1. Vision & Idea

### 1.1 What It Is

**SportsAI Hiring** (product name; codebase name **Talent Hub**) is an **Applicant Tracking System (ATS)** built in-house to run the full recruitment lifecycle: from opening a requisition to extending an offer and onboarding.

The system is envisioned as a **modern, role-aware ATS** that:

- Centralizes **jobs**, **candidates**, **interviews**, and **offers** in one place.
- Supports **multi-step approvals** (requisitions, job posting, offers).
- Tracks candidates through **customizable pipeline stages** per job (e.g. New → Screen → Interview → Offer → Hired).
- Enables **structured interview feedback** (scorecards) and **offer management** with approval workflows.
- Keeps **compliance and data privacy** in mind (EEO, GPlayer Rating-style export/delete, role-based access).

The idea is to give recruiters, hiring managers, and leadership a single platform to manage hiring without depending on external ATS products, with the flexibility to extend it (e.g. [Company]-style requirements: talent pool, recruiter assignment, role-specific dashboards, automation).

### 1.2 Who It’s For

- **Recruiters** — Create jobs, add/source candidates, move them through stages, schedule interviews, collect feedback, create/send offers.
- **Hiring Managers** — Own jobs (as “hiring manager”), approve requisitions/job postings/offers, participate in interviews and submit scorecards.
- **Interviewers** — View assigned interviews and submit feedback (scorecards).
- **Admins / Super Admins** — Manage organization, team, roles, email templates, webhooks, API keys, compliance.
- **Leadership** — View analytics (pipeline, source effectiveness, time-to-hire) and, in a future phase, org-wide and department-level metrics.

### 1.3 Design Principles

- **Single codebase, one web app** — One Next.js app; no separate mobile app in scope.
- **Role-based access** — Permissions (create/edit/approve/view) are defined per role and enforced in the API and UI.
- **Organization-scoped data** — All core data (jobs, candidates, etc.) is scoped by `organizationId` for future multi-tenancy.
- **Approval workflows** — Requisitions, job posting, and offers support multi-step approvals (e.g. TA Head / Leadership).
- **Extensibility** — Custom fields, pipeline templates, and API/webhooks allow integration and customization.

---

## 2. Project Structure

The project is a **monorepo** using **npm workspaces** and **Turborepo**.

```
TA/
├── apps/
│   └── web/                    # Next.js web application (front-end + API)
│       ├── src/
│       │   ├── app/            # App Router: pages, layouts, API routes
│       │   ├── components/     # React components (UI, layout, feature-specific)
│       │   └── lib/            # Auth, session, resume parser, utils
│       └── package.json
├── packages/
│   ├── db/                     # Database layer (Prisma + schema + seed)
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Single source of truth for data model
│   │   └── src/
│   │       ├── index.ts        # Prisma client export
│   │       └── seed.ts         # Demo data seeding
│   └── shared/                 # Shared constants, types, validation
│       └── src/
│           ├── constants.ts    # Roles, permissions, status labels
│           └── index.ts
├── docs/                       # Documentation (e.g. this file)
├── package.json                # Root workspace config + scripts
└── turbo.json                  # Turborepo task config
```

### 2.1 Workspaces

| Workspace        | Purpose |
|------------------|--------|
| `talent-hub` (root) | Scripts: `dev`, `build`, `lint`, `db:generate`, `db:push`, `db:seed`, `db:studio` |
| `@talent-hub/web`   | Next.js app (port 3050, hostname 0.0.0.0 in dev) |
| `@talent-hub/db`    | Prisma client, schema, migrations, seed |
| `@talent-hub/shared`| Shared constants, types, Zod schemas (used by web and db where needed) |

### 2.2 Main App Routes (Web)

| Area | Path | Description |
|------|------|--------------|
| **Auth** | `/login` | Login (credentials; optional Google OAuth if configured) |
| **Dashboard** | `/dashboard` | Home: counts (jobs, candidates, pipeline, interviews, offers), recent applications |
| **Jobs** | `/dashboard/jobs`, `/dashboard/jobs/[id]`, `/dashboard/jobs/new` | List, detail, create/edit jobs; pipeline board per job |
| **Candidates** | `/dashboard/candidates`, `/dashboard/candidates/[id]`, `/dashboard/candidates/new`, `/dashboard/candidates/upload` | List, profile, add manually, bulk resume upload |
| **Interviews** | `/dashboard/interviews` | List and schedule interviews; link to scorecards |
| **Offers** | `/dashboard/offers` | List offers; create, approve, send, track status |
| **Requisitions** | `/dashboard/requisitions`, `/dashboard/requisitions/new` | List and create requisitions; approvals |
| **Analytics** | `/dashboard/analytics` | Pipeline overview, source effectiveness, time-to-hire, time in stage, top jobs |
| **Help** | `/dashboard/help` | In-app help and role/permission summary |
| **Settings** | `/dashboard/settings`, `/dashboard/settings/team`, `organization`, `emails`, `webhooks`, `api-keys`, `compliance` | Org, team, email templates, webhooks, API keys, compliance (GPlayer Rating export/delete) |

---

## 3. How Development Prompts Were Structured

This section describes how instructions (“prompts”) were structured when building the project with AI-assisted development (e.g. Cursor). The goal is to make it easy to extend the app or replicate a similar build by using clear, scoped prompts.

### 3.1 Principles Used

- **One clear ask per turn** — Each prompt had a single focus (e.g. “Add recruiter assignment to Application”) so changes stayed localized and reviewable.
- **Context by reference** — Files or areas were referenced explicitly (e.g. “In `packages/db/prisma/schema.prisma` add …”) so the model knew where to edit.
- **Acceptance criteria in the prompt** — Desired outcome was stated (e.g. “Recruiters see only their assigned candidates on the dashboard”) so success was unambiguous.
- **Tech stack and patterns named** — Prompts mentioned “Next.js App Router”, “Prisma”, “role from session”, “existing permission pattern in `get-session.ts`” so generated code matched the stack.
- **Incremental steps** — Large features were broken into steps (e.g. “1) Schema change, 2) API and session, 3) Dashboard filter”) and each step was a separate prompt or follow-up.

### 3.2 Sample prompt 1: Feature with schema + UI

**Goal:** Add a “Recruiter assigned” concept and show it on the job pipeline page.

**Prompt (structured):**

```
We need recruiter assignment on applications.

1) Schema (packages/db/prisma/schema.prisma):
   - Add optional `recruiterId` on Application, relation to User.
   - Run db push after.

2) API (apps/web):
   - When creating an application (or moving to a stage), allow setting recruiterId if the current user has permission (e.g. recruiter or admin).
   - In GET applications for a job, include recruiter { id, name } in the response.

3) UI (job pipeline page):
   - On each candidate card on the pipeline board, show the assigned recruiter’s name (or “Unassigned”).
   - If the current user is admin or recruiter, add a small control to assign/change recruiter (dropdown of org recruiters).

Use the existing permission helpers from get-session and the existing pipeline board component; don’t change the drag-and-drop behavior.
```

**Why it works:** One feature, three clear steps (schema → API → UI), exact file hints, permission and UI constraints stated, and existing patterns referenced.

### 3.3 Sample prompt 2: UI polish and consistency

**Goal:** Make the login page and header feel consistent with the rest of the app.

**Prompt (structured):**

```
Login page and header polish:

1) Login (apps/web/src/app/(auth)/login/page.tsx):
   - Use the same design tokens as the rest of the app (background, card, border, primary from globals.css).
   - Add the SA logo (existing 2-letter block) above the title; ensure spacing and alignment match the dashboard brand area.
   - Demo credentials: show the three demo accounts (admin, recruiter, manager) with role labels. Each row should be clickable to fill the email/password fields so users can sign in with one click.

2) Header (apps/web/src/components/layout/header.tsx):
   - Fix the search bar: the magnifying glass icon is overlapping the placeholder text. Increase left padding on the input so the placeholder “Search candidates, jobs…” doesn’t sit under the icon.

Don’t add new dependencies. Prefer existing Tailwind classes and the same focus/ring pattern used on other inputs.
```

**Why it works:** Concrete targets (logo, demo one-click fill, search spacing), references to existing tokens and components, and explicit “no new deps / use existing patterns” to keep the change set small.

### 3.4 When to use this style for new work

- **New feature:** Describe the user outcome, then 1–3 steps (schema if needed, API, UI) with file paths and permission/role rules.
- **Bug fix:** Include the exact screen or flow, what’s wrong, and what “done” looks like (e.g. “Search placeholder no longer overlaps icon”).
- **Refactor:** Name the current pattern and the desired pattern, and list the files or areas in scope so changes stay bounded.

---

## 4. What It Can Do Today (Current Capabilities)

### 4.1 Authentication & Session

- **Login (`/login`)** — Credentials (email + password) validated against `User` table (bcrypt, cost 12). Optional Google OAuth if configured. Redirect to `callbackUrl` or `/dashboard`. Error message on bad credentials. Demo block: 10 accounts grouped across three panels (Admin/Recruiter, Hiring Managers, Interviewers) with one-click fill. Password for all demo accounts: `Sports@123`. Theme toggle (top-right).
- **Demo accounts** — 10 pre-seeded accounts: `admin@`, `recruiter@`, `manager@`, `priya.singh@`, `kabir.khan@`, `ananya.roy@` (hiring managers), `interviewer@`, `dev.patel@`, `riya.verma@`, `aarav.nair@` (all `@dream-sports.com`).
- **Session & middleware** — NextAuth session includes `user.id`, `user.email`, `user.name`, `user.role`, `user.organizationId`. `requireAuth()` returns a flat `SessionUser` object (not `{ user: SessionUser }`). Middleware protects `/dashboard/*`; unauthenticated users redirect to `/login`. Server-side `hasPermission(user.role, permission)` from shared constants.
- **Sign out** — Header control calls `signOut({ callbackUrl: "/login" })`.

### 4.2 Dashboard Home (`/dashboard`)

- **Stats** — Four cards: Open Jobs, Candidates, Active in Pipeline, Upcoming Interviews; one card for Pending Offers. Each links to the relevant list. Counts are organization-scoped.
- **Recent applications** — Up to 8 most recent active applications; each row shows candidate name (link to profile), job title (link to job), current stage (colored pill), relative time. “View all” to candidates list.
- **Empty state** — If no data, short guidance and links to create job or add candidate.

### 4.3 Jobs

- **List** — Table: title, department, location, hiring manager, status, application count. “Create Job” (permission-gated) → new job. Row click → job detail.
- **Detail** — Job header (title, status, department, location, hiring manager, description/requirements/benefits). **Pipeline board:** columns = stages; cards = applications; drag-and-drop moves candidate to another stage (persisted via API). Actions: Edit job, add candidate to this job. Screening questions listed/managed via API.
- **Create/Edit job** — Form: title, slug, description, requirements, benefits, department, location, hiring manager, status, employment type, experience level, salary min/max, show salary, is remote, optional requisition link. Validation: required title; slug unique per org. On create, default pipeline stages created from template.

### 4.4 Candidates

- **List** — Table: name (avatar), email, phone, source, latest application (job + stage), tags. “Add Candidate” and “Bulk Upload CVs” links. Row click → profile.
- **Profile** — Header (name, email, phone, company, title, location, LinkedIn, source). **Applications:** list with job, stage, applied date; link to job; move/reject/hire actions; **”Add to Job” button** in the section header opens a modal to map the candidate to any open job pipeline. **Documents:** uploaded files (resume etc.) with type and date. **Notes:** timeline; add note (optional private). **Interviews:** upcoming/past with link to submit feedback. **Offer:** if any, show status and link. Actions: Send email (template picker).
- **Add candidate** — Form: first name, last name, email, phone, company, title, location, LinkedIn, portfolio, summary, source. Validation: required name, email; email unique per org. On submit: create candidate; redirect to profile or “Add to job” flow.
- **Bulk upload** — Drag-and-drop or picker for multiple PDF/DOCX files. Optional: select a job from the dropdown to map all successfully parsed candidates directly into that job's pipeline (first stage). Without a job selected, candidates are created without an application. Each file parsed via `unpdf` (PDF) or `mammoth` (DOCX); name extracted with ALL CAPS support, honorific stripping, hyphenated names, initials; skills, email, phone, LinkedIn extracted. Creates new candidate or detects duplicate by email. Per-file result: Created / Duplicate / Error with “In pipeline” badge when job was selected. Summary counts at top.
- **Add to Job (from profile)** — “Add to Job” button on the candidate's Applications section opens a modal: lists open jobs the candidate is not already in; select one and confirm; API creates the Application at the first pipeline stage and logs activity; success feedback with job name and stage; candidate profile auto-refreshes.

### 4.5 Applications & Pipeline

- **Creating application** — From job detail or candidate profile: select candidate (or create) and job; create Application with first stage. Uniqueness: one application per (candidate, job).
- **Moving in pipeline** — On job pipeline board: drag card to another column; API updates `currentStageId` and appends StageHistory.
- **Reject / Withdraw / Hire** — Actions set application status and timestamps; permissions by role (e.g. recruiter, HM for reject).

### 4.6 Interviews

- **List** — Upcoming and past; filter by status. Columns: candidate, job, title, type, date/time, duration, panelists, status. “Schedule interview” opens flow.
- **Scheduling** — Select application, title, type, date/time, duration, timezone, meeting link, location, panelists (user picker). Creates Interview and InterviewPanelist; optional `calendarEventId`.
- **Feedback (scorecard)** — From interview list or candidate profile: submit overall rating, recommendation (Strong No → Strong Yes), summary, optional criteria (JSON). Linked to application and interviewer.

### 4.7 Offers

- **List** — Table: candidate, job, title, salary, status, dates. Filter by status. “Create offer” from application.
- **Create/Edit** — Application chosen; title, salary, currency, period, equity, bonus, start date, expiry, offer letter URL. Status Draft until approvals. Approval workflow: OfferApproval records; when approved, status can move to Sent.
- **Status updates** — Sent, Accepted, Declined (with reason), Void, Expire; timestamps updated.

### 4.8 Requisitions

- **List** — Table: title, department, location, headcount, priority, status, created. “Create requisition” → form.
- **Create** — Title, department, location, headcount, priority, justification, salary band, employment type. Optional approval chain. Approved requisitions can be linked when creating jobs.
- **Approvals** — Approvers see pending items; approve/reject with comment; multi-step order respected.

### 4.9 Analytics (`/dashboard/analytics`)

- **Summary cards** — Total applications; average time-to-hire (appliedAt → hiredAt); open jobs count.
- **Charts** — Pipeline overview (by status); source effectiveness (by candidate source); average time in stage (from StageHistory); most active jobs (by application count).
- **Export** — Links to export candidates or applications (admin only).

### 4.10 Settings & Admin

- **Team** — List users; add/invite (email, name, role); deactivate. Role: Super Admin, Admin, Recruiter, Hiring Manager, Interviewer, Limited. Admin only.
- **Organization** — Edit name, logo, website, industry, size.
- **Email templates** — List; create (name, subject, body, category). Used in “Send email” modal.
- **Webhooks** — Add URL, events, secret; list and toggle active.
- **API keys** — Create (name); show secret once; list with last used/expiry.
- **Compliance** — GPlayer Rating-style export and candidate deletion (admin); EEO data admin-only.

### 4.11 Notifications & Help

- **Notifications** — Bell icon; list (type, title, message, link, read/unread); mark read; link to relevant page.
- **Help** — Sections for Jobs, Candidates, Interviews, Offers, Analytics, Settings; how-to steps and links; role vs permission matrix.

### 4.12 Permissions (Summary)

- **Jobs:** create/edit (recruiter, admin); delete, approve (admin, HM). **Candidates:** create/edit (recruiter, admin); delete (admin); view (recruiter, HM, interviewer). **Applications:** move, reject (recruiter, HM); view (recruiter, HM, interviewer). **Interviews:** schedule (recruiter, admin); feedback (recruiter, HM, interviewer). **Offers:** create/send (recruiter, admin); approve (HM, admin); view (recruiter, HM). **Analytics:** view (recruiter, HM, admin); export (admin). **Settings / Team / Integrations / Compliance:** admin (and super admin) only. Exact mapping in `packages/shared/src/constants.ts` (`PERMISSIONS`); enforced via `requireAuth()` and `hasPermission()`.

---

## 5. Next Phase (Planned / Recommended)

These items align with a “[Company]-style” or enterprise ATS vision and the current gap analysis.

### 5.1 Data Model

- **Recruiter assignment** — Assign a recruiter (owner) to each application or job; enables “my pipeline” and workload balancing.
- **Candidate fields** — Expected CTC, notice period (and optionally more) for better offer and planning.
- **Talent pool** — Dedicated concept: candidates not tied to a current application (e.g. “strong but no opening”, “future potential”); fields like reason for pool, last contacted, notes.
- **Structured feedback** — Explicit fields or enums for Technical, Cultural fit, Communication, Problem-solving, Overall recommendation, Red flags (in addition to or instead of freeform JSON).

### 5.2 Dashboards by Role

- **Recruiter dashboard** — “My” requisitions, “my” pipeline by stage, interviews this week, pending feedback to submit, time-to-fill, source effectiveness.
- **Hiring manager dashboard** — “My” open requisitions, candidates awaiting my review, my upcoming interviews, pending approvals (requisitions, job posting, offers).
- **Leadership dashboard** — Company-wide pipeline, headcount by department, open vs filled, average time-to-hire by department, offer acceptance rate, cost per hire, diversity metrics (using EEO data).

### 5.3 Workflow & Automation

- **Application acknowledgment** — Auto-send email when a candidate applies (or is added) to a job.
- **Reminders** — Recruiters: candidates in pipeline > N days with no movement; Interviewers: submit feedback within 24h.
- **Alerts** — Notify hiring manager when a candidate reaches final round (or offer stage).
- **Weekly pipeline summary** — Email or in-app digest for TA team / recruiters.

### 5.4 Templates

- **Job description template** — Reusable JD template (e.g. About Company, Role overview, Responsibilities, Qualifications, How to apply) used when creating jobs.
- **Offer letter template** — Document template with variables (candidate name, role, salary, start date, etc.) to generate offer letters.

### 5.5 Integrations

- **Calendar** — Use `calendarEventId` and integrate with Google Calendar / Outlook for interview scheduling and invites.
- **Recruiter auto-assign** — Rules (e.g. by department or workload) to assign recruiters to new applications or jobs.

### 5.6 Metrics

- **Time-to-fill** — Requisition approval date → offer acceptance (or hire).
- **Offer acceptance rate** — Accepted offers / Sent offers.
- **Conversion by stage** — Movement rates between pipeline stages.
- **Cost per hire** — If cost data is added later.
- **Diversity** — Dashboards/reports using EEO data (aggregated, anonymized where required).

---

## 6. Technical Stack & Tools

### 6.1 Runtime & Language

- **Node.js** — `>=20.0.0` (from root `package.json` engines).
- **TypeScript** — Used across `apps/web`, `packages/db`, `packages/shared` (^5.7.0).

### 6.2 Front End (apps/web)

| Category | Technology | Purpose |
|----------|------------|--------|
| Framework | **Next.js** (latest) | App Router, SSR, API routes, server actions |
| UI | **React** ^19.0.0 | Components |
| Styling | **Tailwind CSS** ^4.0 | Utility-first CSS; theme (light/dark), design tokens in `globals.css` |
| Icons | **lucide-react** | Icons across the app |
| Forms | **react-hook-form** + **@hookform/resolvers** | Form state and validation (Zod) |
| Validation | **zod** | Schemas and validation (shared and web) |
| State | **zustand** | Client state where needed |
| Data fetching | **@tanstack/react-query** ^5.0.0 | Client-side caching and server state (where used) |
| Drag and drop | **@dnd-kit/core**, **@dnd-kit/sortable**, **@dnd-kit/utilities** | Pipeline board (moving candidates between stages) |
| Dates | **date-fns** | Formatting and date logic |
| Toasts | **sonner** | Toast notifications |
| Utilities | **clsx**, **tailwind-merge**, **class-variance-authority** | Class names and variants |

### 6.3 Back End & Data (apps/web + packages/db)

| Category | Technology | Purpose |
|----------|------------|--------|
| ORM / DB | **Prisma** ^5.22.0 | Schema, migrations, type-safe client; used by Next.js API and server components |
| Database | **SQLite** (default) | Single file, zero extra setup for dev; schema supports switching to PostgreSQL for production |
| Auth | **NextAuth.js** ^4.24.0 | Credentials + optional Google; session, middleware |
| Password hashing | **bcryptjs** ^2.4.3 | For credentials provider |

### 6.4 Resume Parsing (root + apps/web)

| Category | Technology | Purpose |
|----------|------------|--------|
| PDF | **pdf-parse** ^2.4.5 | Extract text from PDF resumes (used in `lib/resume-parser.ts`) |
| Word | **mammoth** ^1.11.0 | Extract text from DOCX resumes |

Parsing is used in bulk upload to prefill candidate name, email, phone, experience, etc.

### 6.5 Monorepo & Build

| Category | Technology | Purpose |
|----------|------------|--------|
| Monorepo | **npm workspaces** | `apps/*`, `packages/*` |
| Tasks | **Turborepo** (latest) | `dev`, `build`, `lint` with caching and dependency ordering |
| Script runner | **tsx** (in db) | Run Prisma seed (TypeScript without pre-compile) |

### 6.6 Dev & Quality

| Category | Technology | Purpose |
|----------|------------|--------|
| Linting | **ESLint** + **eslint-config-next** | Next.js and React best practices |
| Font | **Inter** (Next.js `next/font/google`) | Primary UI font |

### 6.7 Deployment & Hosting

- No hosting is prescribed in the repo. The app runs as a **Node.js process** (Next.js); typical options: **Vercel**, **Railway**, **Render**, **Fly.io**, or any Node host. Database: SQLite for dev; production would typically use **PostgreSQL** (schema is compatible with a provider swap in Prisma).

---

## 7. Key Files Reference

| Purpose | Location |
|--------|----------|
| Prisma schema | `packages/db/prisma/schema.prisma` |
| Roles & permissions | `packages/shared/src/constants.ts` |
| Auth config | `apps/web/src/lib/auth.ts`, `apps/web/src/app/api/auth/[...nextauth]/route.ts` |
| Session & permission check | `apps/web/src/lib/get-session.ts` |
| Resume parsing | `apps/web/src/lib/resume-parser.ts` |
| Dashboard layout & sidebar | `apps/web/src/app/(dashboard)/layout.tsx`, `apps/web/src/components/layout/sidebar.tsx` |
| Middleware (protect dashboard) | `apps/web/src/middleware.ts` |

---

## 8. Summary

- **Vision:** Single, role-based ATS for the full hiring lifecycle (requisition → offer → onboarding), with approvals, pipelines, scorecards, and compliance.
- **Structure:** Monorepo (Turborepo): one Next.js app (`apps/web`), shared DB layer (`packages/db`), shared constants/types (`packages/shared`).
- **Current:** Jobs, candidates, applications, pipelines, interviews, scorecards, offers, requisitions, approvals, email templates, bulk resume upload, analytics, compliance, webhooks/API keys.
- **Next phase:** Recruiter assignment, talent pool, role-specific dashboards, automation/reminders, JD and offer letter templates, calendar integration, and more metrics (time-to-fill, offer acceptance, diversity).
- **Tech:** Next.js 16, React 19, Prisma, SQLite (dev), NextAuth, Tailwind, Zod, react-hook-form, @dnd-kit, mammoth/pdf-parse for resumes, Turborepo.
- **Prompts:** Development was guided by scoped, stepwise prompts (one ask per turn, file references, acceptance criteria). Section 3 includes principles and two sample prompts (feature with schema+UI, UI polish).
- **Functionality:** Section 4 describes current capabilities in detail by area (auth, dashboard, jobs, candidates, applications, interviews, offers, requisitions, analytics, settings, notifications, help, permissions).

This document should give a new reader a clear picture of how the project was envisioned, how it’s structured, what it does today, what can be done next, which libraries and tools are used, how prompts were structured, and detailed functionality by screen/flow.
