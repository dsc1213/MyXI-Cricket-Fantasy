import base from './playwright.config.js'

export default {
  ...base,
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:4176',
  },
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4176',
      url: 'http://127.0.0.1:4176',
      env: {
        VITE_API_BASE_URL: 'http://127.0.0.1:4003',
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'MOCK_API=false PORT=4003 npm run dev',
      cwd: '../api',
      env: {
        PORT: '4003',
      },
      url: 'http://127.0.0.1:4003/health',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
}
