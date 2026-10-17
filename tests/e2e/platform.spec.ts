import { expect, test } from '@playwright/test'
import { mockSignedInApp } from './support/mockApp'

test('every page is served with basic security headers', async ({ request }) => {
  const response = await request.get('/home')
  const headers = response.headers()
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(headers['x-powered-by']).toBeUndefined()
})

test('an unhandled page error is reported to our server without personal details', async ({ page }) => {
  const errorReports: Record<string, unknown>[] = []
  await mockSignedInApp(page, { draft: false, errorReports })
  await page.goto('/home?from=email-link')
  await expect(page.getByRole('heading', { name: /오늘 라운드 준비되셨나요/ })).toBeVisible()
  // 제목은 서버가 그려 먼저 보일 수 있다. 오류 보고기는 브라우저에서 화면이 준비된 뒤 붙으므로,
  // 브라우저에서만 채워지는 로그인 닉네임이 보일 때까지 기다린다.
  await expect(page.getByRole('link', { name: /브라우저테스트님/ })).toBeVisible()
  await page.evaluate(() => { window.setTimeout(() => { throw new Error('홈 오류 golfer@example.com') }, 0) })
  await expect.poll(() => errorReports.length).toBe(1)
  expect(errorReports[0]).toMatchObject({ p_kind: 'error', p_message: '홈 오류 [이메일]', p_path: '/home' })
})

test('an error thrown before the app is ready in the browser is still reported', async ({ page }) => {
  const errorReports: Record<string, unknown>[] = []
  await mockSignedInApp(page, { draft: false, errorReports })
  // 앱 코드 내려받기를 늦춰, 오류가 반드시 화면이 준비되기 전에 생기게 한다.
  await page.route('**/_next/static/chunks/**', async (route) => { await new Promise((resolve) => setTimeout(resolve, 800)); await route.continue() })
  // 페이지 맨 앞 수집 스크립트가 준비되는 순간 오류를 낸다.
  await page.addInitScript(() => {
    let queue: unknown
    Object.defineProperty(window, '__golfEarlyErrors', {
      configurable: true,
      get: () => queue,
      set: (value) => { queue = value; window.setTimeout(() => { throw new Error('준비 전 오류 golfer@example.com') }, 0) },
    })
  })
  await page.goto('/home')
  await expect(page.getByRole('link', { name: /브라우저테스트님/ })).toBeVisible()
  await expect.poll(() => errorReports.length).toBe(1)
  expect(errorReports[0]).toMatchObject({ p_kind: 'error', p_message: '준비 전 오류 [이메일]', p_path: '/home' })
})

test('score, round report and MY screens read the signed-in user without asking the auth server', async ({ page }) => {
  await mockSignedInApp(page)
  const authUserRequests: string[] = []
  page.on('request', (request) => { if (new URL(request.url()).pathname.endsWith('/auth/v1/user')) authUserRequests.push(request.url()) })

  await page.goto('/score')
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()
  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('0')
  await page.getByRole('button', { name: '🏁 홀아웃 기록' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '라운드 리포트 보기' }).click()
  await expect(page.getByRole('heading', { name: '다음 연습 제안' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.goto('/my')
  await expect(page.getByText('님의 기록 보관함')).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(authUserRequests).toEqual([])
})

test('the app describes itself for home screen installation', async ({ page, request }) => {
  const manifestResponse = await request.get('/manifest.webmanifest')
  expect(manifestResponse.ok()).toBe(true)
  const manifest = await manifestResponse.json()
  expect(manifest).toMatchObject({ name: 'Golf Secretary 골프 비서', short_name: '골프 비서', lang: 'ko', start_url: '/score', display: 'standalone', theme_color: '#054d27' })
  for (const icon of manifest.icons as { src: string; sizes: string }[]) {
    const response = await request.get(icon.src)
    expect(response.headers()['content-type'], icon.src).toContain('image/png')
  }
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true)

  await page.goto('/home')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#054d27')
})
