import { defineConfig, devices } from '@playwright/test'

// 서비스 워커는 빌드한 앱에서만 등록되므로, 이 테스트는 next build 결과를 next start로 띄워 확인한다.
// 먼저 npm run build를 실행해야 한다(CI는 앞 단계에서 빌드한다).
const port = 3200

export default defineConfig({
  testDir: './tests/offline',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    ...devices['Desktop Chrome'],
    viewport: { width: 430, height: 900 },
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
