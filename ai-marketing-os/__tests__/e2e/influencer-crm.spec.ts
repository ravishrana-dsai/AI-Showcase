import { test, expect } from '@playwright/test'

test.describe('Influencer CRM tab (Tab 05)', () => {
  test('loads two-panel layout', async ({ page }) => {
    await page.goto('/dashboard/influencer-crm')
    await expect(page.getByRole('heading', { name: /Influencer/i })).toBeVisible()
  })

  test('Add contact button is present', async ({ page }) => {
    await page.goto('/dashboard/influencer-crm')
    await expect(
      page.getByRole('button', { name: /add/i }).or(page.getByText(/new contact/i))
    ).toBeVisible()
  })
})
