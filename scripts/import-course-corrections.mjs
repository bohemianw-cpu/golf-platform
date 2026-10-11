import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index].startsWith('--')) args.set(process.argv[index].slice(2), process.argv[index + 1] ?? '')
}
const inputPath = args.get('input')
if (!inputPath) throw new Error('사용법: node scripts/import-course-corrections.mjs --input <JSON> [--apply]')

function normalizeName(value) { return value.normalize('NFKC').replace(/[\s·ㆍ()（）.,_-]/g, '').toLocaleLowerCase('ko-KR') }
const source = JSON.parse(await readFile(inputPath, 'utf8'))
const corrections = Array.isArray(source) ? source : source.courses
if (!Array.isArray(corrections) || corrections.length === 0) throw new Error('JSON에는 courses 배열이 필요합니다.')

for (const course of corrections) {
  if (!course.name?.trim() || typeof course.region !== 'string') throw new Error('각 구장 보정에 name과 region이 필요합니다.')
  const routes = course.routes ?? []
  const routeCodes = new Set()
  for (const route of routes) {
    if (!route.route_code || routeCodes.has(route.route_code)) throw new Error(`${course.name}: route_code가 비어 있거나 중복됩니다.`)
    routeCodes.add(route.route_code)
    if (![9, 18].includes(route.hole_count) || route.pars?.length !== route.hole_count || route.distances_m?.length !== route.hole_count) {
      throw new Error(`${course.name}/${route.route_code}: 파와 거리는 hole_count 길이만큼 필요합니다.`)
    }
    if (route.pars.some((par) => !Number.isInteger(par) || par < 3 || par > 5)
      || route.distances_m.some((distance) => !Number.isInteger(distance) || distance < 1 || distance > 800)) {
      throw new Error(`${course.name}/${route.route_code}: 파는 3~5, 거리는 1~800m 정수여야 합니다.`)
    }
    if (route.verification_status && !['verified', 'rejected', 'pending'].includes(route.verification_status)) {
      throw new Error(`${course.name}/${route.route_code}: 허용되지 않는 검수 상태입니다.`)
    }
  }
}

console.log(`관리자 보정 후보: 구장 ${corrections.length}개, 레이아웃 ${corrections.reduce((sum, course) => sum + (course.routes?.length ?? 0), 0)}개`)
if (!args.has('apply')) {
  console.log('DB에는 저장하지 않았습니다. 보정 자료를 확인한 뒤 --apply로 실행하세요.')
  process.exit(0)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요.')
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

for (const correction of corrections) {
  const normalizedName = normalizeName(correction.name)
  let query = supabase.from('golf_courses').select('id').eq('normalized_name', normalizedName)
  query = correction.region ? query.eq('region', correction.region) : query.is('region', null)
  const { data: found, error: findError } = await query.limit(2)
  if (findError) throw findError
  if (!found?.length) throw new Error(`${correction.name}: MCST pending 구장을 찾을 수 없습니다.`)
  if (found.length !== 1) throw new Error(`${correction.name}: 같은 이름의 구장이 여러 지역에 있습니다. region을 정확히 지정하세요.`)
  const courseId = found[0].id

  const courseUpdate = {
    name: correction.name.trim(),
    normalized_name: normalizedName,
    venue_kind: 'physical',
    supports_field: true,
    verification_status: correction.verification_status ?? 'verified',
  }
  if (typeof correction.address === 'string') courseUpdate.address = correction.address
  if (Array.isArray(correction.aliases)) courseUpdate.aliases = correction.aliases
  if (typeof correction.supports_screen === 'boolean') courseUpdate.supports_screen = correction.supports_screen
  if (!['verified', 'rejected', 'pending'].includes(courseUpdate.verification_status)) throw new Error('허용되지 않는 검수 상태입니다.')
  const { error: updateError } = await supabase.from('golf_courses').update(courseUpdate).eq('id', courseId)
  if (updateError) throw updateError

  const routes = (correction.routes ?? []).map((route) => ({
    course_id: courseId,
    route_code: route.route_code,
    display_name: route.display_name ?? route.route_code,
    hole_count: route.hole_count,
    pars: route.pars,
    distances_m: route.distances_m,
    source_name: 'admin_curated',
    verification_status: route.verification_status ?? 'verified',
  }))
  if (routes.length) {
    const { error: routesError } = await supabase.from('golf_course_routes')
      .upsert(routes, { onConflict: 'course_id,route_code' })
    if (routesError) throw routesError
  }
}
console.log('보정 자료를 적용했습니다. verified 구장과 18홀 코스 레이아웃만 앱에서 플레이 기록에 사용할 수 있습니다.')
