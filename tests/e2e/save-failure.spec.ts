import { expect, test, type Page } from '@playwright/test'
import { mockSignedInApp, SAMPLE_ID } from './support/mockApp'

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

test('unsaved shots are sent again automatically when the connection comes back', async ({ page, context }) => {
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
  const writesBefore = writes.filter((write) => write.startsWith('POST round_shots')).length

  // 신호가 끊겼다가 돌아온다. "다시 시도"는 누르지 않는다.
  failing = false
  await context.setOffline(true)
  await context.setOffline(false)
  await expect(alert).toBeHidden()
  await expect.poll(() => writes.filter((write) => write.startsWith('POST round_shots')).length).toBeGreaterThan(writesBefore)
})

test('a failed hole save is sent again when the player comes back to the app', async ({ page }) => {
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

  // 다른 앱을 보다가 돌아온 것처럼 화면 표시 상태 변화를 알린다.
  failing = false
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(alert).toBeHidden()
  await expect.poll(() => holeWrites.some((hole) => hole.hole_number === 1)).toBe(true)
})

test('nothing is sent again on reconnect when every shot is already saved', async ({ page, context }) => {
  const writes: string[] = []
  await mockSignedInApp(page, { writes })
  await page.goto('/score')
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()
  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('40')
  await page.getByRole('button', { name: '✓ 샷 결과 저장' }).click()
  await expect.poll(() => writes.filter((write) => write.startsWith('POST round_shots')).length).toBe(1)
  await context.setOffline(true)
  await context.setOffline(false)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(800)
  expect(writes.filter((write) => write.startsWith('POST round_shots'))).toHaveLength(1)
})

test('the score tab says so as soon as the connection drops, and clears it when it returns', async ({ page, context }) => {
  await mockSignedInApp(page)
  await page.goto('/score')
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()
  const notice = page.getByRole('status').filter({ hasText: '인터넷 연결이 끊겼어요' })
  await expect(page.getByRole('button', { name: '✓ 샷 결과 저장' })).toBeVisible()
  await expect(notice).toHaveCount(0)

  await context.setOffline(true)
  await expect(notice).toBeVisible()
  await expect(notice).toContainText('연결되면 자동으로 서버에 저장돼요')
  // 연결이 없어도 샷 입력은 계속할 수 있다.
  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('40')
  await page.getByRole('button', { name: '✓ 샷 결과 저장' }).click()
  await expect(page.getByRole('button', { name: '↩ 직전 샷 취소' })).toBeEnabled()

  await context.setOffline(false)
  await expect(notice).toHaveCount(0)
})

test('a sample round shows the offline notice and saves again by itself when the connection returns', async ({ page, context }) => {
  const writes: string[] = []
  let failing = true
  await mockSignedInApp(page, { draft: false, sampleDraft: true, writes })
  await failWritesTo(page, 'sample_round_sessions', () => failing)
  await page.goto(`/score?sample=${SAMPLE_ID}`)
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click()
  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('40')
  await page.getByRole('button', { name: '✓ 샷 결과 저장' }).click()
  const alert = page.getByRole('alert').filter({ hasText: '샘플 기록을 서버에 저장하지 못했습니다' })
  await expect(alert).toBeVisible()

  await context.setOffline(true)
  await expect(page.getByRole('status').filter({ hasText: '인터넷 연결이 끊겼어요' })).toBeVisible()
  const savesBefore = writes.filter((write) => write.startsWith('PATCH sample_round_sessions')).length
  failing = false
  await context.setOffline(false)
  await expect(alert).toBeHidden()
  await expect.poll(() => writes.filter((write) => write.startsWith('PATCH sample_round_sessions')).length).toBeGreaterThan(savesBefore)
})
