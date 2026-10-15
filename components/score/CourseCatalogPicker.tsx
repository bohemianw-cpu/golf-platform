'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/utils/supabase/client'
import { normalizeCourseSearch } from '@/utils/course-name'
import { getSelectableCourseTees, isSelectableTee, resolveHoleTeeVariants, teeDisplayOrder } from '@/utils/course-tee'
import type { GolfCourseHole, GolfCourseRoute, GolfCourseTee } from '@/types/golf'

export interface GolfCourseOption {
  id: string
  name: string
  region: string | null
  venue_kind: 'physical' | 'virtual_screen'
  supports_field: boolean
  supports_screen: boolean
  hole_count: number | null
  aliases?: string[]
}

export type GolfRouteOption = GolfCourseRoute

interface Props {
  courseId: string | null
  playMode: 'field' | 'screen' | null
  screenProvider: string | null
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
  onNeedCourse: () => void
  onStartRound: () => void
  onUnlockCourse: () => void
  courseInfoLocked: boolean
  canUnlockCourse: boolean
  isSaving: boolean
}

const DEFAULT_EIGHTEEN_HOLE_NINE_HOLE_COURSES = new Set(['남양주CC', '태광CC(퍼블릭)'])

function completeTeeOptions(routes: GolfRouteOption[], totalHoles: number): GolfCourseTee[] {
  return getSelectableCourseTees(routes, totalHoles)
}

function hasCompleteReferenceDistances(routes: GolfRouteOption[], totalHoles: number): boolean {
  const holes = routes.flatMap((route) => route.holes ?? [])
  return totalHoles >= 1 && totalHoles <= 18
    && holes.length === totalHoles
    && routes.every((route) => route.holes?.length === route.hole_count)
    && holes.every((hole) => hole.tees.some((tee) => tee.tee_selection_available === false))
}

function RouteDistancePreview({ route, selectedTeeCode, courseTees }: { route: GolfRouteOption; selectedTeeCode: string | null; courseTees: GolfCourseTee[] }) {
  const holes = route.holes ?? []
  const routeTees = holes.flatMap((hole) => hole.tees)
    .filter((tee, index, all) => all.findIndex((candidate) => candidate.tee_code === tee.tee_code) === index)
  const selectedTee = courseTees.find((tee) => tee.tee_code === selectedTeeCode)
  const tees = [...routeTees, ...(selectedTee && !routeTees.some((tee) => tee.tee_code === selectedTee.tee_code) ? [selectedTee] : [])]
    .sort((a, b) => teeDisplayOrder(a) - teeDisplayOrder(b))
  const parTotal = holes.reduce((sum, hole) => sum + hole.par, 0)

  return (
    <details className="course-hole-preview" style={{ marginTop: '8px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#fff' }}>
      <summary className="course-hole-preview__summary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px', fontSize: '11px', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
        {route.display_name} 홀별 정보 · {holes.length}홀 · Par {parTotal}
      </summary>
      <div className="course-hole-preview__content" style={{ padding: '0 6px 6px' }}>
        <table className="course-hole-preview__table" aria-label={`${route.display_name} 홀별 파와 티 거리`} style={{ width: '100%', minWidth: 0, borderCollapse: 'collapse', textAlign: 'center' }}>
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '8%' }} />
            {tees.map((tee) => <col key={tee.tee_code} style={{ width: `${85 / Math.max(tees.length, 1)}%` }} />)}
          </colgroup>
          <thead>
            <tr style={{ background: '#f8fafc', color: '#475569' }}>
              <th scope="col" style={{ padding: '4px 2px', borderBottom: '1px solid #e2e8f0' }}>홀</th>
              <th scope="col" style={{ padding: '4px 2px', borderBottom: '1px solid #e2e8f0' }}>Par</th>
              {tees.map((tee) => <th key={tee.tee_code} scope="col" aria-label={`${tee.display_name}${tee.tee_code === selectedTeeCode ? ', 선택한 티' : ''}`} className={tee.tee_code === selectedTeeCode ? 'course-hole-preview__selected-tee' : undefined} style={{ padding: '4px 2px', borderBottom: '1px solid #e2e8f0' }}>
                {!isSelectableTee(tee)
                  ? <span>{tee.display_name}</span>
                  : <><span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, marginRight: 4, border: '1px solid #94a3b8', borderRadius: '50%', background: tee.tee_color, verticalAlign: '-1px' }} />{tee.display_name}</>}
              </th>)}
            </tr>
          </thead>
          <tbody>
            {holes.map((hole) => {
              const par = holeParDisplay(hole)
              return <tr key={hole.id}>
                <th scope="row" style={{ padding: '6px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{hole.hole_number}</th>
                <td style={{ padding: '6px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>{par}</td>
                {tees.map((tee) => {
                  const isSelectedTee = tee.tee_code === selectedTeeCode
                  const variants = isSelectedTee
                    ? resolveHoleTeeVariants(hole, selectedTeeCode, courseTees)
                    : hole.tees.filter((item) => item.tee_code === tee.tee_code)
                  const usingFallbackTee = isSelectedTee && variants[0]?.tee_code !== selectedTeeCode
                  return <td key={tee.tee_code} className={tee.tee_code === selectedTeeCode ? 'course-hole-preview__selected-tee' : undefined} style={{ padding: '5px 2px', borderBottom: '1px solid #f1f5f9', color: variants.length ? '#0f172a' : '#94a3b8', fontWeight: tee.tee_code === selectedTeeCode ? 700 : 400 }}>
                    {variants.length
                      ? `${variants.map((item) => variants.length > 1 || item.green_code !== 'standard' ? `${item.green_name} ${formatTeeDistance(item)}` : formatTeeDistance(item)).join(' · ')}${usingFallbackTee ? ` (${variants[0]?.display_name} 대체)` : ''}`
                      : '미제공'}
                  </td>
                })}
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function holeParDisplay(hole: GolfCourseHole): string {
  const overrides = [...new Set(hole.tees.map((tee) => tee.par).filter((par): par is number => par != null))].sort()
  return overrides.length > 0 ? overrides.join('/') : String(hole.par)
}

function formatTeeDistance(tee: GolfCourseTee): string {
  const originalYards = tee.source_unit === 'yd' && tee.source_distance != null ? ` · ${tee.source_distance}yd` : ''
  const sourceLabel = tee.distance_m_source === 'official'
    ? tee.tee_selection_available === false ? ' (기준 M)' : ''
    : tee.source_unit === 'yd' ? ' (환산 M)' : ''
  return `${tee.distance_m}m${originalYards}${sourceLabel}`
}

export default function CourseCatalogPicker({ courseId, playMode, screenProvider, routeIds, teeCode, locked, searchOpen, onSearchOpenChange, searchQuery, onSearchQueryChange, onCourseSelect, onCourseResolved, onRoutesChange, onNeedCourse, onStartRound, onUnlockCourse, courseInfoLocked, canUnlockCourse, isSaving }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [courses, setCourses] = useState<GolfCourseOption[]>([])
  const [selectedCourse, setSelectedCourse] = useState<GolfCourseOption | null>(null)
  const [routes, setRoutes] = useState<GolfRouteOption[]>([])
  const [routesForCourseId, setRoutesForCourseId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [catalogError, setCatalogError] = useState(false)
  const [searchAnchorRect, setSearchAnchorRect] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null)
  const defaultRepeatAppliedCourseId = useRef<string | null>(null)
  const search = normalizeCourseSearch(searchQuery)

  useEffect(() => {
    if (!searchOpen) return
    const updatePosition = () => {
      const input = document.getElementById('course-catalog-search')
      if (!input) return
      const rect = input.getBoundingClientRect()
      setSearchAnchorRect({
        left: rect.left,
        top: rect.bottom,
        width: rect.width,
        maxHeight: Math.max(100, Math.min(window.innerHeight * 0.48, window.innerHeight - rect.bottom - 8)),
      })
    }
    const frame = window.requestAnimationFrame(updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [searchOpen, searchQuery])

  useEffect(() => {
    if (!searchOpen || !playMode || (playMode === 'screen' && !screenProvider)) {
      return
    }
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setCourses([])
      setLoading(true)
      setCatalogError(false)
    })
    const timer = window.setTimeout(async () => {
      const { data, error } = search
        ? await supabase.rpc('search_verified_golf_courses_by_mode', {
          p_query: search,
          p_play_mode: playMode,
          p_screen_provider: playMode === 'screen' ? screenProvider : null,
        })
        : await supabase.rpc('list_popular_verified_golf_courses', {
          p_play_mode: playMode,
          p_screen_provider: playMode === 'screen' ? screenProvider : null,
        })
      if (cancelled) return
      setLoading(false)
      setCatalogError(!!error)
      setCourses(error ? [] : (data ?? []) as GolfCourseOption[])
    }, 220)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [searchOpen, search, playMode, screenProvider, supabase])

  useEffect(() => {
    if (!courseId || !playMode || (playMode === 'screen' && !screenProvider)) {
      return
    }
    let cancelled = false
    void (async () => {
      const { data: routeData, error: routeError } = await supabase
        .from('golf_course_routes')
        .select('id,course_id,route_code,display_name,hole_count,pars,distances_m,source_url')
        .eq('course_id', courseId)
        .eq('play_mode', playMode)
        .eq('screen_provider', playMode === 'screen' ? screenProvider : '')
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
        .select('id,route_id,hole_number,play_order,par,handicap_index')
        .in('route_id', routeRows.map((route) => route.id))
        .order('play_order')
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
  }, [courseId, playMode, screenProvider, supabase])

  useEffect(() => {
    if (!courseId || playMode !== 'field') {
      defaultRepeatAppliedCourseId.current = null
      return
    }
    if (defaultRepeatAppliedCourseId.current === courseId
      || !selectedCourse || !DEFAULT_EIGHTEEN_HOLE_NINE_HOLE_COURSES.has(selectedCourse.name)
      || routesForCourseId !== courseId
      || routeIds.length > 0
      || routes.length !== 1
      || routes[0].hole_count !== 9) return

    defaultRepeatAppliedCourseId.current = courseId
    onRoutesChange([routes[0], routes[0]], null, null)
  }, [courseId, playMode, onRoutesChange, routeIds.length, routes, routesForCourseId, selectedCourse])

  useEffect(() => {
    if (!courseId) {
      let cancelled = false
      queueMicrotask(() => {
        if (cancelled) return
        setSelectedCourse(null)
        onCourseResolved(null)
      })
      return () => { cancelled = true }
    }
    let cancelled = false
    void supabase.from('golf_courses')
      .select('id,name,region,venue_kind,supports_field,supports_screen,hole_count,aliases')
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
  const selectedLayoutIsValid = selectedHoleCount >= 1 && selectedHoleCount <= 18 && (teeOptions.length > 0 ? !!selectedTee : hasReferenceDistance)
  const canStartRound = !locked && !!selectedCourse && !!playMode
    && (playMode === 'field' ? selectedCourse.supports_field : !!screenProvider && selectedCourse.supports_screen)
    && selectedLayoutIsValid && !routesLoading && !catalogError
  const searchResults = typeof document !== 'undefined' && searchOpen && searchAnchorRect
    ? createPortal(
      <ul id="course-catalog-results" aria-label="골프장 검색 결과" style={{ position: 'fixed', top: searchAnchorRect.top, left: searchAnchorRect.left, width: searchAnchorRect.width, maxHeight: searchAnchorRect.maxHeight, overflowY: 'auto', overscrollBehavior: 'contain', margin: 0, padding: '4px', listStyle: 'none', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '0 0 8px 8px', boxShadow: '0 8px 20px #0f172a1a', zIndex: 1000 }}>
        {loading ? <li role="status" style={{ padding: '9px', fontSize: '12px', color: '#64748b' }}>검색 중…</li>
          : catalogError ? <li role="alert" style={{ padding: '9px', fontSize: '12px', color: '#b91c1c' }}>구장 카탈로그를 불러오지 못했습니다.</li>
            : courses.length === 0 ? <li style={{ padding: '9px', fontSize: '12px', color: '#64748b' }}>{playMode === 'screen' ? '이 서비스에 등록된 검증된 스크린 코스가 없습니다.' : '검증된 필드 골프장이 없습니다.'}</li>
              : courses.map((course) => (
                <li key={course.id}>
                  <button
                    type="button"
                    data-course-option="true"
                    disabled={locked}
                    onMouseDown={(event) => event.preventDefault()}
                    onKeyDown={(event) => {
                      const options = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-course-option="true"]:not(:disabled)'))
                      const index = options.indexOf(event.currentTarget)
                      if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        options[index + 1]?.focus()
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        if (index === 0) document.getElementById('course-catalog-search')?.focus()
                        else options[index - 1]?.focus()
                      } else if (event.key === 'Escape') {
                        event.preventDefault()
                        onSearchOpenChange(false)
                        const input = document.getElementById('course-catalog-search')
                        if (input) {
                          input.dataset.skipOpenOnFocus = 'true'
                          input.focus()
                        }
                      }
                    }}
                    onClick={() => { defaultRepeatAppliedCourseId.current = null; setSelectedCourse(course); onCourseSelect(course); onSearchQueryChange(''); onSearchOpenChange(false) }}
                    style={{ width: '100%', padding: '9px', border: 0, borderRadius: '6px', textAlign: 'left', background: course.id === courseId ? '#ecfdf4' : '#fff', cursor: 'pointer' }}
                  >
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{course.name}</span>
                    <span style={{ display: 'block', marginTop: '2px', fontSize: '10px', color: '#64748b' }}>
                      {course.region || '지역 미등록'} · {playMode === 'screen' ? `스크린 · ${screenProvider}` : '필드'}
                    </span>
                  </button>
                </li>
              ))}
      </ul>,
      document.body,
    )
    : null

  return (
    <section id="course-catalog-picker" data-score-guide-target="course-layout" aria-label="골프장과 코스 검색" style={{ marginTop: courseId && selectedCourse ? '10px' : 0 }}>
      {searchResults}
      {!courseId && <div aria-disabled="true" style={{ marginTop: '8px', padding: '9px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', opacity: 0.45, filter: 'grayscale(0.35)' }}>
        <fieldset style={{ margin: 0, padding: '7px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff' }}>
          <legend style={{ padding: '0 3px', fontSize: '10px', fontWeight: 700, color: '#334155' }}>오늘 플레이할 코스와 티 선택</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {['OUT 코스', 'IN 코스'].map((name) => <button key={name} type="button" aria-disabled="true" onClick={onNeedCourse} style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', color: '#475569', fontSize: '11px', cursor: 'pointer' }}>{name} (9홀)</button>)}
          </div>
          <div style={{ marginTop: '5px', fontSize: '10px', color: '#64748b' }}>선택 순서: OUT → IN</div>
          <fieldset style={{ margin: '8px 0 0', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff' }}>
            <legend style={{ padding: '0 3px', fontSize: '10px', fontWeight: 700 }}>이번 라운드 티 위치</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {[
                ['black', '블랙티', '#111827'],
                ['white', '화이트티', '#ffffff'],
                ['red', '레드티', '#ef4444'],
              ].map(([code, name, color]) => <button key={code} type="button" aria-disabled="true" onClick={onNeedCourse} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 2px', border: 0, background: 'transparent', color: '#334155', fontSize: '11px', cursor: 'pointer' }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', border: '1px solid #64748b', background: color }} />{name}
              </button>)}
            </div>
          </fieldset>
          {['OUT', 'IN'].map((routeName) => <details key={routeName} className="course-hole-preview" style={{ marginTop: '8px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#fff' }}>
            <summary className="course-hole-preview__summary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px', fontSize: '11px', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
              {routeName} 코스 홀별 정보 · 9홀
            </summary>
            <div className="course-hole-preview__content" style={{ padding: '0 6px 6px' }}>
              <table className="course-hole-preview__table" aria-label={`${routeName} 코스 홀별 정보`} style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px' }}>
                <thead><tr style={{ background: '#f8fafc', color: '#475569' }}><th style={{ padding: 5 }}>홀</th><th style={{ padding: 5 }}>Par</th><th style={{ padding: 5 }}>블랙티</th><th style={{ padding: 5 }}>화이트티</th><th style={{ padding: 5 }}>레드티</th></tr></thead>
                <tbody>{Array.from({ length: 9 }, (_, index) => <tr key={index + 1}>
                  <th scope="row" style={{ padding: 5, borderTop: '1px solid #f1f5f9' }}>{index + 1}</th>
                  {Array.from({ length: 4 }, (_, column) => <td key={column} style={{ padding: 5, borderTop: '1px solid #f1f5f9', color: '#94a3b8' }}>-</td>)}
                </tr>)}</tbody>
              </table>
            </div>
          </details>)}
        </fieldset>
      </div>}
      {courseId && selectedCourse && !courseInfoLocked && (
        <div style={{ marginTop: '8px', padding: '9px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>{selectedCourse.name} · 카탈로그 검증됨</div>
          </div>
          {routesLoading ? <p role="status" style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>코스 정보를 불러오는 중…</p>
            : catalogError ? <p role="alert" style={{ margin: '6px 0 0', fontSize: '11px', color: '#b91c1c' }}>코스 레이아웃을 불러오지 못했습니다.</p>
              : selectedCourseRoutes.length > 0 ? (
                <>
                <fieldset style={{ margin: '8px 0 0', padding: '7px 8px', border: '1px solid #bbf7d0', borderRadius: '6px', background: '#fff' }}>
                  <legend style={{ padding: '0 3px', fontSize: '10px', fontWeight: 700, color: '#166534' }}>오늘 플레이할 코스와 티 선택</legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedCourseRoutes.map((route) => {
                      const routeUseCount = routeIds.filter((id) => id === route.id).length
                      const checked = routeUseCount > 0
                      const cannotAdd = !checked && selectedHoleCount + route.hole_count > 18
                      const canRepeat = checked && selectedHoleCount + route.hole_count <= 18
                      const isNineHoleChoice = selectedCourse.hole_count === 9 && selectedCourseRoutes.length === 1 && route.hole_count === 9
                      return <div key={route.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#334155' }}>
                          <input type="checkbox" checked={checked} disabled={locked || cannotAdd} onChange={() => {
                            const next = [...selectedRoutes]
                            if (checked) {
                              const remaining = next.filter((item) => item.id !== route.id)
                              const options = completeTeeOptions(remaining, remaining.reduce((sum, item) => sum + item.hole_count, 0))
                              const retained = options.find((item) => item.tee_code === teeCode) ?? null
                              onRoutesChange(remaining, retained?.tee_code ?? null, retained?.display_name ?? null)
                              return
                            }
                            else next.push(route)
                            const options = completeTeeOptions(next, next.reduce((sum, item) => sum + item.hole_count, 0))
                            const retained = options.find((item) => item.tee_code === teeCode) ?? null
                            onRoutesChange(next, retained?.tee_code ?? null, retained?.display_name ?? null)
                          }} aria-label={`${route.display_name} ${route.hole_count}홀 코스`} />
                          {route.display_name} ({route.hole_count}홀{routeUseCount > 1 ? ` · ${routeUseCount}회 선택` : ''})
                        </label>
                        {canRepeat && !isNineHoleChoice && <button type="button" disabled={locked} aria-label={`${route.display_name} 코스 ${route.hole_count}홀 추가 반복`} onClick={() => {
                          const next = [...selectedRoutes, route]
                          const options = completeTeeOptions(next, next.reduce((sum, item) => sum + item.hole_count, 0))
                          const retained = options.find((item) => item.tee_code === teeCode) ?? null
                          onRoutesChange(next, retained?.tee_code ?? null, retained?.display_name ?? null)
                        }} style={{ padding: '3px 6px', border: '1px solid #bbf7d0', borderRadius: '5px', background: '#f0fdf4', color: '#166534', fontSize: '10px', cursor: locked ? 'not-allowed' : 'pointer' }}>+{route.hole_count}홀 반복</button>}
                      </div>
                    })}
                  </div>
                  {selectedCourse.hole_count === 9 && selectedCourseRoutes.length === 1 && selectedCourseRoutes[0].hole_count === 9 && selectedRoutes.length > 0 && selectedRoutes.every((route) => route.id === selectedCourseRoutes[0].id) && (
                    <fieldset style={{ display: 'flex', gap: '14px', margin: '8px 0 0', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                      <legend style={{ fontSize: '10px', fontWeight: 700 }}>라운드 홀 수</legend>
                      {[9, 18].map((count) => <label key={count} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                        <input type="radio" name="course-hole-count" value={count} checked={selectedHoleCount === count} disabled={locked} onChange={() => {
                          const next = Array.from({ length: count / 9 }, () => selectedCourseRoutes[0])
                          onRoutesChange(next, null, null)
                        }} />
                        {count === 18 ? `18홀 (${selectedCourseRoutes[0].display_name} 2회)` : '9홀'}
                      </label>)}
                    </fieldset>
                  )}
                  <div style={{ marginTop: '5px', fontSize: '10px', color: '#64748b' }}>
                    선택 순서: {selectedRoutes.length ? selectedRoutes.map((route) => route.display_name).join(' → ') : '미선택'}
                  </div>
                  {selectedHoleCount > 0 && selectedHoleCount <= 18 && (teeOptions.length > 0 ? (
                    <fieldset style={{ margin: '8px 0 0', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                      <legend style={{ fontSize: '10px', fontWeight: 700 }}>이번 라운드 티 위치 (필수)</legend>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {teeOptions.map((tee) => <label key={tee.tee_code} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
                          <input type="radio" name="course-tee" value={tee.tee_code} checked={teeCode === tee.tee_code} disabled={locked} onChange={() => onRoutesChange(selectedRoutes, tee.tee_code, tee.display_name)} />
                          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', border: '1px solid #64748b', background: tee.tee_color }} />
                          {tee.display_name}
                        </label>)}
                      </div>
                      <p style={{ margin: '5px 0 0', fontSize: '10px', color: '#64748b' }}>선택한 티 거리가 없는 홀은 한 단계 높은 티로 자동 적용됩니다.</p>
                    </fieldset>
                  ) : hasReferenceDistance
                    ? <p role="status" style={{ margin: '6px 0 0', fontSize: '10px', color: '#475569' }}>공식 기준 거리는 있으나 티 위치는 공개되지 않았습니다. 기준 거리로 기록하며 티 위치는 선택하지 않습니다.</p>
                    : <p role="status" style={{ margin: '6px 0 0', fontSize: '10px', color: '#b45309' }}>선택한 {selectedHoleCount}홀 전체에 공통 티별 거리 자료가 없습니다.</p>)}
                  <div role="status" style={{ marginTop: '5px', fontSize: '10px', color: selectedLayoutIsValid ? '#15803d' : '#b45309' }}>
                    {selectedLayoutIsValid ? `${selectedHoleCount}홀 파·거리 확인 완료 · ${selectedTee?.display_name ?? '공식 기준 거리 (티 미표기)'}` : selectedHoleCount === 0 ? '기록할 코스를 선택해 주세요.' : selectedHoleCount > 18 ? '라운드 기록은 최대 18홀까지 선택할 수 있습니다.' : teeOptions.length > 0 ? '기록을 시작하기 전에 티 위치를 선택해 주세요.' : '선택한 홀 전체에 확인된 파·거리 자료가 있는 코스를 선택해 주세요.'}
                  </div>
                </fieldset>
                {selectedRoutes.map((route, index) => <RouteDistancePreview key={`${route.id}-${index}`} route={route} selectedTeeCode={teeCode} courseTees={teeOptions} />)}
                </>
              ) : <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>검증된 코스 레이아웃이 아직 등록되지 않았습니다.</p>}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '7px', marginTop: '9px' }}>
        <button type="button" onClick={onStartRound} disabled={!canStartRound} style={{ flex: 1, padding: '9px 12px', border: 0, borderRadius: '7px', background: canStartRound ? '#047857' : '#94a3b8', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: canStartRound ? 'pointer' : 'not-allowed', opacity: canStartRound ? 1 : 0.7 }}>
          {isSaving ? '● 저장 중…' : courseInfoLocked ? '라운드 진행 중' : '라운드 시작'}
        </button>
        <button type="button" onClick={onUnlockCourse} disabled={!canUnlockCourse} title={canUnlockCourse ? '샷 데이터를 삭제하고 골프장·코스·티 선택을 초기화합니다.' : '등록된 라운드는 변경할 수 없습니다.'} style={{ width: '76px', flexShrink: 0, padding: '7px 8px', border: '1px solid #fecaca', borderRadius: '7px', background: '#fee2e2', color: canUnlockCourse ? '#dc2626' : '#94a3b8', fontSize: '11px', fontWeight: 700, cursor: canUnlockCourse ? 'pointer' : 'not-allowed' }}>
          🗑️ 초기화
        </button>
      </div>
    </section>
  )
}
