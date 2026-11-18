import { defineConfig, devices } from "@playwright/test";

// E2E roda no CI (job e2e) contra `next start` com Postgres de serviço e dados de e2e/seed.ts.
export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", locale: "pt-BR" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "npm run start", url: "http://localhost:3000/login", reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
