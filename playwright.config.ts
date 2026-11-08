import { defineConfig } from "@playwright/test";
const studio = process.env.STUDIO_REPO;
if (!studio)
  throw Error("STUDIO_REPO must identify the actual candidate host checkout");
export default defineConfig({
  testDir: "./e2e",
  timeout: 90000,
  expect: { timeout: 20000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: ".artifacts/playwright-report", open: "never" }],
    ["json", { outputFile: ".artifacts/evidence/browser.json" }],
  ],
  outputDir: ".artifacts/browser",
  use: {
    baseURL: "http://localhost:4179",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    cwd: studio,
    command: "pnpm nx run sva-studio-react:serve --port=4179",
    url: "http://localhost:4179",
    reuseExistingServer: false,
    timeout: 90000,
    env: {
      SVA_DEV_AUTH: "true",
      SVA_MOCK_AUTH: "true",
      SVA_AUTH_CLIENT_SECRET: "browser-qa-only",
      SVA_AUTH_ISSUER: "https://identity.qa.test/realms/qa",
      SVA_AUTH_CLIENT_ID: "studio",
      SVA_AUTH_REDIRECT_URI: "http://localhost:4179/auth/callback",
      SVA_AUTH_POST_LOGOUT_REDIRECT_URI: "http://localhost:4179/",
      VITE_SVA_DEV_AUTH: "true",
      VITE_MOCK_AUTH: "true",
      pnpm_config_verify_deps_before_run: "never",
    },
  },
});
