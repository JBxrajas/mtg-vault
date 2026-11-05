import { defineConfig } from "@playwright/test";

// Browser checks for what jsdom cannot see: layout, stickiness, overlap, overflow. The API is mocked in each test
// (`e2e/support.ts`), so no server or database is needed. Run with `pnpm test:e2e`.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:5174", locale: "en-US" },
  projects: [
    { name: "phone", use: { browserName: "chromium", viewport: { width: 390, height: 800 } } },
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "pnpm --filter @mtg-vault/web exec vite --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
