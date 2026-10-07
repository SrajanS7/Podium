import { defineConfig } from '@playwright/test';

// End-to-end tests run against the production build (npm run build first).
export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: 'http://localhost:4173',
    // Use a locally installed Chromium if provided (CI / sandbox), otherwise Playwright's own
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
});
