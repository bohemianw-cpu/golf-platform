import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

const USER_ID = '11111111-1111-4111-8111-111111111111'
const ROUND_ID = '22222222-2222-4222-8222-222222222222'
const COURSE_ID = '33333333-3333-4333-8333-333333333333'
const ROUTE_ID = '44444444-4444-4444-8444-444444444444'
const HOLE_ID = '55555555-5555-4555-8555-555555555555'
const SAMPLE_ID = '66666666-6666-4666-8666-666666666666'
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

async function mockSignedInApp(page: Page, options: { draft?: boolean; serverRound?: boolean; sampleDraft?: boolean; realWrites?: string[]; holeWrites?: Record<string, unknown>[]; errorReports?: Record<string, unknown>[] } = {}) {
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
    draft: options.draft === false ? null : oneHoleDraft(),
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
    else if (url.pathname.includes('/rpc/')) body = []
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'content-range' },
      body: JSON.stringify(body),
    })
  })
}

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

test('each tab has its own address that survives refresh and back navigation', async ({ page }) => {
  await mockSignedInApp(page, { draft: false })
  // 스크롤 가능한 화면에서는 상단바와 하단 메뉴가 잠시 뒤 숨으므로 먼저 다시 보이게 한다.
  const revealChrome = () => page.mouse.wheel(0, 120)
  const tabLink = async (name: RegExp) => {
    await revealChrome()
    await page.getByRole('navigation').getByRole('link', { name }).click()
  }

  await page.goto('/')
  await expect(page).toHaveURL(/\/score$/)
  await expect(page.getByRole('navigation').getByRole('link', { name: /스코어/ })).toHaveAttribute('aria-current', 'page')

  await tabLink(/MY/)
  await expect(page).toHaveURL(/\/my$/)
  await expect(page.getByRole('button', { name: '샘플 입력 시작' })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/my$/)
  await expect(page.getByRole('button', { name: '샘플 입력 시작' })).toBeVisible()

  // 개발 서버의 Next.js 표시 버튼이 맨 왼쪽 '홈' 메뉴를 가리므로 상단 로고 링크로 이동한다.
  await revealChrome()
  await page.getByRole('link', { name: 'Golf Secretary 홈으로 이동' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole('navigation').getByRole('link', { name: /홈/ })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: /오늘 라운드 준비되셨나요/ })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/my$/)
  await expect(page.getByRole('button', { name: '샘플 입력 시작' })).toBeVisible()

  await page.goto('/lesson')
  await expect(page.getByRole('heading', { name: '레슨 서비스 준비 중' })).toBeVisible()
  await expect(page).toHaveTitle('레슨 | Golf Secretary')
  await page.getByRole('link', { name: '스코어 기록 계속하기' }).click()
  await expect(page).toHaveURL(/\/score$/)
  await expect(page.getByRole('button', { name: '✓ 샷 결과 저장' })).toBeVisible()
})

test('the root redirect keeps email link parameters for sign-in', async ({ request }) => {
  const response = await request.get('/?code=email-link-code&type=recovery', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe('/score?code=email-link-code&type=recovery')
  const plain = await request.get('/', { maxRedirects: 0 })
  expect(plain.headers().location).toBe('/score')
})

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
  await page.evaluate(() => { window.setTimeout(() => { throw new Error('홈 오류 golfer@example.com') }, 0) })
  await expect.poll(() => errorReports.length).toBe(1)
  expect(errorReports[0]).toMatchObject({ p_kind: 'error', p_message: '홈 오류 [이메일]', p_path: '/home' })
})

test('sign-up is blocked before reaching Supabase when the password appears in a breach', async ({ page }) => {
  const leaked = 'golfsecretary123'
  const hash = createHash('sha1').update(leaked).digest('hex').toUpperCase()
  const authRequests: string[] = []
  await page.route('**/range/*', (route) => route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: `${hash.slice(5)}:42\r\n0000000000000000000000000000000000A:0` }))
  await page.route('**/auth/v1/**', (route) => {
    authRequests.push(new URL(route.request().url()).pathname)
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/home')
  await page.getByRole('button', { name: '로그인 / 회원가입' }).first().click()
  await page.getByRole('button', { name: '계정이 없으신가요? 회원가입' }).click()
  await page.getByPlaceholder('사용할 닉네임').fill('새골퍼')
  await page.getByPlaceholder('example@golf.com').fill('new-golfer@example.invalid')
  await page.getByPlaceholder('8자 이상, 다른 곳에서 쓰지 않는 비밀번호').fill(leaked)
  await page.getByLabel('[필수] 서비스 이용약관 동의').check()
  await page.getByLabel('[필수] 개인정보 처리 안내 확인').check()
  await page.getByLabel('[필수] 만 14세 이상입니다').check()
  await page.locator('form button[type="submit"]').click()

  await expect(page.getByText(/유출된 적이 있는 비밀번호/)).toBeVisible()
  expect(authRequests.filter((path) => path.endsWith('/signup'))).toEqual([])
})
