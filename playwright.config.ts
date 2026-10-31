import { defineConfig } from "@playwright/test";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  use: {
    baseURL,
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "small-mobile",
      use: { viewport: { width: 320, height: 800 }, hasTouch: true },
    },
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    {
      name: "tablet",
      use: { viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    {
      name: "tablet-landscape",
      use: { viewport: { width: 1024, height: 768 }, hasTouch: true },
    },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/api/config`,
    reuseExistingServer: true,
    timeout: 120000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
