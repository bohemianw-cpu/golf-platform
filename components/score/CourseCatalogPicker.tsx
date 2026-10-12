'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { normalizeCourseSearch } from '@/utils/course-name'
import type { GolfCourseHole, GolfCourseRoute, GolfCourseTee } from '@/types/golf'

export interface GolfCourseOption {
  id: string
  name: string
  region: string | null
  venue_kind: 'physical' | 'virtual_screen'
  supports_field: boolean
  supports_screen: boolean
  hole_count: number | null
}

export type GolfRouteOption = GolfCourseRoute

interface Props {
  courseId: string | null
  routeIds: string[]
  teeCode: string | null
  locked: boolean
  searchOpen: boolean
  onSearchOpenChange: (open: boolean) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  onCourseSelect: (course: GolfCourseOption | null) => void
  onCourseResolved: (course: GolfCourseOption | null) => void
  onRoutesChange: (routes: GolfRouteOption[], teeCode: string | null, teeName: string | null) => void
}

function completeTeeOptions(routes: GolfRouteOption[], totalHoles: number): GolfCourseTee[] {
  const holes = routes.flatMap((route) => route.holes ?? [])
  if (![9, 18].includes(totalHoles) || holes.length !== totalHoles || routes.some((route) => route.holes?.length !== route.hole_count)) return []
  const firstHoleTees = holes[0]?.tees ?? []
  return firstHoleTees
    .filter((tee) => tee.tee_selection_available !== false)
    .filter((tee) => holes.every((hole) => hole.tees.some((item) => item.tee_code === tee.tee_code)))
    .filter((tee, index, all) => all.findIndex((candidate) => candidate.tee_code === tee.tee_code) === index)
}

function hasCompleteReferenceDistances(routes: GolfRouteOption[], totalHoles: number): boolean {
  const holes = routes.flatMap((route) => route.holes ?? [])
  return [9, 18].includes(totalHoles)
    && holes.length === totalHoles
    && routes.every((route) => route.holes?.length === route.hole_count)
    && holes.every((hole) => hole.tees.some((tee) => tee.tee_selection_available === false))
}

function RouteDistancePreview({ route }: { route: GolfRouteOption }) {
  const holes = route.holes ?? []
  const tees = holes.flatMap((hole) => hole.tees)
    .filter((tee, index, all) => all.findIndex((candidate) => candidate.tee_code === tee.tee_code) === index)
  const parTotal = holes.reduce((sum, hole) => sum + hole.par, 0)

  return (
    <details open style={{ marginTop: '8px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#fff' }}>
      <summary style={{ padding: '8px', fontSize: '11px', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
        {route.display_name} 홀별 정보 · {holes.length}홀 · Par {parTotal}
      </summary>
      <div style={{ overflowX: 'auto', padding: '0 6px 6px' }}>
        <table aria-label={`${route.display_name} 홀별 파와 티 거리`} style={{ width: '100%', minWidth: '360px', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#f8fafc', color: '#475569' }}>
              <th scope="col" style={{ padding: '6px', borderBottom: '1px solid #e2e8f0' }}>홀</th>
              <th scope="col" style={{ padding: '6px', borderBottom: '1px solid #e2e8f0' }}>Par</th>
              {tees.map((tee) => <th key={tee.tee_code} scope="col" style={{ padding: '6px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                {tee.tee_selection_available === false
                  ? <span>{tee.display_name}</span>
                  : <><span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, marginRight: 4, border: '1px solid #94a3b8', borderRadius: '50%', background: tee.tee_color, verticalAlign: '-1px' }} />{tee.display_name}</>}
              </th>)}
            </tr>
          </thead>
          <tbody>
            {holes.map((hole) => <tr key={hole.id}>
              <th scope="row" style={{ padding: '6px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{hole.hole_number}</th>
              <td style={{ padding: '6px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>
                {[...new Set(hole.tees.map((item) => item.par).filter((par): par is number => par != null))].length > 0
                  ? [...new Set(hole.tees.map((item) => item.par).filter((par): par is number => par != null))].sort().join('/')
                  : hole.par}
              </td>
              {tees.map((tee) => {
                const variants = hole.tees.filter((item) => item.tee_code === tee.tee_code)
                return <td key={tee.tee_code} style={{ padding: '6px', borderBottom: '1px solid #f1f5f9', color: variants.length ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap' }}>
                  {variants.length ? variants.map((item) => variants.length > 1 || item.green_code !== 'standard'
                    ? `${item.green_name} ${formatTeeDistance(item)}`
                    : formatTeeDistance(item)).join(' · ') : '미제공'}
                </td>
              })}
            </tr>)}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function formatTeeDistance(tee: GolfCourseTee): string {
  const originalYards = tee.source_unit === 'yd' && tee.source_distance != null ? ` · ${tee.source_distance}yd` : ''
  const sourceLabel = tee.distance_m_source === 'official' ? ' (공식 M)' : tee.source_unit === 'yd' ? ' (환산 M)' : ''
  return `${tee.distance_m}m${originalYards}${sourceLabel}`
}

export default function CourseCatalogPicker({ courseId, routeIds, teeCode, locked, searchOpen, onSearchOpenChange, searchQuery, onSearchQueryChange, onCourseSelect, onCourseResolved, onRoutesChange }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [courses, setCourses] = useState<GolfCourseOption[]>([])
  const [selectedCourse, setSelectedCourse] = useState<GolfCourseOption | null>(null)
  const [routes, setRoutes] = useState<GolfRouteOption[]>([])
  const [routesForCourseId, setRoutesForCourseId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [catalogError, setCatalogError] = useState(false)

  useEffect(() => {
    const search = normalizeCourseSearch(searchQuery)
    if (search.length < 1) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('golf_courses')
        .select('id,name,region,venue_kind,supports_field,supports_screen,hole_count')
        .eq('verification_status', 'verified')
        .ilike('normalized_name', `%${search}%`)
        .order('name')
        .range(0, 999)
      if (cancelled) return
      setLoading(false)
      setCatalogError(!!error)
      setCourses((data ?? []) as GolfCourseOption[])
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [searchQuery, supabase])

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    void (async () => {
      const { data: routeData, error: routeError } = await supabase
        .from('golf_course_routes')
        .select('id,course_id,route_code,display_name,hole_count,pars,distances_m,source_url')
        .eq('course_id', courseId)
        .eq('verification_status', 'verified')
        .order('display_name')
      if (routeError) throw routeError
      const routeRows = (routeData ?? []) as GolfRouteOption[]
      if (!routeRows.length) {
        if (!cancelled) { setRoutes([]); setRoutesForCourseId(courseId); setCatalogError(false) }
        return
      }

      const { data: holeData, error: holeError } = await supabase
        .from('golf_course_holes')
        .select('id,route_id,hole_number,par,handicap_index')
        .in('route_id', routeRows.map((route) => route.id))
        .order('hole_number')
      if (holeError) throw holeError
      const holeRows = (holeData ?? []) as Omit<GolfCourseHole, 'tees'>[]
      const { data: teeData, error: teeError } = holeRows.length
        ? await supabase.from('golf_course_hole_tees')
          .select('hole_id,tee_code,display_name,tee_color,tee_selection_available,distance_m,distance_m_source,source_distance,source_unit,green_code,green_name,par')
          .in('hole_id', holeRows.map((hole) => hole.id))
        : { data: [], error: null }
      if (teeError) throw teeError
      const teesByHole = new Map<string, GolfCourseTee[]>()
      for (const tee of teeData ?? []) {
        const row = tee as GolfCourseTee & { hole_id: string }
        teesByHole.set(row.hole_id, [...(teesByHole.get(row.hole_id) ?? []), {
          tee_code: row.tee_code, display_name: row.display_name, tee_color: row.tee_color, tee_selection_available: row.tee_selection_available, distance_m: row.distance_m,
          distance_m_source: row.distance_m_source, source_distance: row.source_distance, source_unit: row.source_unit,
          green_code: row.green_code ?? 'standard', green_name: row.green_name ?? '기본 그린',
          par: row.par ?? null,
        }])
      }
      const holesByRoute = new Map<string, GolfCourseHole[]>()
      for (const hole of holeRows) {
        holesByRoute.set(hole.route_id, [...(holesByRoute.get(hole.route_id) ?? []), { ...hole, tees: teesByHole.get(hole.id) ?? [] }])
      }
      if (!cancelled) {
        setRoutes(routeRows.map((route) => ({ ...route, holes: holesByRoute.get(route.id) ?? [] })))
        setRoutesForCourseId(courseId)
        setCatalogError(false)
      }
    })().catch(() => { if (!cancelled) { setCatalogError(true); setRoutes([]); setRoutesForCourseId(courseId) } })
    return () => { cancelled = true }
  }, [courseId, supabase])

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    void supabase.from('golf_courses')
      .select('id,name,region,venue_kind,supports_field,supports_screen,hole_count')
      .eq('id', courseId).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        const course = data as GolfCourseOption
        setSelectedCourse(course)
        onCourseResolved(course)
      })
    return () => { cancelled = true }
  }, [courseId, supabase, onCourseResolved])

  const selectedRoutes = routeIds.map((id) => routes.find((route) => route.id === id)).filter((route): route is GolfRouteOption => !!route)
  const routesLoading = !!courseId && routesForCourseId !== courseId
  const selectedCourseRoutes = routesForCourseId === courseId ? routes.filter((route) => route.course_id === courseId) : []
  const selectedHoleCount = selectedRoutes.reduce((sum, route) => sum + route.hole_count, 0)
  const teeOptions = completeTeeOptions(selectedRoutes, selectedHoleCount)
  const hasReferenceDistance = hasCompleteReferenceDistances(selectedRoutes, selectedHoleCount)
  const selectedTee = teeOptions.find((tee) => tee.tee_code === teeCode) ?? null
  const selectedLayoutIsValid = [9, 18].includes(selectedHoleCount) && (teeOptions.length > 0 ? !!selectedTee : hasReferenceDistance)

  return (
    <section aria-label="골프장과 코스 검색" style={{ marginTop: searchOpen || (courseId && selectedCourse) ? '10px' : 0 }}>
      {searchOpen && searchQuery.trim().length > 0 && <div style={{ position: 'relative' }}>
        <ul id="course-catalog-results" role="listbox" aria-label="골프장 검색 결과" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, maxHeight: '220px', overflowY: 'auto', margin: 0, padding: '4px', listStyle: 'none', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 8px 20px #0f172a1a' }}>
          {loading ? <li role="status" style={{ padding: '9px', fontSize: '12px', color: '#64748b' }}>검색 중…</li>
            : catalogError ? <li role="alert" style={{ padding: '9px', fontSize: '12px', color: '#b91c1c' }}>구장 카탈로그를 불러오지 못했습니다.</li>
              : courses.length === 0 ? <li style={{ padding: '9px', fontSize: '12px', color: '#64748b' }}>검증된 결과가 없습니다. 입력한 구장명으로 임시 기록할 수 있으며, 이 기록은 구장 평균 비교에서 제외됩니다.</li>
                : courses.map((course) => (
                  <li key={course.id}>
                    <button type="button" role="option" aria-selected={course.id === courseId} disabled={locked} onMouseDown={(event) => event.preventDefault()} onClick={() => { setSelectedCourse(course); onCourseSelect(course); onSearchQueryChange(''); onSearchOpenChange(false) }} style={{ width: '100%', padding: '9px', border: 0, borderRadius: '6px', textAlign: 'left', background: course.id === courseId ? '#ecfdf4' : '#fff', cursor: 'pointer' }}>
                      <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{course.name}</span>
                      <span style={{ display: 'block', marginTop: '2px', fontSize: '10px', color: '#64748b' }}>
                        {course.region || '지역 미등록'} · {course.venue_kind === 'virtual_screen' ? '스크린' : course.supports_field && course.supports_screen ? '필드/스크린' : course.supports_field ? '필드' : '스크린'}
                      </span>
                    </button>
                  </li>
                ))}
        </ul>
      </div>}
      {courseId && selectedCourse && (
        <div style={{ marginTop: '8px', padding: '9px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>{selectedCourse.name} · 카탈로그 검증됨</div>
            <button type="button" disabled={locked} onClick={() => { setSelectedCourse(null); onCourseSelect(null) }} aria-label="선택한 골프장 해제" style={{ border: 0, background: 'transparent', color: '#64748b', cursor: locked ? 'not-allowed' : 'pointer' }}>해제</button>
          </div>
          {routesLoading ? <p role="status" style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>코스 정보를 불러오는 중…</p>
            : catalogError ? <p role="alert" style={{ margin: '6px 0 0', fontSize: '11px', color: '#b91c1c' }}>코스 레이아웃을 불러오지 못했습니다.</p>
              : selectedCourseRoutes.length > 0 ? (
                <>
                <fieldset style={{ margin: '8px 0 0', padding: '7px 8px', border: '1px solid #bbf7d0', borderRadius: '6px', background: '#fff' }}>
                  <legend style={{ padding: '0 3px', fontSize: '10px', fontWeight: 700, color: '#166534' }}>오늘 플레이할 코스와 티 선택</legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedCourseRoutes.map((route) => {
                      const checked = routeIds.includes(route.id)
                      const cannotAdd = !checked && selectedHoleCount + route.hole_count > 18
                      const canRepeat = checked && route.hole_count === 9 && selectedHoleCount === 9 && routeIds.filter((id) => id === route.id).length === 1
                      return <div key={route.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#334155' }}>
                          <input type="checkbox" checked={checked} disabled={locked || cannotAdd} onChange={() => {
                            const next = [...selectedRoutes]
                            if (checked) next.splice(next.findIndex((item) => item.id === route.id), 1)
                            else next.push(route)
                            const options = completeTeeOptions(next, next.reduce((sum, item) => sum + item.hole_count, 0))
                            const retained = options.find((item) => item.tee_code === teeCode) ?? null
                            onRoutesChange(next, retained?.tee_code ?? null, retained?.display_name ?? null)
                          }} aria-label={`${route.display_name} ${route.hole_count}홀 코스`} />
                          {route.display_name} ({route.hole_count}홀)
                        </label>
                        {canRepeat && <button type="button" disabled={locked} onClick={() => {
                          const next = [...selectedRoutes, route]
                          const options = completeTeeOptions(next, 18)
                          const retained = options.find((item) => item.tee_code === teeCode) ?? null
                          onRoutesChange(next, retained?.tee_code ?? null, retained?.display_name ?? null)
                        }} style={{ padding: '3px 6px', border: '1px solid #bbf7d0', borderRadius: '5px', background: '#f0fdf4', color: '#166534', fontSize: '10px', cursor: locked ? 'not-allowed' : 'pointer' }}>+9홀 반복</button>}
                      </div>
                    })}
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '10px', color: '#64748b' }}>
                    선택 순서: {selectedRoutes.length ? selectedRoutes.map((route) => route.display_name).join(' → ') : '미선택'}
                  </div>
                  {[9, 18].includes(selectedHoleCount) && (teeOptions.length > 0 ? (
                    <fieldset style={{ margin: '8px 0 0', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                      <legend style={{ fontSize: '10px', fontWeight: 700 }}>이번 라운드 티 위치 (필수)</legend>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {teeOptions.map((tee) => <label key={tee.tee_code} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
                          <input type="radio" name="course-tee" value={tee.tee_code} checked={teeCode === tee.tee_code} disabled={locked} onChange={() => onRoutesChange(selectedRoutes, tee.tee_code, tee.display_name)} />
                          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', border: '1px solid #64748b', background: tee.tee_color }} />
                          {tee.display_name}
                        </label>)}
                      </div>
                    </fieldset>
                  ) : hasReferenceDistance
                    ? <p role="status" style={{ margin: '6px 0 0', fontSize: '10px', color: '#475569' }}>공식 기준 거리는 있으나 티 위치는 공개되지 않았습니다. 기준 거리로 기록하며 티 위치는 선택하지 않습니다.</p>
                    : <p role="status" style={{ margin: '6px 0 0', fontSize: '10px', color: '#b45309' }}>선택한 {selectedHoleCount}홀 전체에 공통 티별 거리 자료가 없습니다.</p>)}
                  <div role="status" style={{ marginTop: '5px', fontSize: '10px', color: selectedLayoutIsValid ? '#15803d' : '#b45309' }}>
                    {selectedLayoutIsValid ? `${selectedHoleCount}홀 파·거리 확인 완료 · ${selectedTee?.display_name ?? '공식 기준 거리 (티 미표기)'}` : selectedHoleCount < 9 ? `${selectedHoleCount}/9홀 선택 · 코스를 선택해 주세요.` : selectedHoleCount === 9 ? '9홀 라운드를 기록하거나 다른 9홀 코스를 추가할 수 있습니다.' : selectedHoleCount < 18 ? `${selectedHoleCount}/18홀 선택 · 나머지 코스를 선택해 주세요.` : teeOptions.length > 0 ? '기록을 시작하기 전에 티 위치를 선택해 주세요.' : '선택한 홀 전체에 거리 자료가 확인된 코스를 선택해 주세요.'}
                  </div>
                </fieldset>
                {selectedRoutes.map((route, index) => <RouteDistancePreview key={`${route.id}-${index}`} route={route} />)}
                </>
              ) : <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>검증된 9홀 코스 정보가 아직 등록되지 않았습니다.</p>}
        </div>
      )}
    </section>
  )
}
