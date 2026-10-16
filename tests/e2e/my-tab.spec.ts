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
