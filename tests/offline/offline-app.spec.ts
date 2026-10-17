import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { mockSignedInApp } from '../e2e/support/mockApp'

/**
 * 연결을 끊고 잇는다. Playwright의 가짜 서버(page.route)는 오프라인에서도 응답하므로,
 * 끊긴 동안에는 Supabase 요청도 실제처럼 실패하게 한다.
 */
async function connection(page: Page, context: BrowserContext) {
  let online = true
  await page.route(/^https:\/\/[^/]+\.supabase\.co\//, (route) => online ? route.fallback() : route.abort('internetdisconnected'))
  return async (value: boolean) => { online = value; await context.setOffline(!value) }
}

test('the score tab opens without a connection and the shots entered offline are saved when it returns', async ({ page, context }) => {
  const writes: string[] = []
  await mockSignedInApp(page, { writes })
  const setOnline = await connection(page, context)

  // 연결된 상태로 한 번 열어 서비스 워커가 화면과 앱 코드를 저장하게 한다.
  await page.goto('/score')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()
  await expect(page.getByRole('button', { name: '✓ 샷 결과 저장' })).toBeVisible()

  // 신호가 끊긴 채 앱을 새로 연다.
  await setOnline(false)
  await page.reload()
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()
  await expect(page.getByRole('status').filter({ hasText: '인터넷 연결이 끊겼어요' })).toBeVisible()
  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('40')
  await page.getByRole('button', { name: '✓ 샷 결과 저장' }).click()
  await expect(page.getByRole('button', { name: '↩ 직전 샷 취소' })).toBeEnabled()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('golf-score-draft-v1') ?? 'null')?.currentShots?.length)).toBe(1)
  const writesBeforeReconnect = writes.filter((write) => write.startsWith('POST round_shots')).length

  // 연결이 돌아오면 버튼을 누르지 않아도 서버에 저장된다.
  await setOnline(true)
  await expect.poll(() => writes.filter((write) => write.startsWith('POST round_shots')).length).toBeGreaterThan(writesBeforeReconnect)
  await expect(page.getByRole('status').filter({ hasText: '인터넷 연결이 끊겼어요' })).toHaveCount(0)
})

test('a page never opened online shows an offline guide instead of a browser error', async ({ page, context }) => {
  await mockSignedInApp(page, { draft: false })
  const setOnline = await connection(page, context)
  await page.goto('/home')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await setOnline(false)
  await page.goto('/lesson')
  await expect(page.getByRole('heading', { name: '인터넷 연결이 없어요' })).toBeVisible()
  await expect(page.getByRole('link', { name: '스코어 기록으로 가기' })).toHaveAttribute('href', '/score')
  await setOnline(true)
})
