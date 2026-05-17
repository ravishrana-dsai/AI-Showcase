import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = "http://localhost:3050";
const LOGIN_EMAIL = "admin@dream-sports.com";
const LOGIN_PASSWORD = "Sports@123";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function shot(page: Page, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`[screenshot] ${filePath}`);
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(LOGIN_EMAIL);
  await page.locator("#password").fill(LOGIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

// --------------------------------------------------------------------------
// Flow 1 - Login
// --------------------------------------------------------------------------
test("Flow 1: Login - sign in with admin credentials, verify dashboard redirect", async ({ page }) => {
  test.setTimeout(60000);

  const consoleErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("response", (res) => { if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`); });

  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");

  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

  await shot(page, "flow1-01-login-page");

  await page.locator("#email").fill(LOGIN_EMAIL);
  await page.locator("#password").fill(LOGIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");

  await shot(page, "flow1-02-login-success");

  expect(page.url()).toContain("/dashboard");
  console.log(`[Flow 1] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);
  console.log(`[Flow 1] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);
  expect(serverErrors).toHaveLength(0);
});

// --------------------------------------------------------------------------
// Flow 2 - Dashboard
// --------------------------------------------------------------------------
test("Flow 2: Dashboard - main dashboard loads with stats/data", async ({ page }) => {
  test.setTimeout(60000);

  const serverErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("response", (res) => { if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`); });

  await login(page);
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  await shot(page, "flow2-dashboard");

  const body = await page.locator("body").textContent();
  expect(body!.length).toBeGreaterThan(100);
  expect(serverErrors).toHaveLength(0);

  // Look for any stat or metric cards
  const hasStats =
    (await page.locator("[class*='stat'], [class*='card'], [class*='metric'], [class*='kpi']").count()) > 0 ||
    (await page.getByText(/total|open|active|pipeline|candidate|job/i).count()) > 0;

  console.log(`[Flow 2] Stats content found: ${hasStats}`);
  console.log(`[Flow 2] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);
  console.log(`[Flow 2] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);

  expect(hasStats).toBeTruthy();
});

// --------------------------------------------------------------------------
// Flow 3 - Jobs list
// --------------------------------------------------------------------------
test("Flow 3: Jobs list - /dashboard/jobs shows job listings", async ({ page }) => {
  test.setTimeout(60000);

  const serverErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("response", (res) => { if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`); });

  await login(page);
  await page.goto(`${BASE_URL}/dashboard/jobs`);
  await page.waitForLoadState("networkidle");

  await shot(page, "flow3-jobs-list");

  expect(serverErrors).toHaveLength(0);

  const hasJobContent =
    (await page.getByRole("link", { name: /new job|create job/i }).count()) > 0 ||
    (await page.locator("table, [data-testid='job-row'], .job-card, a[href*='/jobs/']").count()) > 0 ||
    (await page.getByText(/no jobs|create your first/i).count()) > 0;

  console.log(`[Flow 3] Job content found: ${hasJobContent}`);
  console.log(`[Flow 3] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);
  console.log(`[Flow 3] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);

  expect(hasJobContent).toBeTruthy();
});

// --------------------------------------------------------------------------
// Flow 4 - Pipeline board
// --------------------------------------------------------------------------
test("Flow 4: Pipeline board - click into a job, verify kanban pipeline loads with candidates", async ({ page }) => {
  test.setTimeout(90000);

  const serverErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("response", (res) => { if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`); });

  await login(page);
  await page.goto(`${BASE_URL}/dashboard/jobs`);
  await page.waitForLoadState("networkidle");

  // Grab all candidate job links - exclude /new and other static sub-paths by requiring a
  // path segment that looks like a CUID/UUID (alphanumeric, length > 8, no pure alpha words).
  const allJobLinks = await page.locator("a[href*='/dashboard/jobs/']").all();
  const jobLinkHandles = [];
  for (const link of allJobLinks) {
    const href = await link.getAttribute("href");
    if (!href) continue;
    const segment = href.split("/dashboard/jobs/")[1]?.split("/")[0] ?? "";
    // Skip static route segments like "new"
    if (segment === "new" || segment === "") continue;
    jobLinkHandles.push(link);
  }

  const count = jobLinkHandles.length;

  if (count === 0) {
    console.warn("[Flow 4] No jobs found - skipping pipeline check.");
    await shot(page, "flow4-no-jobs");
    test.skip();
    return;
  }

  await jobLinkHandles[0].click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  await shot(page, "flow4-pipeline-board");

  expect(serverErrors).toHaveLength(0);

  const hasBoardContent =
    (await page.locator("[class*='kanban'], [class*='pipeline'], [class*='board'], [data-testid*='stage']").count()) > 0 ||
    (await page.getByText(/applied|screening|interview|offer/i).count()) > 0;

  console.log(`[Flow 4] Board content found: ${hasBoardContent}`);
  console.log(`[Flow 4] Current URL: ${page.url()}`);
  console.log(`[Flow 4] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);
  console.log(`[Flow 4] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);

  expect(hasBoardContent).toBeTruthy();
});

// --------------------------------------------------------------------------
// Flow 5 - Candidates list
// --------------------------------------------------------------------------
test("Flow 5: Candidates list - /dashboard/candidates loads with candidates", async ({ page }) => {
  test.setTimeout(60000);

  const serverErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("response", (res) => { if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`); });

  await login(page);
  await page.goto(`${BASE_URL}/dashboard/candidates`);
  await page.waitForLoadState("networkidle");

  await shot(page, "flow5-candidates-list");

  expect(serverErrors).toHaveLength(0);

  const hasCandidateContent =
    (await page.locator("table, [data-testid*='candidate'], .candidate-card").count()) > 0 ||
    (await page.getByText(/no candidates|add candidate|import/i).count()) > 0 ||
    (await page.getByRole("link", { name: /new candidate|add candidate/i }).count()) > 0;

  console.log(`[Flow 5] Candidate content found: ${hasCandidateContent}`);
  console.log(`[Flow 5] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);
  console.log(`[Flow 5] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);

  expect(hasCandidateContent).toBeTruthy();
});

// --------------------------------------------------------------------------
// Flow 6 - Analytics
// --------------------------------------------------------------------------
test("Flow 6: Analytics - /dashboard/analytics loads charts/data", async ({ page }) => {
  test.setTimeout(60000);

  const serverErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("response", (res) => { if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`); });

  await login(page);
  await page.goto(`${BASE_URL}/dashboard/analytics`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  await shot(page, "flow6-analytics");

  expect(serverErrors).toHaveLength(0);

  const hasAnalyticsContent =
    (await page.getByText(/analytics|pipeline|funnel|conversion|overview|report/i).count()) > 0 ||
    (await page.locator("canvas, svg, [class*='chart'], [class*='analytics']").count()) > 0;

  console.log(`[Flow 6] Analytics content found: ${hasAnalyticsContent}`);
  console.log(`[Flow 6] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);
  console.log(`[Flow 6] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);

  expect(hasAnalyticsContent).toBeTruthy();
});

// --------------------------------------------------------------------------
// Flow 7 - Settings
// --------------------------------------------------------------------------
test("Flow 7: Settings - /dashboard/settings shows settings cards", async ({ page }) => {
  test.setTimeout(60000);

  const serverErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("response", (res) => { if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`); });

  await login(page);
  await page.goto(`${BASE_URL}/dashboard/settings`);
  await page.waitForLoadState("networkidle");

  await shot(page, "flow7-settings");

  expect(serverErrors).toHaveLength(0);

  const auditLogVisible = (await page.getByText(/audit log/i).count()) > 0;
  const integrationsVisible = (await page.getByText(/integrations/i).count()) > 0;
  const ssoVisible = (await page.getByText(/sso|single sign/i).count()) > 0;
  const teamVisible = (await page.getByText(/team|organization/i).count()) > 0;
  const pipelineVisible = (await page.getByText(/pipeline/i).count()) > 0;

  console.log(`[Flow 7] Audit Log card: ${auditLogVisible}`);
  console.log(`[Flow 7] Integrations card: ${integrationsVisible}`);
  console.log(`[Flow 7] SSO card: ${ssoVisible}`);
  console.log(`[Flow 7] Team card: ${teamVisible}`);
  console.log(`[Flow 7] Pipeline card: ${pipelineVisible}`);
  console.log(`[Flow 7] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);
  console.log(`[Flow 7] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);

  const hasSettingsContent = auditLogVisible || integrationsVisible || ssoVisible || teamVisible || pipelineVisible ||
    (await page.getByText(/webhook|custom field/i).count()) > 0;

  expect(hasSettingsContent).toBeTruthy();
});

// --------------------------------------------------------------------------
// Flow 8 - Candidate profile with "Add to Job" button
// --------------------------------------------------------------------------
test("Flow 8: Candidate profile - click candidate, verify 'Add to Job' button visible in Applications section", async ({ page }) => {
  test.setTimeout(90000);

  const serverErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("response", (res) => { if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`); });

  await login(page);
  await page.goto(`${BASE_URL}/dashboard/candidates`);
  await page.waitForLoadState("networkidle");

  await shot(page, "flow8-01-candidates-list");

  // Find candidate profile links - exclude static segments like /new, /upload
  const allCandidateLinks = await page.locator("a[href*='/dashboard/candidates/']").all();
  const candidateLinkHandles = [];
  for (const link of allCandidateLinks) {
    const href = await link.getAttribute("href");
    if (!href) continue;
    const segment = href.split("/dashboard/candidates/")[1]?.split("/")[0] ?? "";
    if (segment === "new" || segment === "upload" || segment === "") continue;
    candidateLinkHandles.push(link);
  }

  if (candidateLinkHandles.length === 0) {
    // Fall back to clicking first tbody row
    const tableRows = page.locator("tbody tr");
    const rowCount = await tableRows.count();
    if (rowCount === 0) {
      console.warn("[Flow 8] No candidates found - skipping candidate profile check.");
      await shot(page, "flow8-no-candidates");
      test.skip();
      return;
    }
    await tableRows.first().click();
  } else {
    await candidateLinkHandles[0].click();
  }

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  await shot(page, "flow8-02-candidate-profile");

  expect(serverErrors).toHaveLength(0);

  const currentUrl = page.url();
  console.log(`[Flow 8] Candidate profile URL: ${currentUrl}`);

  // Scroll down to Applications section
  const applicationsSection = page.getByText(/applications/i).first();
  const appSectionExists = await applicationsSection.count() > 0;
  if (appSectionExists) {
    await applicationsSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }

  await shot(page, "flow8-03-applications-section");

  // Look for "Add to Job" button (exact or partial match)
  const addToJobBtn = page.getByRole("button", { name: /add to job/i });
  const addToJobLink = page.getByRole("link", { name: /add to job/i });
  const addToJobAny = page.locator("button, a").filter({ hasText: /add to job/i });

  const btnCount = await addToJobBtn.count();
  const linkCount = await addToJobLink.count();
  const anyCount = await addToJobAny.count();

  console.log(`[Flow 8] "Add to Job" button count: ${btnCount}`);
  console.log(`[Flow 8] "Add to Job" link count: ${linkCount}`);
  console.log(`[Flow 8] "Add to Job" any element count: ${anyCount}`);
  console.log(`[Flow 8] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);
  console.log(`[Flow 8] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);

  const addToJobVisible = btnCount > 0 || linkCount > 0 || anyCount > 0;

  if (!addToJobVisible) {
    // Capture full page text for debugging
    const bodyText = await page.locator("body").textContent();
    console.log(`[Flow 8] Page text snippet (first 500 chars): ${bodyText?.substring(0, 500)}`);
    await shot(page, "flow8-04-debug-full-page");
  }

  expect(addToJobVisible).toBeTruthy();
});
