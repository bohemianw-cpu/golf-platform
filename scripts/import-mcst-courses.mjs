import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { normalizeCourseName, normalizeCourseSearch } from '../utils/course-name.js'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index].startsWith('--')) args.set(process.argv[index].slice(2), process.argv[index + 1] ?? '')
}

const inputPath = args.get('input')
if (!inputPath) throw new Error('사용법: node scripts/import-mcst-courses.mjs --input <CSV> [--apply]')

function parseCsv(source) {
  const records = []
  let record = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1 }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') { record.push(cell); cell = '' }
    else if (char === '\n') { record.push(cell.replace(/\r$/, '')); records.push(record); record = []; cell = '' }
    else cell += char
  }
  if (quoted) throw new Error('CSV의 따옴표가 닫히지 않았습니다.')
  if (cell.length || record.length) { record.push(cell.replace(/\r$/, '')); records.push(record) }
  return records
}

function normalizeHeader(value) { return value.replace(/^\uFEFF/, '').replace(/[\s_()-]/g, '').toLowerCase() }
function normalizeName(value) { return normalizeCourseSearch(value) }
function regionFromAddress(address) {
  const first = address.trim().split(/\s+/)[0] ?? ''
  return first.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/u, '') || null
}
function sourceId(value) { return createHash('sha256').update(value).digest('hex') }

const raw = await readFile(inputPath, 'utf8')
if (raw.includes('\uFFFD')) throw new Error('CSV 인코딩에 손상이 있습니다. UTF-8로 다시 저장한 파일을 사용해 주세요.')
const [rawHeaders, ...rows] = parseCsv(raw.replace(/^\uFEFF/, ''))
if (!rawHeaders || !rows.length) throw new Error('CSV에 헤더와 데이터 행이 필요합니다.')
const headers = rawHeaders.map((value) => value.trim())
const headerMap = new Map(headers.map((value, index) => [normalizeHeader(value), index]))
const pickColumn = (argName, candidates, required = false) => {
  const requested = args.get(argName)
  const index = requested ? headerMap.get(normalizeHeader(requested)) : candidates.map((key) => headerMap.get(normalizeHeader(key))).find((value) => value !== undefined)
  if (required && index === undefined) throw new Error(`CSV 열을 찾지 못했습니다. --${argName}에 정확한 헤더명을 지정하세요.`)
  return index
}
const nameColumn = pickColumn('name-column', ['골프장명', '이름', '업소명', '사업장명', '시설명', '명칭'], true)
const addressColumn = pickColumn('address-column', ['소재지도로명주소', '도로명주소', '소재지주소', '소재지', '주소'])
const regionColumn = pickColumn('region-column', ['시도', '지역', '소재지시도'])
const holesColumn = pickColumn('holes-column', ['홀수', '총홀수', '총홀수(홀)', '홀수(홀)', '홀'])
const sourceIdColumn = pickColumn('id-column', ['관리번호', '골프장코드', '시설코드', '고유번호', '번호'])
const cellAt = (row, column) => column === undefined ? '' : (row[column] ?? '').trim()
const sourceName = 'MCST 전국 골프장 현황'
const coursesByKey = new Map()

for (const row of rows) {
  const sourceCourseName = cellAt(row, nameColumn)
  if (!sourceCourseName) continue
  const name = normalizeCourseName(sourceCourseName)
  const address = cellAt(row, addressColumn) || null
  const region = cellAt(row, regionColumn) || (address ? regionFromAddress(address) : null)
  const parsedHoles = Number.parseInt(cellAt(row, holesColumn).replace(/[^0-9]/g, ''), 10)
  const key = `${normalizeName(name)}|${region ?? ''}`
  const identity = cellAt(row, sourceIdColumn) || key
  const sourceRecordId = sourceId(identity)
  const holeCount = parsedHoles > 0 && parsedHoles <= 54 ? parsedHoles : null
  coursesByKey.set(key, {
    name,
    normalized_name: normalizeName(name),
    region,
    address,
    venue_kind: 'physical',
    supports_field: true,
    supports_screen: false,
    hole_count: holeCount,
    source_name: sourceName,
    source_record_id: sourceRecordId,
    source_license: '이용허락범위 제한 없음',
    source_updated_at: '2024-12-31T00:00:00.000Z',
    verification_status: 'pending',
  })
}

const courses = [...coursesByKey.values()]
if (!courses.length) throw new Error('가져올 골프장 행이 없습니다. --name-column과 CSV 내용을 확인하세요.')
console.log(`가져오기 후보: ${courses.length}개. 모든 항목은 관리자 검수 전까지 pending 상태입니다.`)
const exportPath = args.get('export-json')
if (exportPath) {
  await writeFile(exportPath, `${JSON.stringify(courses, null, 2)}\n`, 'utf8')
  console.log(`정규화된 후보를 ${exportPath}에 내보냈습니다.`)
  process.exit(0)
}
if (!args.has('apply')) {
  console.log('실제 저장은 하지 않았습니다. 검토 후 --apply를 추가해 실행하세요.')
  process.exit(0)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL과 서버 전용 SUPABASE_SECRET_KEY 환경변수를 설정하세요.')
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
let inserted = 0
let refreshedPending = 0
let keptVerified = 0

for (let offset = 0; offset < courses.length; offset += 100) {
  const batch = courses.slice(offset, offset + 100)
  const normalizedNames = [...new Set(batch.map((course) => course.normalized_name))]
  const { data: existing, error: readError } = await supabase
    .from('golf_courses').select('id,source_record_id,normalized_name,region,verification_status')
    .in('normalized_name', normalizedNames)
  if (readError) throw readError
  const bySource = new Map((existing ?? []).map((course) => [course.source_record_id, course]))
  const byNameAndRegion = new Map((existing ?? []).map((course) => [`${course.normalized_name}|${course.region ?? ''}`, course]))
  const additions = []
  for (const course of batch) {
    const match = bySource.get(course.source_record_id) ?? byNameAndRegion.get(`${course.normalized_name}|${course.region ?? ''}`)
    if (!match) { additions.push(course); continue }
    if (match.verification_status === 'verified') { keptVerified += 1; continue }
    const { error: updateError } = await supabase.from('golf_courses').update(course).eq('id', match.id).eq('verification_status', 'pending')
    if (updateError) throw updateError
    refreshedPending += 1
  }
  if (additions.length) {
    const { error: insertError } = await supabase.from('golf_courses').insert(additions)
    if (insertError) throw insertError
    inserted += additions.length
  }
}
console.log(`완료: 신규 ${inserted}, pending 갱신 ${refreshedPending}, 검증 완료 보존 ${keptVerified}. 홀별 파·거리 코스는 별도 관리자 검수가 필요합니다.`)
