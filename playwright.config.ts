import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// In the cloud dev container Chromium is pre-installed at /opt/pw-browsers/chromium.
// On CI (GitHub Actions) `playwright install chromium` provides the browser instead.
const localChromium =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 960, height: 540 },
    headless: true,
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: localChromium,
      args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: 'pnpm exec vite --port 5173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
