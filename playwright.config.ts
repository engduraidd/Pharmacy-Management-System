import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env', quiet: true });

export default defineConfig({
  testDir: './tests/e2e', workers: 1, timeout: 60_000, reporter: 'list',
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true,
    viewport: { width: 1440, height: 960 }, trace: 'off', screenshot: 'off', video: 'off',
  },
});
