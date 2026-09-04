import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [
    ['html', { open: 'never', outputFolder: 'apps/tasks/playwright-report' }],
    ['list'],
  ],
  outputDir: 'apps/tasks/test-results',
  use: {
    baseURL: 'http://127.0.0.1:4003',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'cd apps/tasks && bunx expo start --web --port 4003 --non-interactive',
    port: 4003,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      EXPO_NO_TELEMETRY: '1',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
