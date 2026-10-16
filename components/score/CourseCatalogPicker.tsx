'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/utils/supabase/client'
import { normalizeCourseSearch } from '@/utils/course-name'
import type { GolfCourseHole, GolfCourseTee } from '@/types/golf'
import { color, palette } from '@/utils/theme'
import { DEFAULT_EIGHTEEN_HOLE_NINE_HOLE_COURSES, completeTeeOptions, hasCompleteReferenceDistances, type GolfCourseOption, type GolfRouteOption } from './course-catalog/parts'
import CourseSearchResults from './course-catalog/CourseSearchResults'
import CourseLayoutPlaceholder from './course-catalog/CourseLayoutPlaceholder'
import CourseRouteTeeSelector from './course-catalog/CourseRouteTeeSelector'

export type { GolfCourseOption, GolfRouteOption } from './course-catalog/parts'

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
      <CourseSearchResults searchAnchorRect={searchAnchorRect} loading={loading} catalogError={catalogError} courses={courses} playMode={playMode} locked={locked} onSearchOpenChange={onSearchOpenChange} defaultRepeatAppliedCourseId={defaultRepeatAppliedCourseId} setSelectedCourse={setSelectedCourse} onCourseSelect={onCourseSelect} onSearchQueryChange={onSearchQueryChange} courseId={courseId} screenProvider={screenProvider} />,
      document.body,
    )
    : null

  return (
    <section id="course-catalog-picker" data-score-guide-target="course-layout" aria-label="골프장과 코스 검색" style={{ marginTop: courseId && selectedCourse ? '10px' : 0 }}>
      {searchResults}
      <CourseLayoutPlaceholder courseId={courseId} onNeedCourse={onNeedCourse} />
      <CourseRouteTeeSelector courseId={courseId} selectedCourse={selectedCourse} courseInfoLocked={courseInfoLocked} routesLoading={routesLoading} catalogError={catalogError} selectedCourseRoutes={selectedCourseRoutes} routeIds={routeIds} selectedHoleCount={selectedHoleCount} locked={locked} selectedRoutes={selectedRoutes} teeCode={teeCode} onRoutesChange={onRoutesChange} teeOptions={teeOptions} hasReferenceDistance={hasReferenceDistance} selectedLayoutIsValid={selectedLayoutIsValid} selectedTee={selectedTee} />
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '7px', marginTop: '9px' }}>
        <button type="button" onClick={onStartRound} disabled={!canStartRound} style={{ flex: 1, padding: '9px 12px', border: 0, borderRadius: '7px', background: canStartRound ? color.brand : palette.slate400, color: palette.white, fontSize: '12px', fontWeight: 700, cursor: canStartRound ? 'pointer' : 'not-allowed', opacity: canStartRound ? 1 : 0.7 }}>
          {isSaving ? '● 저장 중…' : courseInfoLocked ? '라운드 진행 중' : '라운드 시작'}
        </button>
        <button type="button" onClick={onUnlockCourse} disabled={!canUnlockCourse} title={canUnlockCourse ? '샷 데이터를 삭제하고 골프장·코스·티 선택을 초기화합니다.' : '등록된 라운드는 변경할 수 없습니다.'} style={{ width: '76px', flexShrink: 0, padding: '7px 8px', border: `1px solid ${palette.red200}`, borderRadius: '7px', background: palette.red100, color: canUnlockCourse ? palette.red600 : palette.slate400, fontSize: '11px', fontWeight: 700, cursor: canUnlockCourse ? 'pointer' : 'not-allowed' }}>
          🗑️ 초기화
        </button>
      </div>
    </section>
  )
}
