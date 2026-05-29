import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    viewport: { width: 390, height: 844 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Starts the dev server automatically before E2E tests.
  // Use `reuseExistingServer: true` so running `npm run dev` manually also works.
  webServer: {
    command: 'PLAYWRIGHT=1 npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: process.env.PW_REUSE_SERVER === '1',
    timeout: 30_000,
  },
});
