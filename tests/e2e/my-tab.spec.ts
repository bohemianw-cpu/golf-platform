import { expect, test } from '@playwright/test'
import { mockSignedInApp } from './support/mockApp'

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(body) })

test('the MY tab shows trophies from server totals without downloading hole or shot records', async ({ page }) => {
  await mockSignedInApp(page, { draft: false })
  const rounds = [1, 2].map((n) => ({ id: `00000000-0000-4000-8000-00000000000${n}`, created_at: `2026-10-0${n}T01:00:00Z`, registered_at: `2026-10-0${n}T05:00:00Z`, status: 'completed', total_score: 80 + n, total_putts: 30, club_name: '검증 CC', golf_club: '검증 CC', course_name: 'OUT', course_id: null, play_mode: 'field', screen_provider: null, entry_mode: 'live', route_ids: [], tee_code: null, tee_name: null, visibility: 'private' }))
  const detailRequests: string[] = []
  const trophyRequests: unknown[] = []
  await page.route('**/rest/v1/rounds*', (route) => route.fulfill(json(rounds)))
  await page.route('**/rest/v1/round_integrity*', (route) => route.fulfill(json(rounds.map((round) => ({ round_id: round.id, status: 'time_plausible', observed_seconds: 9000, minimum_seconds: 3600, reason_codes: [] })))))
  await page.route(/\/rest\/v1\/round_(holes|shots)/, (route) => { detailRequests.push(route.request().url()); return route.fulfill(json([])) })
  await page.route('**/rest/v1/rpc/get_my_round_overview*', (route) => route.fulfill(json([{ total_rounds: 2, completed_rounds: 2, average_score: 81.5, best_score: 81, achievement_round_ids: rounds.map((round) => round.id) }])))
  await page.route('**/rest/v1/rpc/get_my_trophy_stats*', (route) => {
    trophyRequests.push(route.request().postDataJSON())
    return route.fulfill(json([{ birdies: 1, eagles: 0, fairway_holes: 0, fairway_hits: 0, gir_holes: 0, gir_hits: 0, best_full_round_score: 88, has_even_par_round: false, has_under_par_round: false, has_putt_rhythm_round: false, has_long_drive: true, has_clean_round: false, has_par_or_better_nine: false }]))
  })

  await page.goto('/my')
  // 2라운드 · 버디 · 18홀 88타 · 250m 드라이버 → 첫 라운드, 첫 버디, 100타·90타 벽 돌파, 장타 기념
  await expect(page.getByText('🏅 5 / 19 획득')).toBeVisible()
  await expect(page.getByText('90타 벽 돌파')).toBeVisible()
  expect(trophyRequests).toEqual([{ p_round_ids: rounds.map((round) => round.id) }])
  expect(detailRequests).toEqual([])
})

test('the MY tab lists rounds 50 at a time and shows totals from the server', async ({ page }) => {
  await mockSignedInApp(page, { draft: false })
  const rounds = Array.from({ length: 120 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, created_at: new Date(Date.UTC(2026, 9, 1) - i * 86_400_000).toISOString(), registered_at: null, status: 'completed', total_score: 70 + (i % 30), total_putts: 30, club_name: `라운드 ${i + 1}`, golf_club: null, course_name: 'OUT', course_id: null, play_mode: 'field', screen_provider: null, entry_mode: 'live', route_ids: [], tee_code: null, tee_name: null, visibility: 'private' }))
  const pageRequests: string[] = []
  await page.route('**/rest/v1/rounds*', (route) => {
    const url = new URL(route.request().url())
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? rounds.length)
    pageRequests.push(`${offset}+${limit}`)
    return route.fulfill(json(rounds.slice(offset, offset + limit)))
  })
  await page.route('**/rest/v1/rpc/get_my_round_overview*', (route) => route.fulfill(json([{ total_rounds: 120, completed_rounds: 120, average_score: 84.5, best_score: 70, achievement_round_ids: [] }])))

  await page.goto('/my')
  const history = page.getByRole('region', { name: /내 라운드 전체 기록/ })
  await expect(history.getByRole('heading', { name: '📚 내 라운드 전체 기록 (120)' })).toBeVisible()
  await expect(page.getByLabel('요약 통계')).toContainText('120회')
  await expect(page.getByLabel('요약 통계')).toContainText('84.5타')
  await expect(history.getByRole('button', { name: /^라운드 \d+/ })).toHaveCount(50)

  await history.getByRole('button', { name: '이전 기록 더 보기 (50 / 120)' }).click()
  await expect(history.getByRole('button', { name: /^라운드 \d+/ })).toHaveCount(100)
  await history.getByRole('button', { name: '이전 기록 더 보기 (100 / 120)' }).click()
  await expect(history.getByRole('button', { name: /^라운드 \d+/ })).toHaveCount(120)
  await expect(history.getByRole('button', { name: /이전 기록 더 보기/ })).toHaveCount(0)
  // 개발 모드에서는 React가 첫 불러오기를 두 번 실행할 수 있어 중복을 빼고 본다.
  expect([...new Set(pageRequests)]).toEqual(['0+50', '50+50', '100+50'])
})
