import base from './playwright.config.js'
export default {
  ...base,
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:4174',
  },
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4174',
      url: 'http://127.0.0.1:4174',
      env: {
        VITE_API_BASE_URL: 'http://127.0.0.1:4001',
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'rm -rf mocks/state mocks/mock-state.json && npm run dev',
      cwd: '../api',
      env: {
        MOCK_API: 'true',
        PORT: '4001'
      },
      url: 'http://127.0.0.1:4001/health',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
}
