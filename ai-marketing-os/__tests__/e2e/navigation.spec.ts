import { test, expect } from '@playwright/test'

test.describe('Sidebar navigation', () => {
  test('redirects root to /dashboard/context', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard\/context/)
  })

  test('sidebar renders [Company] branding', async ({ page }) => {
    await page.goto('/dashboard/context')
    await expect(page.getByText('[Company]')).toBeVisible()
  })

  test('all 11 tab links are present in the sidebar', async ({ page }) => {
    await page.goto('/dashboard/brand-identity')
    const tabLabels = [
      'Context Input',
      'Brand Identity',
      'Social Content',
      'Campaign Builder',
      'Intelligence',
      'Influencer CRM',
      'SEO & GSO',
      'Email & WhatsApp',
      'Tournament Engine',
      'Court Partner',
      'Analytics',
    ]
    for (const label of tabLabels) {
      await expect(page.getByText(label)).toBeVisible()
    }
  })

  test('clicking a sidebar link navigates to the correct tab', async ({ page }) => {
    await page.goto('/dashboard/context')
    await page.getByRole('link', { name: /Brand Identity/i }).click()
    await expect(page).toHaveURL(/\/dashboard\/brand-identity/)
    await expect(page.getByRole('heading', { name: /Brand Identity/i })).toBeVisible()
  })
})
