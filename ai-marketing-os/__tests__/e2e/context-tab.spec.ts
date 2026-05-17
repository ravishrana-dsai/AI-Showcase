import { test, expect } from '@playwright/test'

test.describe('Context Input tab (Tab 00)', () => {
  test('loads and renders context fields', async ({ page }) => {
    await page.goto('/dashboard/context')
    await expect(page.getByRole('heading', { name: /Context Input/i })).toBeVisible()
    // Should show at least one input field for brand context
    const inputs = page.locator('input, textarea')
    await expect(inputs.first()).toBeVisible()
  })

  test('Save button is present', async ({ page }) => {
    await page.goto('/dashboard/context')
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
  })
})
