import { defineConfig, devices } from '@playwright/test'

const apiMode = globalThis?.process?.env?.PW_API_MODE === 'db' ? 'db' : 'mock'
const useMockApi = apiMode === 'mock'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      env: {
        VITE_API_BASE_URL: 'http://127.0.0.1:4000',
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
      },
      url: 'http://127.0.0.1:4000/health',
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
