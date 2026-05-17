import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = "http://localhost:3050";
const LOGIN_EMAIL = "admin@dream-sports.com";
const LOGIN_PASSWORD = "admin123";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

// Ensure screenshot dir exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function screenshotStep(page: Page, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`Screenshot saved: ${filePath}`);
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(LOGIN_EMAIL);
  await page.locator("#password").fill(LOGIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

test.describe("Talent Hub ATS - Comprehensive E2E Check", () => {
  test.setTimeout(120000);

  // -----------------------------------------------------------------------
  // Flow 1: Login
  // -----------------------------------------------------------------------
  test("Flow 1: Login - navigate to /login, sign in, verify redirect", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      if (res.status() >= 500) consoleErrors.push(`HTTP ${res.status()}: ${res.url()}`);
    });

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    // Verify login page renders
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

    await screenshotStep(page, "01-login-page");

    // Fill credentials and submit
    await page.locator("#email").fill(LOGIN_EMAIL);
    await page.locator("#password").fill(LOGIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should redirect to /dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    await screenshotStep(page, "01-login-success");

    expect(page.url()).toContain("/dashboard");
    console.log(`[Flow 1] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);
    if (consoleErrors.length > 0) {
      console.warn("[Flow 1] Console errors found:", consoleErrors);
    }
  });

  // -----------------------------------------------------------------------
  // Flow 2: Dashboard
  // -----------------------------------------------------------------------
  test("Flow 2: Dashboard - verify stats/data loads without errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`);
    });

    await login(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");

    await screenshotStep(page, "02-dashboard");

    // Dashboard should have some content (not a blank page)
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(100);

    // No 500 errors
    expect(serverErrors).toHaveLength(0);
    console.log(`[Flow 2] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);
    console.log(`[Flow 2] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);
  });

  // -----------------------------------------------------------------------
  // Flow 3: Jobs list
  // -----------------------------------------------------------------------
  test("Flow 3: Jobs list - /dashboard/jobs shows job listings", async ({ page }) => {
    const consoleErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`);
    });

    await login(page);
    await page.goto(`${BASE_URL}/dashboard/jobs`);
    await page.waitForLoadState("networkidle");

    await screenshotStep(page, "03-jobs-list");

    // Page should load (no 500 errors)
    expect(serverErrors).toHaveLength(0);

    // Should show jobs or "no jobs" state (not an error page)
    const body = await page.locator("body").textContent();
    expect(body!.length).toBeGreaterThan(50);

    // Check for job-related content: either a list of jobs OR a "create job" / empty-state message
    const hasJobContent =
      (await page.getByRole("link", { name: /new job|create job/i }).count()) > 0 ||
      (await page.locator("table, [data-testid='job-row'], .job-card, [href*='/jobs/']").count()) > 0 ||
      (await page.getByText(/no jobs|create your first/i).count()) > 0;

    expect(hasJobContent).toBeTruthy();
    console.log(`[Flow 3] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);
    console.log(`[Flow 3] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);
  });

  // -----------------------------------------------------------------------
  // Flow 4: Pipeline board
  // -----------------------------------------------------------------------
  test("Flow 4: Pipeline board - click into a job, verify kanban board loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`);
    });

    await login(page);
    await page.goto(`${BASE_URL}/dashboard/jobs`);
    await page.waitForLoadState("networkidle");

    // Find first job link (href matching /dashboard/jobs/<id>)
    const jobLinks = page.locator("a[href*='/dashboard/jobs/']");
    const jobLinkCount = await jobLinks.count();

    if (jobLinkCount === 0) {
      console.warn("[Flow 4] No jobs found - skipping pipeline board check (no seed data)");
      await screenshotStep(page, "04-pipeline-no-jobs");
      test.skip();
      return;
    }

    // Click first job
    await jobLinks.first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000); // allow board to render

    await screenshotStep(page, "04-pipeline-board");

    // Pipeline board or job detail page should load
    expect(serverErrors).toHaveLength(0);

    const body = await page.locator("body").textContent();
    expect(body!.length).toBeGreaterThan(100);

    // Check for board/pipeline-related content
    const hasBoardContent =
      (await page.locator("[class*='kanban'], [class*='pipeline'], [class*='board'], [data-testid*='stage']").count()) > 0 ||
      (await page.getByText(/applied|screening|interview|offer|pipeline/i).count()) > 0;

    console.log(`[Flow 4] Board content found: ${hasBoardContent}`);
    console.log(`[Flow 4] URL: ${page.url()}`);
    console.log(`[Flow 4] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);
    console.log(`[Flow 4] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);

    expect(hasBoardContent).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // Flow 5: Candidates list
  // -----------------------------------------------------------------------
  test("Flow 5: Candidates list - /dashboard/candidates loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`);
    });

    await login(page);
    await page.goto(`${BASE_URL}/dashboard/candidates`);
    await page.waitForLoadState("networkidle");

    await screenshotStep(page, "05-candidates-list");

    expect(serverErrors).toHaveLength(0);

    const body = await page.locator("body").textContent();
    expect(body!.length).toBeGreaterThan(50);

    // Should show candidates, a table, or an empty state
    const hasCandidateContent =
      (await page.locator("table, [data-testid*='candidate'], .candidate-card").count()) > 0 ||
      (await page.getByText(/no candidates|add candidate|import/i).count()) > 0 ||
      (await page.getByRole("link", { name: /new candidate|add candidate/i }).count()) > 0;

    console.log(`[Flow 5] Candidate content found: ${hasCandidateContent}`);
    console.log(`[Flow 5] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);
    console.log(`[Flow 5] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);

    expect(hasCandidateContent).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // Flow 6: Analytics
  // -----------------------------------------------------------------------
  test("Flow 6: Analytics - /dashboard/analytics loads without 500 errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`);
    });

    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState("networkidle");
    // Give charts time to render
    await page.waitForTimeout(1500);

    await screenshotStep(page, "06-analytics");

    expect(serverErrors).toHaveLength(0);

    const body = await page.locator("body").textContent();
    expect(body!.length).toBeGreaterThan(50);

    // Should have analytics-related content
    const hasAnalyticsContent =
      (await page.getByText(/analytics|pipeline|funnel|conversion|overview/i).count()) > 0 ||
      (await page.locator("canvas, svg, [class*='chart'], [class*='analytics']").count()) > 0;

    console.log(`[Flow 6] Analytics content found: ${hasAnalyticsContent}`);
    console.log(`[Flow 6] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);
    console.log(`[Flow 6] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);

    expect(hasAnalyticsContent).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // Flow 7: Settings
  // -----------------------------------------------------------------------
  test("Flow 7: Settings - /dashboard/settings shows settings cards", async ({ page }) => {
    const consoleErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`);
    });

    await login(page);
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForLoadState("networkidle");

    await screenshotStep(page, "07-settings");

    expect(serverErrors).toHaveLength(0);

    // Check for specific settings cards mentioned in the task
    const auditLogVisible = (await page.getByText(/audit log/i).count()) > 0;
    const integrationsVisible = (await page.getByText(/integrations/i).count()) > 0;
    const ssoVisible = (await page.getByText(/sso|single sign/i).count()) > 0;

    console.log(`[Flow 7] Audit Log card: ${auditLogVisible}`);
    console.log(`[Flow 7] Integrations card: ${integrationsVisible}`);
    console.log(`[Flow 7] SSO card: ${ssoVisible}`);
    console.log(`[Flow 7] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);
    console.log(`[Flow 7] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);

    // At minimum, settings page should have some meaningful content
    const hasSettingsContent = auditLogVisible || integrationsVisible || ssoVisible ||
      (await page.getByText(/organization|team|pipeline|webhook/i).count()) > 0;

    expect(hasSettingsContent).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // Flow 8: Audit Logs
  // -----------------------------------------------------------------------
  test("Flow 8: Audit Logs - /dashboard/settings/audit-logs viewer loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      if (res.status() >= 500) serverErrors.push(`HTTP ${res.status()}: ${res.url()}`);
    });

    await login(page);
    await page.goto(`${BASE_URL}/dashboard/settings/audit-logs`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await screenshotStep(page, "08-audit-logs");

    // Critical: no 500 errors
    expect(serverErrors).toHaveLength(0);

    const body = await page.locator("body").textContent();
    expect(body!.length).toBeGreaterThan(50);

    // Should show audit log UI
    const hasAuditContent =
      (await page.getByText(/audit log/i).count()) > 0 ||
      (await page.getByText(/action|user|timestamp|event/i).count()) > 0 ||
      (await page.locator("table, [data-testid*='audit']").count()) > 0 ||
      (await page.getByText(/no logs|no events|no audit/i).count()) > 0;

    console.log(`[Flow 8] Audit log content found: ${hasAuditContent}`);
    console.log(`[Flow 8] URL: ${page.url()}`);
    console.log(`[Flow 8] Console errors: ${consoleErrors.length > 0 ? consoleErrors.join("; ") : "none"}`);
    console.log(`[Flow 8] Server errors: ${serverErrors.length > 0 ? serverErrors.join("; ") : "none"}`);

    expect(hasAuditContent).toBeTruthy();
  });
});
