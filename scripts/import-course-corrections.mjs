import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index].startsWith('--')) args.set(process.argv[index].slice(2), process.argv[index + 1] ?? '')
}
const inputPath = args.get('input')
const checkOnly = args.has('check')
if (!inputPath) throw new Error('사용법: node scripts/import-course-corrections.mjs --input <JSON> [--check | --apply]')
if (checkOnly && args.has('apply')) throw new Error('--check와 --apply는 함께 사용할 수 없습니다.')

function normalizeName(value) { return value.normalize('NFKC').replace(/[\s·ㆍ()（）.,_-]/g, '').toLocaleLowerCase('ko-KR') }
const source = JSON.parse(await readFile(inputPath, 'utf8'))
function normalizeSourceReview(review) {
  if (review.schema !== 'course-source-review/1') return null
  if (!review.venue || !Array.isArray(review.routes)) throw new Error('course-source-review/1에는 venue와 routes가 필요합니다.')
  const verified = review.status === 'source_verified_imported_verified'
  for (const route of review.routes) {
    if (route.par_source_url != null && !/^https:\/\//i.test(route.par_source_url)) {
      throw new Error(`${review.venue.name}/${route.route_code}: 홀별 파 출처 URL은 HTTPS여야 합니다.`)
    }
  }
  return [{
    ...review.venue,
    verification_status: verified ? 'verified' : 'pending',
    review_notes: [`원본 검수 파일: ${review.schema} · ${review.status ?? '상태 미지정'}`],
    routes: review.routes.map((route) => ({
      ...route,
      primary_tee_code: route.primary_tee_code ?? 'white',
      verification_status: verified ? 'verified' : 'pending',
      review_notes: [
        ...(route.par_source_url ? [`홀별 파 출처: ${route.par_source_url}`] : []),
      ],
      holes: route.holes.map((hole) => ({
        hole_number: hole.hole_number,
        par: hole.par,
        handicap_index: hole.handicap_index,
        tees: Array.isArray(hole.greens)
          ? hole.greens.flatMap((green) => green.tees.map((tee) => ({
            ...tee,
            green_code: green.green_code,
            green_name: green.display_name,
          })))
          : hole.tees,
      })),
    })),
  }]
}
const corrections = Array.isArray(source) ? source : source.courses ?? normalizeSourceReview(source)
if (!Array.isArray(corrections) || corrections.length === 0) throw new Error('JSON에는 courses 배열이 필요합니다.')

for (const course of corrections) {
  if (!course.name?.trim() || typeof course.region !== 'string') throw new Error('각 구장 보정에 name과 region이 필요합니다.')
  if (course.hole_count != null && (!Number.isInteger(course.hole_count) || course.hole_count < 1 || course.hole_count > 72)) {
    throw new Error(`${course.name}: hole_count는 1~72 사이 정수여야 합니다.`)
  }
  if (course.review_notes != null && (!Array.isArray(course.review_notes) || course.review_notes.some((note) => typeof note !== 'string' || !note.trim()))) {
    throw new Error(`${course.name}: review_notes는 비어 있지 않은 문자열 배열이어야 합니다.`)
  }
  const routes = course.routes ?? []
  const routeCodes = new Set()
  for (const route of routes) {
    if (!route.route_code || routeCodes.has(route.route_code)) throw new Error(`${course.name}: route_code가 비어 있거나 중복됩니다.`)
    routeCodes.add(route.route_code)
    if (![9, 18].includes(route.hole_count) || route.holes?.length !== route.hole_count) {
      throw new Error(`${course.name}/${route.route_code}: holes에 1번부터 ${route.hole_count}번까지의 홀 자료가 필요합니다.`)
    }
    if (!/^https:\/\//i.test(route.source_url ?? '')) throw new Error(`${course.name}/${route.route_code}: 공식 출처의 HTTPS URL이 필요합니다.`)
    if (route.source_data_url != null && !/^https:\/\//i.test(route.source_data_url)) throw new Error(`${course.name}/${route.route_code}: 공식 원자료 URL은 HTTPS여야 합니다.`)
    if (route.review_notes != null && (!Array.isArray(route.review_notes) || route.review_notes.some((note) => typeof note !== 'string' || !note.trim()))) {
      throw new Error(`${course.name}/${route.route_code}: review_notes는 비어 있지 않은 문자열 배열이어야 합니다.`)
    }
    const holeNumbers = new Set()
    for (const hole of route.holes) {
      if (!Number.isInteger(hole.hole_number) || hole.hole_number < 1 || hole.hole_number > route.hole_count || holeNumbers.has(hole.hole_number)) {
        throw new Error(`${course.name}/${route.route_code}: 홀 번호가 범위를 벗어나거나 중복되었습니다.`)
      }
      holeNumbers.add(hole.hole_number)
      if (!Number.isInteger(hole.par) || hole.par < 3 || hole.par > 5) throw new Error(`${course.name}/${route.route_code}/${hole.hole_number}홀: 파는 3~5여야 합니다.`)
      if (hole.handicap_index != null && (!Number.isInteger(hole.handicap_index) || hole.handicap_index < 1 || hole.handicap_index > 18)) {
        throw new Error(`${course.name}/${route.route_code}/${hole.hole_number}홀: 핸디캡 인덱스는 1~18이어야 합니다.`)
      }
      if (!Array.isArray(hole.tees) || hole.tees.length === 0) throw new Error(`${course.name}/${route.route_code}/${hole.hole_number}홀: 실제 확인된 티 자료가 하나 이상 필요합니다.`)
      const teeCodes = new Set()
      for (const tee of hole.tees) {
        const greenCode = tee.green_code ?? 'standard'
        const teeKey = `${tee.tee_code}:${greenCode}`
        if (!/^[a-z0-9_-]+$/i.test(tee.tee_code ?? '') || !/^[a-z0-9_-]+$/i.test(greenCode) || teeCodes.has(teeKey)) throw new Error(`${course.name}/${route.route_code}/${hole.hole_number}홀: 티·그린 코드가 비었거나 중복되었습니다.`)
        teeCodes.add(teeKey)
        if (!tee.display_name?.trim() || !tee.tee_color?.trim()) throw new Error(`${course.name}/${route.route_code}/${hole.hole_number}홀: 티 이름과 색상이 필요합니다.`)
        if (!Number.isInteger(tee.distance_m) || tee.distance_m < 1 || tee.distance_m > 800) throw new Error(`${course.name}/${route.route_code}/${hole.hole_number}홀: 티 거리는 1~800m 정수여야 합니다.`)
        if (tee.handicap_index != null && (!Number.isInteger(tee.handicap_index) || tee.handicap_index < 1 || tee.handicap_index > 18)) throw new Error(`${course.name}/${route.route_code}/${hole.hole_number}홀: 그린 핸디캡 인덱스는 1~18이어야 합니다.`)
      }
    }
    if (holeNumbers.size !== route.hole_count) throw new Error(`${course.name}/${route.route_code}: 모든 홀 번호를 채워야 합니다.`)
    if (route.primary_tee_code && route.holes.some((hole) => !hole.tees.some((tee) => tee.tee_code === route.primary_tee_code))) {
      throw new Error(`${course.name}/${route.route_code}: primary_tee_code가 모든 홀에 등록되어야 합니다.`)
    }
    if (route.verification_status && !['verified', 'rejected', 'pending'].includes(route.verification_status)) {
      throw new Error(`${course.name}/${route.route_code}: 허용되지 않는 검수 상태입니다.`)
    }
  }
  if (course.verification_status === 'verified' && routes.length === 0) throw new Error(`${course.name}: 검증 완료 구장에는 코스 레이아웃이 필요합니다.`)
  if (course.hole_count != null && routes.length && routes.reduce((sum, route) => sum + route.hole_count, 0) !== course.hole_count) {
    throw new Error(`${course.name}: 코스 레이아웃 합계와 구장 hole_count가 일치하지 않습니다.`)
  }
}

console.log(`관리자 보정 자료: 구장 ${corrections.length}개, 레이아웃 ${corrections.reduce((sum, course) => sum + (course.routes?.length ?? 0), 0)}개`)
if (!args.has('apply') && !checkOnly) {
  console.log('DB에는 저장하지 않았습니다. 출처와 수치를 확인한 뒤 --apply로 실행하세요.')
  process.exit(0)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL과 서버 전용 SUPABASE_SECRET_KEY 환경변수를 설정하세요.')
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

function sameValue(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected)
}

function routeDistances(route) {
  const primaryTeeCode = route.primary_tee_code ?? 'white'
  return route.holes.map((hole) => hole.tees.find((tee) => tee.tee_code === primaryTeeCode)?.distance_m ?? hole.tees[0].distance_m)
}

async function verifyCourse(correction, courseId) {
  const { data: course, error: courseError } = await supabase.from('golf_courses')
    .select('name,normalized_name,address,aliases,venue_kind,supports_field,supports_screen,hole_count,verification_status,review_notes')
    .eq('id', courseId).single()
  if (courseError) throw courseError
  const expectedCourse = {
    name: correction.name.trim(),
    normalized_name: normalizeName(correction.name),
    address: correction.address ?? course.address,
    aliases: correction.aliases ?? course.aliases,
    venue_kind: 'physical',
    supports_field: true,
    supports_screen: correction.supports_screen ?? course.supports_screen,
    verification_status: correction.verification_status ?? 'verified',
  }
  if (correction.hole_count != null) expectedCourse.hole_count = correction.hole_count
  if (correction.review_notes != null) expectedCourse.review_notes = correction.review_notes
  for (const [key, expected] of Object.entries(expectedCourse)) {
    if (!sameValue(course[key], expected)) throw new Error(`${correction.name}: DB ${key} 불일치 (DB=${JSON.stringify(course[key])}, seed=${JSON.stringify(expected)})`)
  }

  const { data: routeRows, error: routeError } = await supabase.from('golf_course_routes')
    .select('id,route_code,display_name,hole_count,pars,distances_m,source_name,source_url,source_data_url,source_checked_at,verification_status,review_notes')
    .eq('course_id', courseId)
  if (routeError) throw routeError
  const expectedRoutes = correction.routes ?? []
  const routeCodes = new Set(expectedRoutes.map((route) => route.route_code))
  const unexpectedRoutes = (routeRows ?? []).filter((route) => !routeCodes.has(route.route_code))
  if (unexpectedRoutes.length) throw new Error(`${correction.name}: seed에 없는 DB 코스가 있습니다: ${unexpectedRoutes.map((route) => route.route_code).join(', ')}`)
  for (const expectedRoute of expectedRoutes) {
    const savedRoute = routeRows?.find((route) => route.route_code === expectedRoute.route_code)
    if (!savedRoute) throw new Error(`${correction.name}/${expectedRoute.route_code}: DB에 코스가 없습니다.`)
    const expectedValues = {
      display_name: expectedRoute.display_name ?? expectedRoute.route_code,
      hole_count: expectedRoute.hole_count,
      pars: expectedRoute.holes.map((hole) => hole.par),
      distances_m: routeDistances(expectedRoute),
      source_name: 'admin_curated',
      source_url: expectedRoute.source_url,
      verification_status: expectedRoute.verification_status ?? 'verified',
    }
    if (Object.hasOwn(expectedRoute, 'source_data_url')) expectedValues.source_data_url = expectedRoute.source_data_url
    if (expectedRoute.review_notes != null) expectedValues.review_notes = expectedRoute.review_notes
    for (const [key, expected] of Object.entries(expectedValues)) {
      if (!sameValue(savedRoute[key], expected)) throw new Error(`${correction.name}/${expectedRoute.route_code}: DB ${key} 불일치 (DB=${JSON.stringify(savedRoute[key])}, seed=${JSON.stringify(expected)})`)
    }
    if (!savedRoute.source_checked_at) throw new Error(`${correction.name}/${expectedRoute.route_code}: DB에 공식 자료 확인 시각이 없습니다.`)

    const { data: holeRows, error: holeError } = await supabase.from('golf_course_holes')
      .select('id,hole_number,par,handicap_index').eq('route_id', savedRoute.id).order('hole_number')
    if (holeError) throw holeError
    if ((holeRows ?? []).length !== expectedRoute.holes.length) throw new Error(`${correction.name}/${expectedRoute.route_code}: 홀 수 불일치 (DB=${holeRows?.length ?? 0}, seed=${expectedRoute.holes.length})`)
    const { data: teeRows, error: teeError } = await supabase.from('golf_course_hole_tees')
      .select('id,hole_id,tee_code,display_name,tee_color,distance_m,source_distance,source_unit,green_code,green_name,handicap_index')
      .in('hole_id', (holeRows ?? []).map((hole) => hole.id))
    if (teeError) throw teeError
    const teesByHole = new Map()
    for (const tee of teeRows ?? []) teesByHole.set(tee.hole_id, [...(teesByHole.get(tee.hole_id) ?? []), tee])
    for (const expectedHole of expectedRoute.holes) {
      const savedHole = holeRows?.find((hole) => hole.hole_number === expectedHole.hole_number)
      if (!savedHole || savedHole.par !== expectedHole.par || (savedHole.handicap_index ?? null) !== (expectedHole.handicap_index ?? null)) {
        throw new Error(`${correction.name}/${expectedRoute.route_code}/${expectedHole.hole_number}홀: 파 또는 핸디캡 인덱스 불일치`)
      }
      const actualTees = (teesByHole.get(savedHole.id) ?? []).slice().sort((a, b) => `${a.tee_code}:${a.green_code}`.localeCompare(`${b.tee_code}:${b.green_code}`))
      const expectedTees = expectedHole.tees.map((tee) => ({
        tee_code: tee.tee_code,
        display_name: tee.display_name,
        tee_color: tee.tee_color,
        distance_m: tee.distance_m,
        source_distance: tee.source_distance ?? tee.distance_m,
        source_unit: tee.source_unit ?? 'm',
        green_code: tee.green_code ?? 'standard',
        green_name: tee.green_name ?? '기본 그린',
        handicap_index: tee.handicap_index ?? null,
      })).sort((a, b) => `${a.tee_code}:${a.green_code}`.localeCompare(`${b.tee_code}:${b.green_code}`))
      const comparableActual = actualTees.map(({ tee_code, display_name, tee_color, distance_m, source_distance, source_unit, green_code, green_name, handicap_index }) => ({
        tee_code, display_name, tee_color, distance_m, source_distance, source_unit, green_code, green_name, handicap_index: handicap_index ?? null,
      }))
      if (!sameValue(comparableActual, expectedTees)) {
        throw new Error(`${correction.name}/${expectedRoute.route_code}/${expectedHole.hole_number}홀: DB 티 구성이 seed와 다릅니다 (DB=${JSON.stringify(comparableActual)}, seed=${JSON.stringify(expectedTees)})`)
      }
    }
  }
  console.log(`일치 확인: ${correction.name} · 코스 ${expectedRoutes.length}개 · 홀 ${expectedRoutes.reduce((sum, route) => sum + route.holes.length, 0)}개 · 티 ${expectedRoutes.reduce((sum, route) => sum + route.holes.reduce((holeSum, hole) => holeSum + hole.tees.length, 0), 0)}개`)
}

for (const correction of corrections) {
  const normalizedName = normalizeName(correction.name)
  const matchName = normalizeName(correction.match_name ?? correction.name)
  let query = supabase.from('golf_courses').select('id').eq('normalized_name', matchName)
  query = correction.region ? query.eq('region', correction.region) : query.is('region', null)
  let { data: found, error: findError } = await query.limit(2)
  if (findError) throw findError
  if (!found?.length && correction.match_name) {
    let aliasQuery = supabase.from('golf_courses').select('id').contains('aliases', [correction.match_name])
    aliasQuery = correction.region ? aliasQuery.eq('region', correction.region) : aliasQuery.is('region', null)
    ;({ data: found, error: findError } = await aliasQuery.limit(2))
    if (findError) throw findError
  }
  if (!found?.length) throw new Error(`${correction.match_name ?? correction.name}: MCST pending 구장을 찾을 수 없습니다.`)
  if (found.length !== 1) throw new Error(`${correction.match_name ?? correction.name}: 같은 이름의 구장이 여러 지역에 있습니다. region을 정확히 지정하세요.`)
  const courseId = found[0].id

  if (checkOnly) {
    await verifyCourse(correction, courseId)
    continue
  }

  const courseUpdate = {
    name: correction.name.trim(),
    normalized_name: normalizedName,
    venue_kind: 'physical',
    supports_field: true,
    verification_status: correction.verification_status ?? 'verified',
  }
  if (correction.hole_count != null) courseUpdate.hole_count = correction.hole_count
  if (correction.review_notes != null) courseUpdate.review_notes = correction.review_notes
  if (typeof correction.address === 'string') courseUpdate.address = correction.address
  if (Array.isArray(correction.aliases)) courseUpdate.aliases = correction.aliases
  if (typeof correction.supports_screen === 'boolean') courseUpdate.supports_screen = correction.supports_screen
  if (!['verified', 'rejected', 'pending'].includes(courseUpdate.verification_status)) throw new Error('허용되지 않는 검수 상태입니다.')
  const { error: updateError } = await supabase.from('golf_courses').update(courseUpdate).eq('id', courseId)
  if (updateError) throw updateError

  const { data: existingRouteSources, error: existingRouteSourcesError } = await supabase.from('golf_course_routes')
    .select('route_code,source_data_url')
    .eq('course_id', courseId)
  if (existingRouteSourcesError) throw existingRouteSourcesError
  const routes = (correction.routes ?? []).map((route) => ({
    course_id: courseId,
    route_code: route.route_code,
    display_name: route.display_name ?? route.route_code,
    hole_count: route.hole_count,
    pars: route.holes.map((hole) => hole.par),
    distances_m: routeDistances(route),
    source_name: 'admin_curated',
    source_url: route.source_url,
    source_checked_at: new Date().toISOString(),
    verification_status: route.verification_status ?? 'verified',
    source_data_url: Object.hasOwn(route, 'source_data_url')
      ? route.source_data_url
      : existingRouteSources?.find((savedRoute) => savedRoute.route_code === route.route_code)?.source_data_url ?? null,
    ...(route.review_notes != null ? { review_notes: route.review_notes } : {}),
  }))
  if (!routes.length) continue
  const { data: savedRoutes, error: routesError } = await supabase.from('golf_course_routes')
    .upsert(routes, { onConflict: 'course_id,route_code' }).select('id,route_code')
  if (routesError) throw routesError

  for (const route of correction.routes) {
    const savedRoute = savedRoutes?.find((row) => row.route_code === route.route_code)
    if (!savedRoute) throw new Error(`${correction.name}/${route.route_code}: 저장된 코스 ID를 확인하지 못했습니다.`)
    const holes = route.holes.map((hole) => ({
      route_id: savedRoute.id,
      hole_number: hole.hole_number,
      par: hole.par,
      handicap_index: hole.handicap_index ?? null,
    }))
    const { data: savedHoles, error: holesError } = await supabase.from('golf_course_holes')
      .upsert(holes, { onConflict: 'route_id,hole_number' }).select('id,hole_number')
    if (holesError) throw holesError
    const holeIdByNumber = new Map((savedHoles ?? []).map((hole) => [hole.hole_number, hole.id]))
    const { data: existingTeeRows, error: existingTeesError } = await supabase.from('golf_course_hole_tees')
      .select('id,hole_id,tee_code,green_code').in('hole_id', savedHoles.map((hole) => hole.id))
    if (existingTeesError) throw existingTeesError
    const teeRows = route.holes.flatMap((hole) => hole.tees.map((tee) => ({
      hole_id: holeIdByNumber.get(hole.hole_number),
      tee_code: tee.tee_code,
      display_name: tee.display_name,
      tee_color: tee.tee_color,
      distance_m: tee.distance_m,
      source_distance: tee.source_distance ?? tee.distance_m,
      source_unit: tee.source_unit ?? 'm',
      green_code: tee.green_code ?? 'standard',
      green_name: tee.green_name ?? '기본 그린',
      handicap_index: tee.handicap_index ?? null,
    })))
    const { error: teesError } = await supabase.from('golf_course_hole_tees')
      .upsert(teeRows, { onConflict: 'hole_id,tee_code,green_code' })
    if (teesError) throw teesError

    for (const hole of route.holes) {
      const holeId = holeIdByNumber.get(hole.hole_number)
      const currentPairs = hole.tees.map((tee) => `${tee.tee_code}:${tee.green_code ?? 'standard'}`)
      const staleRows = (existingTeeRows ?? []).filter((tee) => tee.hole_id === holeId && !currentPairs.includes(`${tee.tee_code}:${tee.green_code ?? 'standard'}`))
      const { error: staleTeesError } = staleRows.length ? await supabase.from('golf_course_hole_tees')
        .delete().in('id', staleRows.map((tee) => tee.id)) : { error: null }
      if (staleTeesError) throw staleTeesError
    }
  }
}
console.log('보정 자료를 적용했습니다. 홀별 파·티 거리와 출처 URL을 저장했습니다. 티 데이터가 없는 코스는 선택에 표시되지 않습니다.')
