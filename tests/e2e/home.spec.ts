import { expect, test } from '@playwright/test'
import { mockSignedInApp } from './support/mockApp'

const overview = (body: Record<string, unknown>) => ({ contentType: 'application/json', body: JSON.stringify([{ total_rounds: 0, completed_rounds: 0, average_score: null, best_score: null, achievement_round_ids: [], ...body }]) })

test('a signed-out visitor sees what the app does and can open the login window from the home tab', async ({ page }) => {
  await page.route('**/auth/v1/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }))
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: '라운드의 모든 샷을 기록해 보세요' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '내 라운드' })).toHaveCount(0)
  await page.getByRole('button', { name: '로그인하고 기록 시작하기' }).click()
  await expect(page.getByRole('dialog', { name: '골프 비서 로그인' })).toBeVisible()
})

test('a golfer with a round in progress can continue it from the home tab', async ({ page }) => {
  await mockSignedInApp(page)
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: '브라우저테스트님, 오늘 라운드 준비되셨나요?' })).toBeVisible()
  await expect(page.getByText('검증용 CC · OUT 코스 · 1번 홀 진행 중')).toBeVisible()
  await expect(page.getByText('아직 등록한 라운드가 없어요', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: '⛳ 이어서 기록하기' }).click()
  await expect(page).toHaveURL(/\/score$/)
  await expect(page.getByRole('dialog').getByRole('button', { name: '이어서 하기' })).toBeVisible()
})

test('the home tab shows the round summary and lists the services that are not open yet', async ({ page }) => {
  await mockSignedInApp(page, { draft: false })
  await page.route('**/rest/v1/rpc/get_my_round_overview*', (route) => route.fulfill(overview({ total_rounds: 3, completed_rounds: 3, average_score: 86.333, best_score: 82 })))
  await page.goto('/home')
  await expect(page.getByRole('link', { name: '⛳ 스코어 기록 시작' })).toHaveAttribute('href', '/score')
  const summary = page.getByRole('region', { name: '내 라운드' })
  await expect(summary.getByRole('definition')).toHaveText(['3회', '86.3', '82'])
  await expect(summary.getByRole('link', { name: 'MY 탭에서 자세히 보기 →' })).toHaveAttribute('href', '/my')
  const comingSoon = page.getByRole('region', { name: '준비 중인 서비스' }).getByRole('link')
  await expect(comingSoon).toHaveText([/조인\/벙개.*곧 열려요/, /영상.*곧 열려요/, /레슨.*곧 열려요/, /쇼핑.*곧 열려요/])
})

test('when the summary cannot be loaded the home tab says so instead of showing zeros', async ({ page }) => {
  await mockSignedInApp(page, { draft: false })
  await page.route('**/rest/v1/rpc/get_my_round_overview*', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }))
  await page.goto('/home')
  await expect(page.getByText('지금은 기록 요약을 불러오지 못했어요', { exact: false })).toBeVisible()
  await expect(page.getByRole('region', { name: '내 라운드' }).getByRole('definition')).toHaveCount(0)
})
