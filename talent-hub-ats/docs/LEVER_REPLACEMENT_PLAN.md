# Plan: Replacing Lever with SportsAI Hiring (Talent Hub)

This document maps **Lever ATS**-style capabilities to what we have today and what remains to build so Talent Hub can fully replace Lever for core recruiting workflows.

---

## Lever at a glance

Lever combines **ATS** (applicant tracking) with **CRM** (candidate relationship management): jobs, pipelines, candidates, scheduling, scorecards, offers, analytics, compliance, and integrations. Key areas: automated sourcing/workflows, bulk actions, advanced analytics, career site / job board, calendar sync, 300+ integrations, DEI reporting.

---

## What we already have (done)

| Area | Status | Notes |
|------|--------|--------|
| **Jobs** | Done | CRUD, pipeline stages per job, screening questions, edit, publish/close |
| **Candidates** | Done | Add manual, bulk upload, search, profile, notes, EEO form |
| **Applications & pipeline** | Done | Per-job pipeline board, drag-and-drop stage move, stage history, activity log |
| **Interviews** | Done | Schedule (panel, type, time, link), list, My Interviews, interview detail page, scorecards / feedback (org options) |
| **Offers** | Done | Create, approve, SENT only in Offer stage, accept/decline, hired transition |
| **Requisitions** | Done | Create, approval flow |
| **Dashboard** | Done | Counts, recent applications, role-based (interviewer → My Interviews) |
| **Analytics** | Done | Pipeline overview, source effectiveness, time in stage, time-to-hire, time-to-fill, offer acceptance, export |
| **Email templates** | Done | Create, **edit**, **delete**, list; variables (e.g. `{{candidateName}}`) |
| **Send email** | Done | From candidate profile using templates |
| **Notifications** | Done | Bell; events: interview scheduled, stage moved, offer sent/accepted/declined |
| **Settings** | Done | Organization, team, interview feedback options, job description template, demo data, webhooks (config), API keys, compliance hub |
| **Compliance** | Done | EEO/EEOC aggregates, audit log, GPlayer Rating delete page |
| **Auth & roles** | Done | Login, roles (Admin, Recruiter, Interviewer, etc.), permission checks |
| **Public API** | Done | v1 jobs/candidates (and webhooks config) for integrations |
| **Career site** | Done | Public `/jobs` (list open jobs), `/jobs/apply/[jobId]` (apply form → candidate + application) |
| **Send email from more places** | Done | Pipeline card (mail icon), interview detail (Send invite), offers list (mail icon); templates + optional initial body/subject |
| **Webhook delivery** | Done | `lib/webhooks.ts` fires on `application.stage_changed`, `offer.created`, `offer.sent`, `offer.accepted`, `offer.declined`, `interview.scheduled`; logs to WebhookDelivery |

---

## What we still need to do (prioritized)

### High priority (core Lever parity)

1. **Compliance: Export Data (CSV)**  
   - **Gap:** Settings → Compliance has a link to “Export Data (CSV)” but the route `dashboard/settings/compliance/export` does not exist.  
   - **Build:** Add `dashboard/settings/compliance/export/page.tsx`; trigger CSV export of candidates/applications (and optionally audit the export). Wire the existing compliance page link to this route (or to existing `api/export` with correct type/filters).

2. **Webhook delivery**  
   - **Done.** `lib/webhooks.ts`: loads org webhooks for event, POSTs JSON with `X-Webhook-Signature` (HMAC-SHA256), logs to WebhookDelivery. Fired from applications/move, offers/create, offers/[id]/status, interviews/create. Events: `application.stage_changed`, `offer.created`, `offer.sent`, `offer.accepted`, `offer.declined`, `interview.scheduled`.

3. **Calendar sync (optional but expected)**  
   - **Gap:** No calendar integration; interviews are manual.  
   - **Build:** Optional sync with Google Calendar / Outlook: create/update calendar events when an interview is scheduled or rescheduled, and optionally show “Add to calendar” link. Requires OAuth and event write.

### Medium priority (better parity and polish)

4. **Bulk re-engage / nurture (Lever-style)**  
   - **Gap:** We have bulk actions (e.g. move stage, archive) but no “re-apply to job” or “add to nurture campaign” from archive.  
   - **Build:** Bulk action: “Re-apply to job” (create new application from archived candidate for a chosen job). Optionally: simple “nurture” tag or list and basic email sequence later.

5. **Career site / job board**  
   - **Done.** Public `/jobs` (list), `/jobs/apply/[jobId]` (apply form). API: `GET /api/public/jobs`, `POST /api/public/jobs/apply`.

6. **Scheduling automation**  
   - **Gap:** Interview scheduling is manual (pick time, link).  
   - **Build:** “Send scheduling link” flow: candidate gets a link to pick a slot; when they choose, interview is created and notifications sent (or integrate with Calendly/Cal.com and create interview from webhook).

7. **Email sending from more places**  
   - **Gap:** Send email today is from candidate profile only.  
   - **Build:** Use templates from pipeline (e.g. “Send rejection” from stage), from interview (e.g. “Send invite” with meeting link), and from offer (e.g. “Send offer letter”); log to EmailLog and optionally trigger webhook.

### Lower priority (Lever “nice to have”)

8. **Recruitment marketing / campaigns**  
   - Nurture campaigns, drip emails, source tagging for campaigns.  
   - **Build:** Tag-based segments, simple campaign (name + template + schedule), and “Add to campaign” from candidate list.

9. **Advanced analytics**  
   - Lever has predictive analytics and more dashboards.  
   - **Build:** More breakdowns (by department, by recruiter), forecasts (e.g. hires per month), diversity funnel (EEO by stage).

10. **Integrations**  
    - Lever has 300+ integrations.  
    - **Build:** Prioritize: LinkedIn (profile import), Slack (notify on new application / offer accepted), Greenhouse/Jazz sync if needed. Our webhooks + public API already allow custom integrations.

11. **AI interview companion**  
    - Lever offers AI interview tools.  
    - **Build:** Out of scope for “replace Lever” MVP; can be a later phase.

---

## Summary checklist

| # | Item | Priority |
|---|------|----------|
| 1 | Compliance Export Data (CSV) page + link | High |
| 2 | Webhook delivery on key events | High |
| 3 | Calendar sync (Google/Outlook) | High (optional) |
| 4 | Bulk “Re-apply to job” / nurture | Medium |
| 5 | Career site + apply flow | Medium |
| 6 | Scheduling automation (candidate self-serve) | Medium |
| 7 | Send email from pipeline / interview / offer | Medium |
| 8 | Nurture campaigns | Low |
| 9 | Advanced analytics | Low |
| 10 | Key integrations (Slack, LinkedIn, etc.) | Low |

---

## Suggested order of implementation

1. **Compliance export** — Small, closes a broken link and delivers promised compliance.  
2. **Webhook delivery** — Makes existing webhook config useful; unblocks integrations.  
3. **Career site + apply** — Enables “post job → candidates apply” without manual add.  
4. **Send email from pipeline / interview / offer** — Uses existing templates in more places.  
5. **Calendar sync** — High perceived value for interviewers.  
6. **Scheduling automation** — Reduces back-and-forth; can start with Cal.com/Calendly webhook.  
7. Rest as needed for your roadmap.

This plan is a living doc: update the “What we already have” and “What we still need” sections as features ship.
