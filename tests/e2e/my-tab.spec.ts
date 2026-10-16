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

test('opening a round requests its comparison averages together and ignores an earlier slow round', async ({ page }) => {
  await mockSignedInApp(page, { draft: false })
  const round = (n: number, name: string) => ({ id: `00000000-0000-4000-8000-00000000000${n}`, created_at: `2026-10-0${n}T01:00:00Z`, registered_at: `2026-10-0${n}T05:00:00Z`, status: 'completed', total_score: 80 + n, total_putts: 30, club_name: name, golf_club: name, course_name: 'OUT', course_id: '33333333-3333-4333-8333-333333333333', play_mode: 'field', screen_provider: null, entry_mode: 'live', route_ids: [], tee_code: null, tee_name: null, visibility: 'private' })
  const rounds = [round(1, '느린 CC'), round(2, '빠른 CC')]
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  await page.route('**/rest/v1/rounds*', (route) => route.fulfill(json(rounds)))
  await page.route(/\/rest\/v1\/round_(holes|shots)/, async (route) => {
    // 첫 라운드의 기록은 늦게 온다.
    if (route.request().url().includes(rounds[0].id)) await wait(1500)
    await route.fulfill(json([]))
  })
  const timeline: string[] = []
  const sampleSize: Record<string, number> = { beginner: 11, all: 22 }
  await page.route('**/rest/v1/rpc/get_course_round_aggregate*', async (route) => {
    const body = route.request().postDataJSON() as { p_course_id: string | null; p_skill_group: string }
    const kind = body.p_course_id ? body.p_skill_group : 'group'
    timeline.push(`start ${kind}`)
    await wait(400)
    timeline.push(`end ${kind}`)
    await route.fulfill(json([{ sample_size: kind === 'group' ? 33 : sampleSize[kind], average_score: 85, average_putts: 32, fairway_hit_percent: 50, gir_percent: 30 }]))
  })

  await page.goto('/my')
  const history = page.getByRole('region', { name: /내 라운드 전체 기록/ })
  await history.getByRole('button', { name: /빠른 CC/ }).click()
  await expect(page.getByText(/같은 핸디 그룹 · 표본 11회/)).toBeVisible()
  await expect(page.getByText(/구장 전체 그룹 · 표본 22회/)).toBeVisible()
  await expect(page.getByText(/같은 그룹 익명 전체 평균 · 표본 33회/)).toBeVisible()
  // 세 요청이 모두 시작된 뒤에야 첫 응답이 온다 = 동시에 보냈다.
  expect(timeline.slice(0, 3).every((step) => step.startsWith('start'))).toBe(true)

  // 느린 라운드를 누르고 곧바로 빠른 라운드를 누르면, 늦게 온 느린 라운드 결과가 화면을 덮지 않는다.
  timeline.length = 0
  await history.getByRole('button', { name: /느린 CC/ }).click()
  await history.getByRole('button', { name: /빠른 CC/ }).click()
  await wait(2000)
  await expect(page.getByRole('heading', { name: '빠른 CC 상세' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '느린 CC 상세' })).toHaveCount(0)
})

test('the MY tab loads its first data together and asks for a friend comparison in one go', async ({ page }) => {
  const me = '11111111-1111-4111-8111-111111111111'
  const friend = '77777777-7777-4777-8777-777777777777'
  await mockSignedInApp(page, { draft: false })
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  const rounds = [{ id: '00000000-0000-4000-8000-000000000001', created_at: '2026-10-01T01:00:00Z', registered_at: '2026-10-01T05:00:00Z', status: 'completed', total_score: 85, total_putts: 30, club_name: '비교 CC', golf_club: '비교 CC', course_name: 'OUT', course_id: '33333333-3333-4333-8333-333333333333', play_mode: 'field', screen_provider: null, entry_mode: 'live', route_ids: [], tee_code: null, tee_name: null, visibility: 'private' }]
  const timeline: string[] = []
  // 첫 화면에 필요한 요청마다 시작·끝을 기록한다. 응답을 늦춰 차례로 기다리는지 드러나게 한다.
  const firstLoad = /\/rest\/v1\/(profiles|rounds|user_data_preferences|friend_connections|rpc\/get_my_round_overview)(\?|$)/
  await page.route(firstLoad, async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!
    // 상단바도 닉네임만 따로 불러오므로, MY 탭의 프로필 요청(핸디캡 포함)만 기록한다.
    if (name === 'profiles' && !route.request().url().includes('handicap_index')) return route.fallback()
    timeline.push(`start ${name}`)
    await wait(300)
    timeline.push(`end ${name}`)
    if (name === 'rounds') return route.fulfill(json(rounds))
    if (name === 'friend_connections') return route.fulfill(json([{ id: 'f1', requester_id: me, addressee_id: friend, status: 'accepted' }]))
    return route.fallback()
  })
  const friendCalls: string[] = []
  await page.route('**/rest/v1/rpc/get_friend_round_aggregate*', async (route) => {
    const course = (route.request().postDataJSON() as { p_course_id: string | null }).p_course_id
    friendCalls.push(`start ${course ? 'course' : 'overall'}`)
    await wait(300)
    friendCalls.push(`end ${course ? 'course' : 'overall'}`)
    return route.fulfill(json([course ? { sample_size: 3, average_score: 90 } : { sample_size: 5, average_score: 88 }]))
  })

  await page.goto('/my')
  await expect(page.getByText('님의 기록 보관함')).toBeVisible()
  // 공유 설정과 친구 목록 요청이 첫 응답보다 먼저 시작된다 = 다른 요청을 기다리지 않고 함께 보냈다.
  const firstEnd = timeline.findIndex((step) => step.startsWith('end'))
  for (const name of ['profiles', 'rounds', 'get_my_round_overview', 'user_data_preferences', 'friend_connections']) {
    expect(timeline.indexOf(`start ${name}`), timeline.join(', ')).toBeLessThan(firstEnd)
  }

  await page.getByRole('region', { name: /내 라운드 전체 기록/ }).getByRole('button', { name: /비교 CC/ }).click()
  await expect(page.getByRole('heading', { name: '비교 CC 상세' })).toBeVisible()
  await page.getByRole('button', { name: '평균 비교' }).click()
  await expect(page.getByText(/전체 88타 \(5회\) · 이 구장 90타 \(3회\)/)).toBeVisible()
  expect(friendCalls.slice(0, 2).every((step) => step.startsWith('start')), friendCalls.join(', ')).toBe(true)
})
