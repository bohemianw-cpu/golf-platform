'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
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
  if (totalHoles !== 18 || holes.length !== 18 || routes.some((route) => route.holes?.length !== route.hole_count)) return []
  const firstHoleTees = holes[0]?.tees ?? []
  return firstHoleTees
    .filter((tee) => holes.every((hole) => hole.tees.some((item) => item.tee_code === tee.tee_code)))
    .filter((tee, index, all) => all.findIndex((candidate) => candidate.tee_code === tee.tee_code) === index)
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
    const search = searchQuery.trim()
    if (search.length < 1) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('golf_courses')
        .select('id,name,region,venue_kind,supports_field,supports_screen,hole_count')
        .eq('verification_status', 'verified')
        .ilike('name', `%${search}%`)
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
          .select('hole_id,tee_code,display_name,tee_color,distance_m,green_code,green_name')
          .in('hole_id', holeRows.map((hole) => hole.id))
        : { data: [], error: null }
      if (teeError) throw teeError
      const teesByHole = new Map<string, GolfCourseTee[]>()
      for (const tee of teeData ?? []) {
        const row = tee as GolfCourseTee & { hole_id: string }
        teesByHole.set(row.hole_id, [...(teesByHole.get(row.hole_id) ?? []), {
          tee_code: row.tee_code, display_name: row.display_name, tee_color: row.tee_color, distance_m: row.distance_m,
          green_code: row.green_code ?? 'standard', green_name: row.green_name ?? '기본 그린',
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
  const selectedTee = teeOptions.find((tee) => tee.tee_code === teeCode) ?? null
  const selectedLayoutIsValid = selectedHoleCount === 18 && teeOptions.length > 0 && !!selectedTee

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
                <fieldset style={{ margin: '8px 0 0', padding: '7px 8px', border: '1px solid #bbf7d0', borderRadius: '6px', background: '#fff' }}>
                  <legend style={{ padding: '0 3px', fontSize: '10px', fontWeight: 700, color: '#166534' }}>오늘 플레이할 코스와 티 선택</legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedCourseRoutes.map((route) => {
                      const checked = routeIds.includes(route.id)
                      const cannotAdd = !checked && (routeIds.length >= 2 || selectedHoleCount + route.hole_count > 18)
                      const canRepeat = checked && route.hole_count === 9 && selectedHoleCount === 9 && routeIds.filter((id) => id === route.id).length === 1
                      return <div key={route.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#334155' }}>
                          <input type="checkbox" checked={checked} disabled={locked || cannotAdd} onChange={() => {
                            const next = checked ? selectedRoutes.filter((item) => item.id !== route.id) : [...selectedRoutes, route]
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
                  {selectedHoleCount === 18 && (teeOptions.length > 0 ? (
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
                  ) : <p role="status" style={{ margin: '6px 0 0', fontSize: '10px', color: '#b45309' }}>선택한 18홀 전체에 거리 자료가 있는 공통 티가 없습니다.</p>)}
                  <div role="status" style={{ marginTop: '5px', fontSize: '10px', color: selectedLayoutIsValid ? '#15803d' : '#b45309' }}>
                    {selectedLayoutIsValid ? `18홀 파·거리 확인 완료 · ${selectedTee.display_name}` : selectedHoleCount < 18 ? `${selectedHoleCount}/18홀 선택 · ${selectedHoleCount === 9 ? '다른 9홀 코스 또는 같은 코스 반복을 선택해 주세요.' : '18홀 코스 조합을 선택해 주세요.'}` : teeOptions.length > 0 ? '기록을 시작하기 전에 티 위치를 선택해 주세요.' : '티별 18홀 거리 자료가 확인된 코스만 기록할 수 있습니다.'}
                  </div>
                </fieldset>
              ) : <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>검증된 코스 레이아웃이 아직 등록되지 않았습니다.</p>}
        </div>
      )}
    </section>
  )
}
