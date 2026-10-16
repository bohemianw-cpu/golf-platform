import { expect, test, type Page } from '@playwright/test'
import { mockSignedInApp } from './support/mockApp'

const TWO_HOLES = {
  courseParsAvailable: true,
  routeDistances: [100, 100],
  greenCodes: ['standard', 'standard'],
  greenNames: ['기본 그린', '기본 그린'],
  holePars: [3, 3],
}

/** table에 쓰는 요청을 failing()이 true인 동안 서버 오류로 돌려준다. 읽기와 다른 표는 그대로 둔다. */
async function failWritesTo(page: Page, table: string, failing: () => boolean) {
  await page.route(`**/rest/v1/${table}*`, (route) => {
    if (route.request().method() === 'GET' || !failing()) return route.fallback()
    return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ message: 'server down' }) })
  })
}

const savedDraft = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('golf-score-draft-v1') ?? 'null'))

test('a shot that fails to reach the server stays on this device and is saved by retry', async ({ page }) => {
  const writes: string[] = []
  let failing = true
  await mockSignedInApp(page, { writes })
  await failWritesTo(page, 'round_shots', () => failing)
  await page.goto('/score')
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()

  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('40')
  await page.getByRole('button', { name: '✓ 샷 결과 저장' }).click()
  const alert = page.getByRole('alert').filter({ hasText: '샷 서버 저장에 실패했습니다' })
  await expect(alert).toBeVisible()
  await expect.poll(async () => (await savedDraft(page))?.currentShots?.length).toBe(1)

  failing = false
  await alert.getByRole('button', { name: '다시 시도' }).click()
  await expect(alert).toBeHidden()
  await expect.poll(() => writes.some((write) => write.startsWith('POST round_shots'))).toBe(true)
})

test('a failed hole save keeps its warning until the hole reaches the server', async ({ page }) => {
  const holeWrites: Record<string, unknown>[] = []
  let failing = true
  await mockSignedInApp(page, { holeWrites, draftPatch: TWO_HOLES })
  await failWritesTo(page, 'round_holes', () => failing)
  await page.goto('/score')
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()

  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('0')
  await page.getByRole('button', { name: '🏁 홀아웃 기록' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '다음 홀로 이동' }).click()
  const alert = page.getByRole('alert').filter({ hasText: '서버 저장에 실패했습니다' })
  await expect(alert).toBeVisible()

  // 다음 홀의 샷 저장이 성공해도 1번 홀은 아직 서버에 없으므로 경고가 남아야 한다.
  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('40')
  await page.getByRole('button', { name: '✓ 샷 결과 저장' }).click()
  await expect(page.getByRole('button', { name: '↩ 직전 샷 취소' })).toBeEnabled()
  await page.waitForTimeout(500)
  await expect(alert).toBeVisible()
  expect((await savedDraft(page))?.completedHoles).toHaveLength(1)

  failing = false
  await alert.getByRole('button', { name: '다시 시도' }).click()
  await expect(alert).toBeHidden()
  await expect.poll(() => holeWrites.some((hole) => hole.hole_number === 1)).toBe(true)
})

test('a shot the server never received survives a reload and is uploaded after resuming', async ({ page }) => {
  const writes: string[] = []
  let failing = true
  await mockSignedInApp(page, { writes })
  await failWritesTo(page, 'round_shots', () => failing)
  await page.goto('/score')
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()
  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('40')
  await page.getByRole('button', { name: '✓ 샷 결과 저장' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '샷 서버 저장에 실패했습니다' })).toBeVisible()
  await expect.poll(async () => (await savedDraft(page))?.currentShots?.length).toBe(1)

  // 초기 준비 스크립트가 임시 기록을 처음 상태로 덮어쓰지 않도록, 새로고침 전에 저장된 기록을 다시 넣는다.
  const draft = await savedDraft(page)
  await page.addInitScript((value) => localStorage.setItem('golf-score-draft-v1', value), JSON.stringify(draft))
  failing = false
  await page.reload()
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()
  await expect(page.getByRole('button', { name: '↩ 직전 샷 취소' })).toBeEnabled()
  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('0')
  await page.getByRole('button', { name: '🏁 홀아웃 기록' }).click()
  await expect.poll(() => writes.filter((write) => write.startsWith('POST round_shots')).length).toBeGreaterThan(0)
})
