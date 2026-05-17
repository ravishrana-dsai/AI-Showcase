import { test, expect } from "@playwright/test";

const LOGIN_EMAIL = "admin@dream-sports.com";
const LOGIN_PASSWORD = "admin123";

const JOB_TITLE = `E2E Job ${Date.now()}`;
const APPLICANT_FIRST = "E2EFirst";
const APPLICANT_LAST = "E2ELast";
const APPLICANT_EMAIL = `e2e-${Date.now()}@example.com`;

test.describe("Hiring flow: create job → publish → apply with CV → verify in pipeline", () => {
  test("full flow", async ({ page }) => {
    test.setTimeout(60000);
    // 1. Login
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(LOGIN_EMAIL);
    await page.getByLabel(/password/i).fill(LOGIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("link", { name: /jobs/i }).first()).toBeVisible();

    // 2. Create job
    await page.goto("/dashboard/jobs/new");
    await page.getByPlaceholder(/e\.g\. senior full stack/i).fill(JOB_TITLE);
    await page
      .getByPlaceholder(/job description/i)
      .fill("<p>E2E test job description. Minimum length here.</p>");
    await page.getByRole("button", { name: /create job/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/jobs\/[^/]+$/);
    await expect(page.getByRole("heading", { name: JOB_TITLE })).toBeVisible();

    // 3. Publish to career site
    await page.getByRole("button", { name: /publish to career site/i }).click();
    await expect(page.getByRole("button", { name: /unpublish/i })).toBeVisible({ timeout: 10000 });

    // 4. Get job ID and apply from career site (same browser, public page)
    const jobDetailUrl = page.url();
    const jobId = jobDetailUrl.split("/jobs/")[1]?.split("/")[0] ?? "";
    expect(jobId).toBeTruthy();

    await page.goto(`/jobs/apply/${jobId}`);
    await expect(page.getByRole("heading", { name: new RegExp(JOB_TITLE, "i") })).toBeVisible();

    await page.getByLabel(/first name/i).fill(APPLICANT_FIRST);
    await page.getByLabel(/last name/i).fill(APPLICANT_LAST);
    await page.getByLabel(/email/i).fill(APPLICANT_EMAIL);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("e2e/fixtures/resume.txt");
    await page.getByRole("button", { name: /submit application/i }).click();

    await expect(page.getByText(/application submitted/i)).toBeVisible();

    // 5. Back to dashboard: verify candidate in pipeline
    await page.goto(jobDetailUrl);
    await expect(page.getByRole("heading", { name: JOB_TITLE })).toBeVisible();
    const fullName = `${APPLICANT_FIRST} ${APPLICANT_LAST}`;
    await expect(page.getByText(fullName).first()).toBeVisible({ timeout: 10000 });
  });
});
