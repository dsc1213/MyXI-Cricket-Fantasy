import { defineConfig, devices } from '@playwright/test'

const apiMode = globalThis?.process?.env?.PW_API_MODE === 'db' ? 'db' : 'mock'
const useMockApi = apiMode === 'mock'
const webPort = Number(globalThis?.process?.env?.PW_WEB_PORT || 4173)
const apiPort = Number(globalThis?.process?.env?.PW_API_PORT || 4000)
const webBaseUrl = `http://127.0.0.1:${webPort}`
const apiBaseUrl = `http://127.0.0.1:${apiPort}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: webBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
      url: webBaseUrl,
      env: {
        VITE_API_BASE_URL: apiBaseUrl,
      },
      reuseExistingServer: !globalThis?.process?.env?.CI,
      timeout: 120 * 1000,
    },
    {
      command: useMockApi
        ? 'rm -rf mocks/state mocks/mock-state.json && npm run dev'
        : 'npm run dev',
      cwd: '../api',
      env: {
        MOCK_API: useMockApi ? 'true' : 'false',
        PORT: String(apiPort),
      },
      url: `${apiBaseUrl}/health`,
      reuseExistingServer: false,
      timeout: 120 * 1000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
