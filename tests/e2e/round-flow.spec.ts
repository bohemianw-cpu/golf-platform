import { expect, test } from '@playwright/test'
import { ROUND_ID, SAMPLE_ID, mockSignedInApp } from './support/mockApp'

test('a shot can be undone, restored, and registered without edit controls', async ({ page }) => {
  const holeWrites: Record<string, unknown>[] = []
  await mockSignedInApp(page, { holeWrites })
  await page.goto('/')
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()
  await expect(page.getByRole('button', { name: '✓ 샷 결과 저장' })).toBeVisible()

  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('0')
  await page.getByRole('button', { name: '🏁 홀아웃 기록' }).click()
  await expect(page.getByRole('heading', { name: /파|버디|이글|보기|홀인원/ })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: /직전 샷/ }).click()
  await expect(page.getByRole('button', { name: '↪ 삭제한 샷 복원' })).toBeVisible()
  await page.getByRole('button', { name: '↪ 삭제한 샷 복원' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '라운드 리포트 보기' }).click()
  await expect(page.getByRole('button', { name: /스코어 등록/ })).toBeVisible()

  await page.getByRole('button', { name: /스코어 등록/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: '스코어 등록' }).click()
  await expect(page.getByText('스코어 등록 완료 · 이 기록은 수정할 수 없습니다.')).toBeVisible()
  await expect(page.getByRole('button', { name: /마지막 홀의 마지막 샷 취소/ })).toHaveCount(0)
  // 샷은 round_shots에만 저장하고, 홀 저장에는 샷 사본을 싣지 않는다.
  expect(holeWrites.length).toBeGreaterThan(0)
  expect(holeWrites.filter((hole) => 'shots' in hole)).toEqual([])

  // 등록 뒤 새 라운드를 시작하면 화면과 이 기기의 임시 기록이 비워진다.
  await page.getByRole('button', { name: '새 라운드 시작' }).first().click()
  await expect(page.getByRole('searchbox', { name: '골프장 이름 검색' })).toHaveValue('')
  await expect(page.getByText('스코어 등록 완료 · 이 기록은 수정할 수 없습니다.')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('golf-score-draft-v1'))).toBeNull()
})

test('resetting the course deletes the in-progress server round and the local draft', async ({ page }) => {
  const writes: string[] = []
  await mockSignedInApp(page, { writes })
  await page.goto('/')
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()
  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('40')
  await page.getByRole('button', { name: '✓ 샷 결과 저장' }).click()
  await expect(page.getByRole('button', { name: '↩ 직전 샷 취소' })).toBeEnabled()
  await expect.poll(() => writes.some((write) => write.startsWith('POST round_shots'))).toBe(true)

  await page.getByRole('button', { name: '🗑️ 초기화' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '초기화' }).click()

  await expect.poll(() => writes.filter((write) => write.startsWith('DELETE rounds'))).toEqual([expect.stringContaining(`id=eq.${ROUND_ID}`)])
  await expect(page.getByRole('searchbox', { name: '골프장 이름 검색' })).toHaveValue('')
  await expect(page.getByRole('button', { name: '↩ 직전 샷 취소' })).toBeDisabled()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('golf-score-draft-v1'))).toBeNull()
})

test('an unfinished shot survives a tab change and can be undone and restored', async ({ page }) => {
  await mockSignedInApp(page)
  await page.goto('/')
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()

  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('40')
  await page.getByRole('button', { name: '✓ 샷 결과 저장' }).click()
  await expect(page.getByRole('button', { name: '↩ 직전 샷 취소' })).toBeEnabled()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('golf-score-draft-v1') ?? '{}').currentShots?.length)).toBe(1)

  await page.getByRole('link', { name: 'Golf Secretary 홈으로 이동' }).click()
  await page.getByRole('link', { name: /실시간 스코어 기록/ }).click()
  await expect(page.getByText('🚩 현재 핀까지')).toBeVisible()
  await expect(page.getByRole('button', { name: '↩ 직전 샷 취소' })).toBeEnabled()
  await page.getByRole('button', { name: '↩ 직전 샷 취소' }).click()
  await expect(page.getByRole('button', { name: '↪ 삭제한 샷 복원' })).toBeEnabled()
  await page.getByRole('button', { name: '↪ 삭제한 샷 복원' }).click()
  await expect(page.getByRole('button', { name: '↩ 직전 샷 취소' })).toBeEnabled()
})

test('an in-progress server round is offered again after leaving the score tab without a local draft', async ({ page }) => {
  await mockSignedInApp(page, { draft: false, serverRound: true })
  await page.goto('/')
  await expect(page.getByRole('dialog').getByText(/진행 중이던 라운드/)).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: /나중에/ }).click()
  await page.getByRole('link', { name: 'Golf Secretary 홈으로 이동' }).click()
  await page.getByRole('link', { name: /실시간 스코어 기록/ }).click()
  await expect(page.getByRole('dialog').getByText(/진행 중이던 라운드/)).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()
  await expect(page.getByRole('searchbox', { name: '골프장 이름 검색' })).toHaveValue('서버복구 CC')
  await expect(page.getByRole('button', { name: '✓ 샷 결과 저장' })).toBeEnabled()
})

test('sample shots stay separate from real round writes', async ({ page }) => {
  const realWrites: string[] = []
  await mockSignedInApp(page, { draft: false, sampleDraft: true, realWrites })
  await page.goto('/')
  await page.mouse.wheel(0, 120)
  await page.getByRole('navigation').getByRole('link', { name: /MY/ }).click()
  await page.getByRole('button', { name: '샘플 입력 시작' }).click()
  await expect(page).toHaveURL(new RegExp(`/score\\?sample=${SAMPLE_ID}$`))
  await expect(page.getByText('샘플 입력 중 · 평균·배지·트로피 제외')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click()
  await expect(page.getByRole('button', { name: '✓ 샷 결과 저장' })).toBeEnabled()
  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('40')
  await page.getByRole('button', { name: '✓ 샷 결과 저장' }).click()
  await expect(page.getByRole('button', { name: '↩ 직전 샷 취소' })).toBeEnabled()
  expect(realWrites).toEqual([])
})
