# Where We Are & Immediate Next Steps

Quick snapshot of progress and **low-risk next steps** that won’t break what’s working.

---

## What’s Done & Working

| Area | Status |
|------|--------|
| **Auth** | Login (credentials + optional Google), session, role in session, middleware protecting `/dashboard/*` |
| **Dashboard** | Home with counts (jobs, candidates, pipeline, interviews, offers), recent applications |
| **Jobs** | List, detail, create/edit, per-job pipeline board with drag-and-drop stage moves |
| **Candidates** | List, profile (applications, docs, notes, interviews, offer), add manually, bulk resume upload (PDF/DOCX) |
| **Applications & pipeline** | Create application (from job or candidate), move between stages, reject/withdraw/hire |
| **Interviews** | List, schedule (panelists, meeting link), submit scorecards |
| **Offers** | List, create, approval workflow, status (Draft → Sent → Accepted/Declined) |
| **Requisitions** | List, create, approvals |
| **Analytics** | Pipeline overview, source effectiveness, time-to-hire, time in stage, top jobs, export |
| **Settings** | Team, organization, email templates, webhooks, API keys, compliance (GPlayer Rating-style export/delete) |
| **Permissions** | Role-based (Super Admin, Admin, Recruiter, Hiring Manager, Interviewer, Limited); enforced in API and UI |
| **UX** | Light/dark theme, responsive layout, login polish (SA logo, demo one-click fill), header search spacing |
| **Docs** | PROJECT_OVERVIEW.md, SETUP_IDE_PYTHON.md, Word doc generator script |

**App runs at:** `http://localhost:3050` (dev server with `--hostname 0.0.0.0`).

**Known quirk:** Seed can fail at “Create sample job” (unique constraint) if the job already exists. Users/org/data up to that point are still created. Rest of the app is unaffected.

---

## Immediate Next Steps (Safe, Additive)

These are **additive or config-only**. They don’t change existing behavior for current flows.

### 1. Make seed idempotent (no breaking change)

- **What:** In `packages/db/src/seed.ts`, when creating the sample job, use **upsert** (or “find first, create only if not exists”) so re-running seed doesn’t fail.
- **Why:** Cleaner onboarding and demos; no impact on app at runtime.
- **Risk:** Very low; only seed script changes.

### 2. Recruiter assignment on applications (additive)

- **What:** Add optional `recruiterId` on `Application` (relation to `User`). Show “Assigned recruiter” on pipeline cards and allow assign/change (dropdown) for recruiters/admins. Keep existing behavior when unassigned.
- **Why:** Enables “my pipeline” later and clearer ownership.
- **Risk:** Low; new optional field and UI; no change to create/move logic.

### 3. Expected CTC & notice period on candidates (additive)

- **What:** Add optional fields `expectedCtc` and `noticePeriod` to `Candidate` (or store in `customFields` if you prefer). Show on candidate profile and in add/edit forms.
- **Why:** Aligns with [Company]-style ATS; useful for offer and planning.
- **Risk:** Low; optional fields only.

### 4. “My” dashboard filters (additive)

- **What:** On the main dashboard, add a **tab or toggle**: “All” (current view) vs “Mine”. For “Mine”: recruiters see applications where they’re assigned (once #2 exists) or all applications; HMs see jobs where they’re hiring manager and related applications. Default stays “All”.
- **Why:** First step toward role-specific dashboards without removing current behavior.
- **Risk:** Low; additive UI and queries; default unchanged.

### 5. Time-to-fill and offer acceptance in Analytics (additive)

- **What:** In Analytics, add two metrics: **Time-to-fill** (e.g. requisition approved → offer accepted, if data exists) and **Offer acceptance rate** (accepted / sent). Show “N/A” or 0 when no data.
- **Why:** Useful metrics; read-only, no change to offers or requisitions.
- **Risk:** Low; new calculations and display only.

### 6. Job description template (additive)

- **What:** New settings section or page: “Job description template” (e.g. rich text or sections: About us, Role overview, Responsibilities, Qualifications, How to apply). When creating a job, optional “Use template” that pre-fills description. Existing job create flow unchanged if user doesn’t use it.
- **Why:** Speeds up JD creation; no change to existing jobs.
- **Risk:** Low; new template store + optional prefill.

---

## What to Avoid for Now (to keep things stable)

- **Big auth or permission changes** — e.g. changing how roles or session work.
- **Changing pipeline or application move logic** — high impact if something goes wrong.
- **Removing or replacing existing APIs** that the UI already uses.
- **Automation/reminders** (emails, cron) until we’re ready to add and test background jobs properly.

---

## Suggested order

1. **Seed idempotent** (quick, no UX impact).  
2. **Recruiter assignment** (unblocks “my pipeline” and clearer ownership).  
3. **Expected CTC / notice period** (simple schema + profile/forms).  
4. **“My” dashboard** (depends on recruiter assignment for recruiters; HM filter can work immediately).  
5. **Analytics: time-to-fill + offer acceptance rate.**  
6. **JD template** (optional feature, no impact on existing flows).

If you say which one you want to do first, we can do it step by step without touching the rest.
