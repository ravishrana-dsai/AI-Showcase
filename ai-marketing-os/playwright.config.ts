import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './__tests__/e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:9010',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:9010',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
