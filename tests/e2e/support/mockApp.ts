// 화면 테스트 공통 준비: 로그인한 사용자, Supabase 응답 흉내, 이 기기 임시 기록.
import type { Page } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

const USER_ID = '11111111-1111-4111-8111-111111111111'
export const ROUND_ID = '22222222-2222-4222-8222-222222222222'
const COURSE_ID = '33333333-3333-4333-8333-333333333333'
const ROUTE_ID = '44444444-4444-4444-8444-444444444444'
const HOLE_ID = '55555555-5555-4555-8555-555555555555'
export const SAMPLE_ID = '66666666-6666-4666-8666-666666666666'
const expiresAt = Math.floor(Date.now() / 1000) + 86_400
const user = {
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'browser-test@example.invalid',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { nickname: '브라우저테스트' },
  created_at: '2026-01-01T00:00:00Z',
}
const jwt = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: USER_ID, role: 'authenticated', aud: 'authenticated', exp: expiresAt })).toString('base64url'),
  'mock-signature',
].join('.')
const session = {
  access_token: jwt,
  token_type: 'bearer',
  expires_in: 86_400,
  expires_at: expiresAt,
  refresh_token: 'browser-test-refresh-token',
  user,
}

function oneHoleDraft() {
  return {
    userId: USER_ID,
    roundId: ROUND_ID,
    golfClubName: '검증용 CC',
    courseName: 'OUT 코스',
    playMode: 'field',
    courseId: null,
    routeIds: [],
    teeCode: 'white',
    teeName: '화이트티',
    courseInfoLocked: true,
    courseParsAvailable: true,
    routeDistances: [100],
    greenCodes: ['standard'],
    greenNames: ['기본 그린'],
    routeHoles: [],
    holePars: [3],
    currentHole: 1,
    holeDistance: 100,
    currentShots: [],
    completedHoles: [],
  }
}

export async function mockSignedInApp(page: Page, options: { draft?: boolean; draftPatch?: Record<string, unknown>; serverRound?: boolean; sampleDraft?: boolean; realWrites?: string[]; holeWrites?: Record<string, unknown>[]; errorReports?: Record<string, unknown>[]; writes?: string[] } = {}) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!projectUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for browser tests')
  const projectRef = new URL(projectUrl).hostname.split('.')[0]
  const cookie = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`
  await page.addInitScript(({ name, value, draft, sampleDraft, uid }) => {
    document.cookie = `${name}=${value}; Path=/; SameSite=Lax`
    if (draft) localStorage.setItem('golf-score-draft-v1', JSON.stringify(draft))
    else localStorage.removeItem('golf-score-draft-v1')
    if (sampleDraft) localStorage.setItem('golf-score-sample-draft-v1', JSON.stringify(sampleDraft))
    localStorage.setItem(`golf-shot-flow-info:${uid}:real`, 'seen')
    localStorage.setItem(`golf-score-guide-seen:${uid}`, new Date().toISOString())
  }, {
    name: `sb-${projectRef}-auth-token`, value: cookie,
    draft: options.draft === false ? null : { ...oneHoleDraft(), ...options.draftPatch },
    sampleDraft: options.sampleDraft ? { ...oneHoleDraft(), roundId: null, sampleSessionId: SAMPLE_ID } : null,
    uid: USER_ID,
  })

  await page.route('**/auth/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(path.endsWith('/user') ? user : session) })
  })
  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const resource = url.pathname.split('/').pop()
    const method = request.method()
    if (method !== 'GET' && ['rounds', 'round_holes', 'round_shots'].includes(resource ?? '')) options.realWrites?.push(resource!)
    if (method === 'POST' && resource === 'round_holes') options.holeWrites?.push(...[request.postDataJSON()].flat())
    if (method === 'POST' && resource === 'report_client_error') options.errorReports?.push(request.postDataJSON())
    if (method !== 'GET') options.writes?.push(`${method} ${resource}${url.search}`)
    let body: unknown = []
    if (resource === 'profiles') body = { nickname: '브라우저테스트', skill_group: 'beginner' }
    else if (resource === 'user_club_bags') body = null
    else if (resource === 'user_data_preferences') body = { user_id: USER_ID, score_guide_enabled: false, score_guide_completed_at: '2026-01-01T00:00:00Z', allow_ai_practice_analysis: false }
    else if (resource === 'sample_round_sessions' && method === 'POST') body = { id: SAMPLE_ID, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', payload: {} }
    else if (resource === 'rounds' && method === 'GET') body = options.serverRound && url.searchParams.has('status') ? [{
      id: ROUND_ID, user_id: USER_ID, club_name: '서버복구 CC', golf_club: '서버복구 CC', course_name: 'OUT 코스',
      play_mode: 'field', course_id: COURSE_ID, route_ids: [ROUTE_ID], tee_code: 'white', tee_name: '화이트티',
      status: 'in_progress',
    }] : []
    else if (resource === 'rounds' && method !== 'GET') body = { id: ROUND_ID }
    else if (resource === 'golf_courses') body = { id: COURSE_ID, name: '서버복구 CC', region: '서울', venue_kind: 'physical', supports_field: true, supports_screen: false, hole_count: 1, aliases: [] }
    else if (resource === 'golf_course_routes') body = [{ id: ROUTE_ID, course_id: COURSE_ID, route_code: 'OUT', display_name: 'OUT 코스', hole_count: 1, pars: [3], distances_m: [100], source_url: 'https://example.invalid' }]
    else if (resource === 'golf_course_holes') body = [{ id: HOLE_ID, route_id: ROUTE_ID, hole_number: 1, play_order: 1, par: 3, handicap_index: 1 }]
    else if (resource === 'golf_course_hole_tees') body = [{ hole_id: HOLE_ID, tee_code: 'white', display_name: '화이트티', tee_color: '#ffffff', tee_selection_available: true, distance_m: 100, distance_m_source: 'official', source_distance: 100, source_unit: 'm', green_code: 'standard', green_name: '기본 그린', par: 3 }]
    else if (url.pathname.endsWith('/rpc/get_my_round_overview')) body = [{ total_rounds: 0, completed_rounds: 0, average_score: null, best_score: null, achievement_round_ids: [] }]
    else if (url.pathname.includes('/rpc/')) body = []
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'content-range' },
      body: JSON.stringify(body),
    })
  })
}

export async function mockCourseSearch(page: Page) {
  const course = { id: COURSE_ID, name: '서버복구 CC', region: '서울', venue_kind: 'physical', supports_field: true, supports_screen: false, hole_count: 1, aliases: [] }
  for (const rpc of ['search_verified_golf_courses_by_mode', 'list_popular_verified_golf_courses']) {
    await page.route(`**/rest/v1/rpc/${rpc}*`, (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([course]) }))
  }
}
