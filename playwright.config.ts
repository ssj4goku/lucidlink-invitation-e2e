import { defineConfig, devices } from '@playwright/test';
import { env } from './src/core/env';

/**
 * Worker count is bounded by workspace seats, not by CPU: the trial plan caps
 * the workspace at 10 members, and every worker holds one invitee identity.
 * Raise it only alongside INVITEE_EMAILS.
 */
const WORKERS = Number(process.env.PW_WORKERS ?? 2);

export default defineConfig({
  testDir: './src/tests',
  outputDir: './test-results',

  fullyParallel: true,
  workers: WORKERS,
  forbidOnly: env.CI,
  retries: env.CI ? 2 : 0,

  timeout: 90_000,
  expect: { timeout: 15_000 },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'reports/html' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
  ],

  use: {
    baseURL: env.BASE_URL,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      // Clears invites orphaned by an aborted run before seats run out.
      name: 'sweep',
      testMatch: /sweep\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      dependencies: ['sweep'],
      testIgnore: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Only the one real-clipboard test needs these; every other test uses
        // the writeText capture, which needs no permission at all.
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
  ],
});
