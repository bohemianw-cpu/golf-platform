'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { GolfCourseRoute } from '@/types/golf'

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
  locked: boolean
  searchOpen: boolean
  onSearchOpenChange: (open: boolean) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  onCourseSelect: (course: GolfCourseOption | null) => void
  onCourseResolved: (course: GolfCourseOption | null) => void
  onRoutesChange: (routes: GolfRouteOption[]) => void
}

export default function CourseCatalogPicker({ courseId, routeIds, locked, searchOpen, onSearchOpenChange, searchQuery, onSearchQueryChange, onCourseSelect, onCourseResolved, onRoutesChange }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [courses, setCourses] = useState<GolfCourseOption[]>([])
  const [selectedCourse, setSelectedCourse] = useState<GolfCourseOption | null>(null)
  const [routes, setRoutes] = useState<GolfRouteOption[]>([])
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

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchQuery, supabase])

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    void supabase
      .from('golf_course_routes')
      .select('id,course_id,route_code,display_name,hole_count,pars,distances_m')
      .eq('course_id', courseId)
      .eq('verification_status', 'verified')
      .order('display_name')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setCatalogError(true)
          return
        }
        setCatalogError(false)
        setRoutes((data ?? []) as GolfRouteOption[])
      })
    return () => { cancelled = true }
  }, [courseId, supabase])

  const selectedRoutes = routeIds.map((id) => routes.find((route) => route.id === id)).filter((route): route is GolfRouteOption => !!route)
  const selectedCourseRoutes = routes.filter((route) => route.course_id === courseId)
  const selectedHoleCount = selectedRoutes.reduce((sum, route) => sum + route.hole_count, 0)
  const selectedLayoutIsValid = selectedHoleCount === 18 && selectedRoutes.every((route) =>
    route.pars.length === route.hole_count && route.distances_m.length === route.hole_count
  )

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    void supabase.from('golf_courses')
      .select('id,name,region,venue_kind,supports_field,supports_screen,hole_count')
      .eq('id', courseId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        const course = data as GolfCourseOption
        setSelectedCourse(course)
        onCourseResolved(course)
      })
    return () => { cancelled = true }
  }, [courseId, supabase, onCourseResolved])

  return (
    <section aria-label="골프장과 코스 검색" style={{ marginTop: searchOpen || (courseId && selectedCourse) ? '10px' : 0 }}>
      {searchOpen && searchQuery.trim().length > 0 && <div style={{ position: 'relative' }}>
        {searchQuery.trim().length >= 1 && (
          <ul id="course-catalog-results" role="listbox" aria-label="골프장 검색 결과" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, maxHeight: '220px', overflowY: 'auto', margin: 0, padding: '4px', listStyle: 'none', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 8px 20px #0f172a1a' }}>
            {loading ? <li role="status" style={{ padding: '9px', fontSize: '12px', color: '#64748b' }}>검색 중…</li>
              : catalogError ? <li role="alert" style={{ padding: '9px', fontSize: '12px', color: '#b91c1c' }}>구장 카탈로그를 불러오지 못했습니다.</li>
                : courses.length === 0 ? <li style={{ padding: '9px', fontSize: '12px', color: '#64748b' }}>검증된 결과가 없습니다. 입력한 구장명으로 임시 기록할 수 있으며, 이 기록은 구장 평균 비교에서 제외됩니다.</li>
                  : courses.map((course) => (
                    <li key={course.id}>
                      <button type="button" role="option" aria-selected={course.id === courseId} disabled={locked} onMouseDown={(event) => event.preventDefault()} onClick={() => { setSelectedCourse(course); onCourseSelect(course); onSearchQueryChange(''); onSearchOpenChange(false) }} style={{ width: '100%', padding: '9px', border: 0, borderRadius: '6px', textAlign: 'left', background: course.id === courseId ? '#ecfdf5' : '#fff', cursor: 'pointer' }}>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{course.name}</span>
                        <span style={{ display: 'block', marginTop: '2px', fontSize: '10px', color: '#64748b' }}>
                          {course.region || '지역 미등록'} · {course.venue_kind === 'virtual_screen' ? '스크린' : course.supports_field && course.supports_screen ? '필드/스크린' : course.supports_field ? '필드' : '스크린'}
                        </span>
                      </button>
                    </li>
                  ))}
          </ul>
        )}
      </div>
      }
      {courseId && selectedCourse && (
        <div style={{ marginTop: '8px', padding: '9px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>{selectedCourse.name} · 카탈로그 검증됨</div>
            <button type="button" disabled={locked} onClick={() => { setSelectedCourse(null); onCourseSelect(null) }} aria-label="선택한 골프장 해제" style={{ border: 0, background: 'transparent', color: '#64748b', cursor: locked ? 'not-allowed' : 'pointer' }}>해제</button>
          </div>
          {catalogError ? <p role="alert" style={{ margin: '6px 0 0', fontSize: '11px', color: '#b91c1c' }}>코스 레이아웃을 불러오지 못했습니다.</p> : selectedCourseRoutes.length > 0 ? (
            <fieldset style={{ margin: '8px 0 0', padding: '7px 8px', border: '1px solid #bbf7d0', borderRadius: '6px', background: '#fff' }}>
              <legend style={{ padding: '0 3px', fontSize: '10px', fontWeight: 700, color: '#166534' }}>오늘 플레이할 코스 순서 선택</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedCourseRoutes.map((route) => {
                  const checked = routeIds.includes(route.id)
                  const selectedHoleCount = selectedRoutes.reduce((sum, item) => sum + item.hole_count, 0)
                  const cannotAdd = !checked && (routeIds.length >= 2 || selectedHoleCount + route.hole_count > 18)
                  return <label key={route.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#334155' }}>
                    <input type="checkbox" checked={checked} disabled={locked || cannotAdd} onChange={() => {
                      const next = checked ? selectedRoutes.filter((item) => item.id !== route.id) : [...selectedRoutes, route]
                      onRoutesChange(next)
                    }} aria-label={`${route.display_name} ${route.hole_count}홀 코스`} />
                    {route.display_name} ({route.hole_count}홀)
                  </label>
                })}
              </div>
              <div style={{ marginTop: '5px', fontSize: '10px', color: '#64748b' }}>
                선택 순서: {selectedRoutes.length ? selectedRoutes.map((route) => route.display_name).join(' → ') : '미선택'}
              </div>
              {selectedRoutes.length > 0 && <div role="status" style={{ marginTop: '4px', fontSize: '10px', color: selectedLayoutIsValid ? '#15803d' : '#b45309' }}>
                {selectedLayoutIsValid ? '18홀 파·거리 정보 확인 완료' : `${selectedHoleCount}/18홀 선택 · 모든 홀의 파와 거리가 검증된 코스만 기록할 수 있습니다.`}
              </div>}
            </fieldset>
          ) : <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>검증된 코스 레이아웃이 아직 등록되지 않았습니다.</p>}
        </div>
      )}
    </section>
  )
}
