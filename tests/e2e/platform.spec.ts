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
