# End-to-end test checklist

Use this to verify the full hiring flow: **create job → publish → apply (with CV) → schedule interview → feedback → offer → accept**.

**Prerequisites:** App running (`npm run dev`), database seeded (`npm run db:seed`). Log in as **Admin** or **Recruiter** for dashboard steps.

---

## 1. Create a new job

- [ ] **Dashboard** → **Jobs** → **Create Job**
- [ ] Fill: Title, Description (min 10 chars), optional Requirements/Benefits, Employment type, etc.
- [ ] Save → job opens in **DRAFT**
- [ ] On job detail page, click **Publish to career site** → status becomes **OPEN**
- [ ] Confirm job appears on public **Career site** (sidebar **Career site** → `/jobs`)

---

## 2. Apply from career site (with CV upload)

- [ ] Open **Career site** (`/jobs`) in browser (or incognito)
- [ ] Click the job you published → **Apply** (`/jobs/apply/[jobId]`)
- [ ] Fill: First name, Last name, Email (required); Phone, LinkedIn, Summary optional
- [ ] **Upload CV:** Choose a PDF or DOCX (max 10MB)
- [ ] Submit → see “Application submitted”
- [ ] **Dashboard** → **Jobs** → open that job → pipeline: new candidate in **New** stage
- [ ] **Dashboard** → **Candidates** → open the candidate → **Documents** shows the uploaded CV

---

## 3. Move candidate & schedule interview

- [ ] On **job detail** pipeline, drag the candidate to **Screen** (or **Interview**) stage
- [ ] **Dashboard** → **Interviews** → schedule an interview (or from job/candidate flow)
- [ ] Set: Title, Application (select this candidate’s application), Date/time, Duration, optional Meeting link, add **Panelists** (e.g. an Interviewer user)
- [ ] Save
- [ ] **Dashboard** → **My Interviews** (as that interviewer): interview appears; or **Interviews** list shows it
- [ ] Open **Interview detail** (`/dashboard/interviews/[id]`) → details and “Send invite email” work

---

## 4. Submit interview feedback

- [ ] As **Interviewer**, go to **My Interviews**
- [ ] Find the completed (or past) interview → **Give feedback**
- [ ] Choose Recommendation (e.g. Proceed / Reject), add notes, Submit
- [ ] Or open **Interview detail** and use the inline feedback form
- [ ] Confirm “Feedback submitted” (or scorecard visible)

---

## 5. Move to Offer & create offer

- [ ] As **Recruiter/Admin**, open the **job** → pipeline
- [ ] Drag candidate to **Offer** stage
- [ ] **Dashboard** → **Candidates** → open candidate → **Create offer** (or from Offers if linked)
- [ ] Fill: Title, Salary, Currency, Period, optional Start date, Expiry
- [ ] Save → offer created (e.g. APPROVED or PENDING_APPROVAL depending on your config)

---

## 6. Mark offer sent & accept

- [ ] **Dashboard** → **Offers** → find the offer
- [ ] Use **Offer actions** → set status to **SENT** (only allowed when application is in Offer stage)
- [ ] Set status to **ACCEPTED**
- [ ] Confirm application shows **HIRED** and candidate/offer state is updated
- [ ] Check **Notifications** (bell): offer sent / offer accepted

---

## 7. Quick sanity checks

- [ ] **Career site** link in sidebar opens `/jobs` in new tab
- [ ] **Email:** From pipeline card (mail icon), interview detail (“Send invite”), or offer row (mail icon) → Send Email modal works
- [ ] **Webhooks:** If configured, trigger a stage move or offer status change and confirm delivery (Settings → Webhooks or delivery log)

---

## Notes

- **Demo data:** With seed data, some jobs are already OPEN; you can use those for “apply + CV” without creating a job.
- **Roles:** Use **Interviewer** only for My Interviews and feedback; use **Recruiter** or **Admin** for jobs, pipeline, scheduling, offers.

## Automated E2E test

A Playwright test covers the same flow (create job → publish → apply with CV → verify in pipeline).

- **Run:** From repo root or `apps/web`:  
  `cd apps/web && npm run test:e2e`
- **Prerequisites:** Database seeded (`npm run db:seed` from root). Dev server can be already running on port 3050 (tests reuse it), or Playwright will start it.
- **Browsers:** Uses Chromium and Firefox. Browsers are installed into the repo (`node_modules/playwright-core/.local-browsers`). To install or reinstall:  
  `cd apps/web && PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install`  
  The test script sets `PLAYWRIGHT_BROWSERS_PATH` so the same browsers are used when you run `npm run test:e2e`.
- **UI mode:** `npm run test:e2e:ui` for step-through debugging.
