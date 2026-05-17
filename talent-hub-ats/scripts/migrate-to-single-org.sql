-- =============================================================
-- Migration: Single-Org + Demo Org Separation
-- Run on PRODUCTION before (or right after) deploying new code.
-- Safe to run multiple times — uses IF EXISTS / ON CONFLICT.
-- =============================================================

-- ── 1. Rename dream-sports → dreamplayai ─────────────────────
UPDATE organizations
SET name = '[Company] AI', slug = 'dreamplayai'
WHERE slug = 'dream-sports';

-- ── 2. Ensure Ravish is SUPER_ADMIN ──────────────────────────
UPDATE users
SET role = 'SUPER_ADMIN'
WHERE email IN ('ravish.rana@dream11.com', 'ravish.rana@dreamplayai.com');

-- ── 3. Remove __platform__ org and its users ─────────────────
DELETE FROM users
WHERE organization_id = (
  SELECT id FROM organizations WHERE slug = '__platform__'
);
DELETE FROM organizations WHERE slug = '__platform__';

-- ── 4. Create Demo org if it does not exist ──────────────────
INSERT INTO organizations (id, name, slug, industry, size, website, settings, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  'Demo Organization',
  'demo',
  'Technology',
  '1-10',
  'https://dreamplayai.com',
  '{"timezone":"Asia/Kolkata","dateFormat":"DD/MM/YYYY"}',
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- ── 5. Move demo accounts into the demo org ──────────────────
UPDATE users
SET organization_id = (SELECT id FROM organizations WHERE slug = 'demo')
WHERE email IN (
  'recruiter@dreamplayai.com',
  'manager@dreamplayai.com',
  'interviewer@dreamplayai.com'
);

-- ── 6. Remove stale @dream-sports.com / @[company-domain]m users ─
--      Clear RESTRICT-constrained FK references first, then delete.

-- 6a. Clear approvals and scorecards pointing to stale users
DELETE FROM requisition_approvals
WHERE approver_id IN (
  SELECT id FROM users
  WHERE email NOT IN (
    'ravish.rana@dream11.com',
    'recruiter@dreamplayai.com',
    'manager@dreamplayai.com',
    'interviewer@dreamplayai.com'
  )
);

DELETE FROM job_posting_approvals
WHERE approver_id IN (
  SELECT id FROM users
  WHERE email NOT IN (
    'ravish.rana@dream11.com',
    'recruiter@dreamplayai.com',
    'manager@dreamplayai.com',
    'interviewer@dreamplayai.com'
  )
);

DELETE FROM offer_approvals
WHERE approver_id IN (
  SELECT id FROM users
  WHERE email NOT IN (
    'ravish.rana@dream11.com',
    'recruiter@dreamplayai.com',
    'manager@dreamplayai.com',
    'interviewer@dreamplayai.com'
  )
);

DELETE FROM scorecards
WHERE reviewer_id IN (
  SELECT id FROM users
  WHERE email NOT IN (
    'ravish.rana@dream11.com',
    'recruiter@dreamplayai.com',
    'manager@dreamplayai.com',
    'interviewer@dreamplayai.com'
  )
);

DELETE FROM activity_log
WHERE actor_id IN (
  SELECT id FROM users
  WHERE email NOT IN (
    'ravish.rana@dream11.com',
    'recruiter@dreamplayai.com',
    'manager@dreamplayai.com',
    'interviewer@dreamplayai.com'
  )
);

-- 6b. Null out nullable FK references on jobs/applications
UPDATE jobs SET hiring_manager_id = NULL
WHERE hiring_manager_id IN (
  SELECT id FROM users
  WHERE email NOT IN (
    'ravish.rana@dream11.com',
    'recruiter@dreamplayai.com',
    'manager@dreamplayai.com',
    'interviewer@dreamplayai.com'
  )
);

UPDATE applications SET recruiter_id = NULL
WHERE recruiter_id IN (
  SELECT id FROM users
  WHERE email NOT IN (
    'ravish.rana@dream11.com',
    'recruiter@dreamplayai.com',
    'manager@dreamplayai.com',
    'interviewer@dreamplayai.com'
  )
);

-- 6c. Delete jobs/data whose non-nullable creator is a stale user
--     (these are demo jobs from the old era — safe to purge)
DELETE FROM scorecards
WHERE application_id IN (
  SELECT a.id FROM applications a
  JOIN jobs j ON j.id = a.job_id
  JOIN organizations o ON o.id = j.organization_id
  WHERE o.slug = 'dreamplayai'
);

DELETE FROM offer_approvals
WHERE offer_id IN (
  SELECT off.id FROM offers off
  JOIN applications a ON a.id = off.application_id
  JOIN jobs j ON j.id = a.job_id
  JOIN organizations o ON o.id = j.organization_id
  WHERE o.slug = 'dreamplayai'
);

DELETE FROM offers
WHERE application_id IN (
  SELECT a.id FROM applications a
  JOIN jobs j ON j.id = a.job_id
  JOIN organizations o ON o.id = j.organization_id
  WHERE o.slug = 'dreamplayai'
);

DELETE FROM interview_panelists
WHERE interview_id IN (
  SELECT i.id FROM interviews i
  JOIN applications a ON a.id = i.application_id
  JOIN jobs j ON j.id = a.job_id
  JOIN organizations o ON o.id = j.organization_id
  WHERE o.slug = 'dreamplayai'
);

DELETE FROM interviews
WHERE application_id IN (
  SELECT a.id FROM applications a
  JOIN jobs j ON j.id = a.job_id
  JOIN organizations o ON o.id = j.organization_id
  WHERE o.slug = 'dreamplayai'
);

DELETE FROM applications
WHERE job_id IN (
  SELECT j.id FROM jobs j
  JOIN organizations o ON o.id = j.organization_id
  WHERE o.slug = 'dreamplayai'
);

DELETE FROM jobs
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dreamplayai');

DELETE FROM candidates
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dreamplayai');

DELETE FROM requisitions
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dreamplayai');

DELETE FROM departments
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dreamplayai');

DELETE FROM pipeline_templates
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'dreamplayai');

-- 6d. Delete the stale users (accounts/sessions/notifications cascade automatically)
DELETE FROM users
WHERE email NOT IN (
  'ravish.rana@dream11.com',
  'recruiter@dreamplayai.com',
  'manager@dreamplayai.com',
  'interviewer@dreamplayai.com'
);

-- ── 7. Verify ────────────────────────────────────────────────
SELECT name, slug FROM organizations ORDER BY created_at;
SELECT email, role, (SELECT slug FROM organizations WHERE id = users.organization_id) AS org
FROM users
ORDER BY email;
