import type { createClient } from '@/utils/supabase/client'
import { getSelectableCourseTees, resolveHoleTeeVariants } from '@/utils/course-tee'
import type { BallLie, GolfCourseHole, GolfCourseRoute, GolfCourseTee, HoleRecord, ShotRecord } from '@/types/golf'
import { INITIAL_HOLE_PARS } from '@/utils/golf/clubs'
import { defaultDistanceForPar } from '@/utils/golf/scoring'
import { isValidPar, isValidRouteDistance, preferredGreen, routePars } from './courseLayout'

type SupabaseClient = ReturnType<typeof createClient>

export interface RoundRow {
  id: string
  club_name?: string | null
  golf_club?: string | null
  course_name?: string | null
  play_mode?: 'field' | 'screen' | null
  screen_provider?: string | null
  entry_mode?: 'live' | 'backfill'
  course_id?: string | null
  route_ids?: string[]
  tee_code?: string | null
  tee_name?: string | null
}

interface HoleRow {
  hole_number: number
  par: number
  score: number
  putts: number
  fairway_hit: boolean | null
  gir: boolean
  total_distance?: number | null
  green_code?: string | null
  green_name?: string | null
}

interface RoundShotRow {
  hole_number: number
  shot_number: number
  club: string
  distance_to_pin_before: number
  distance_to_pin_after: number
  shot_distance: number
  ball_lie: BallLie
  penalty: number
  input_method?: 'manual' | 'quick_putt'
}

/** 서버에 저장된 진행 중 라운드를 이어서 입력하기 위해 화면 상태로 옮길 값. */
export interface ResumedRound {
  round: RoundRow
  holePars: number[]
  courseParsAvailable: boolean
  /** 코스 정보로 홀 거리를 정할 수 있을 때만 채운다. */
  routeDistances: number[]
  greenCodes: string[]
  greenNames: string[]
  routeHoles: GolfCourseHole[]
  completedHoles: HoleRecord[]
  targetHoleCount: number
  nextHole: number
  /** 이어서 입력할 홀에 이미 저장된 샷. */
  partialShots: ShotRecord[]
  partialHoleDistance: number
}

async function loadRouteRows(supabase: SupabaseClient, routeIds: string[]): Promise<GolfCourseRoute[]> {
  const { data, error: routeError } = await supabase
    .from('golf_course_routes')
    .select('id,course_id,route_code,display_name,hole_count,pars,distances_m')
    .in('id', routeIds)
  if (routeError) throw routeError
  const routeMap = new Map(((data ?? []) as GolfCourseRoute[]).map((route) => [route.id, route]))
  const routeRows = routeIds.flatMap((id) => routeMap.get(id) ? [routeMap.get(id)!] : [])
  const { data: holeData, error: courseHolesError } = await supabase
    .from('golf_course_holes')
    .select('id,route_id,hole_number,play_order,par,handicap_index')
    .in('route_id', routeIds)
    .order('play_order')
  if (courseHolesError) throw courseHolesError
  const courseHoles = (holeData ?? []) as { id: string; route_id: string; hole_number: number; play_order: number; par: number; handicap_index: number | null }[]
  const { data: teeData, error: courseTeesError } = courseHoles.length
    ? await supabase.from('golf_course_hole_tees')
      .select('hole_id,tee_code,display_name,tee_color,tee_selection_available,distance_m,distance_m_source,source_distance,source_unit,green_code,green_name,par')
      .in('hole_id', courseHoles.map((hole) => hole.id))
    : { data: [], error: null }
  if (courseTeesError) throw courseTeesError
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
  const withHoles: GolfCourseRoute[] = routeRows.map((route) => ({
    ...route,
    holes: courseHoles.filter((hole) => hole.route_id === route.id).map((hole) => ({ ...hole, tees: teesByHole.get(hole.id) ?? [] })),
  }))
  return routeIds.map((routeId) => withHoles.find((route) => route.id === routeId)).filter((route): route is GolfCourseRoute => !!route)
}

/** 라운드의 홀·샷 기록과 코스 정보를 불러와 이어서 입력할 상태를 만든다. */
export async function loadResumedRound(supabase: SupabaseClient, round: RoundRow): Promise<ResumedRound> {
  const [{ data: holes, error }, { data: shotRows, error: shotsError }] = await Promise.all([
    supabase
      .from('round_holes')
      .select('*')
      .eq('round_id', round.id)
      .order('hole_number', { ascending: true }),
    supabase
      .from('round_shots')
      .select('*')
      .eq('round_id', round.id)
      .order('hole_number', { ascending: true })
      .order('shot_number', { ascending: true }),
  ])
  if (error) throw error
  if (shotsError) throw shotsError

  const routeRows = round.route_ids?.length ? await loadRouteRows(supabase, round.route_ids) : []
  const pars = routePars(routeRows)
  const roundCourseTees = getSelectableCourseTees(routeRows, routeRows.reduce((sum, route) => sum + route.hole_count, 0))
  const savedTeeAvailableOnAllHoles = !!round.tee_code && routeRows.length > 0 && routeRows.every((route) =>
    route.holes?.length === route.hole_count && route.holes.every((hole) => resolveHoleTeeVariants(hole, round.tee_code ?? null, roundCourseTees).length > 0),
  )
  const savedReferenceAvailableOnAllHoles = !round.tee_code && routeRows.length > 0 && routeRows.every((route) =>
    route.holes?.length === route.hole_count && route.holes.every((hole) => hole.tees.some((tee) => tee.tee_selection_available === false)),
  )
  const teeVariants = savedTeeAvailableOnAllHoles
    ? routeRows.flatMap((route) => route.holes!.map((hole) => resolveHoleTeeVariants(hole, round.tee_code ?? null, roundCourseTees)))
    : savedReferenceAvailableOnAllHoles
      ? routeRows.flatMap((route) => route.holes!.map((hole) => hole.tees.filter((tee) => tee.tee_selection_available === false)))
      : []
  const persistedHoles = (holes ?? []) as HoleRow[]
  // 저장된 홀은 그때 고른 그린을 유지하고, 아직 안 친 홀은 기본 그린을 고른다.
  const greenCodes = teeVariants.map((variants, index) => {
    const oldRecord = persistedHoles.find((hole) => hole.hole_number === index + 1)
    const savedCode = oldRecord && 'green_code' in oldRecord ? oldRecord.green_code : null
    return variants.find((tee) => tee.green_code === savedCode)?.green_code ?? preferredGreen(variants)?.green_code ?? 'standard'
  })
  const greenNames = teeVariants.map((variants, index) => variants.find((tee) => tee.green_code === greenCodes[index])?.green_name ?? '기본 그린')
  const routeDistances = savedTeeAvailableOnAllHoles
    ? teeVariants.map((variants, index) => variants.find((tee) => tee.green_code === greenCodes[index])?.distance_m ?? preferredGreen(variants)?.distance_m ?? 0)
    : routeRows.flatMap((route) => route.distances_m)
  const hasFullRouteLayout = pars.length >= 1 && pars.length <= 18 && routeDistances.length === pars.length &&
    routeDistances.every(isValidRouteDistance)
  const holePars = hasFullRouteLayout ? [...pars] : [...INITIAL_HOLE_PARS]

  const shotsByHole = new Map<number, ShotRecord[]>()
  for (const row of (shotRows ?? []) as RoundShotRow[]) {
    shotsByHole.set(row.hole_number, [...(shotsByHole.get(row.hole_number) ?? []), {
      shotNumber: row.shot_number,
      club: row.club,
      distanceToPinBefore: row.distance_to_pin_before,
      distanceToPinAfter: row.distance_to_pin_after,
      shotDistance: row.shot_distance,
      ballLie: row.ball_lie,
      penalty: row.penalty,
      inputMethod: row.input_method ?? 'manual',
    }])
  }
  const completedHoles: HoleRecord[] = persistedHoles.map((h) => {
    holePars[h.hole_number - 1] = h.par
    return {
      holeNumber: h.hole_number,
      greenCode: h.green_code ?? 'standard',
      greenName: h.green_name ?? '기본 그린',
      par: h.par,
      totalDistance: h.total_distance ?? defaultDistanceForPar(h.par),
      shots: shotsByHole.get(h.hole_number) ?? [],
      score: h.score,
      scoreDiff: h.score - h.par,
      putts: h.putts,
      fairwayHit: h.fairway_hit,
      gir: h.gir,
    }
  })

  const targetHoleCount = hasFullRouteLayout ? pars.length : 18
  const nextHole = completedHoles.length ? Math.min(targetHoleCount, Math.max(...completedHoles.map((h) => h.holeNumber)) + 1) : 1
  return {
    round,
    holePars,
    courseParsAvailable: pars.length >= 1 && pars.length <= 18 && pars.every(isValidPar),
    routeDistances: hasFullRouteLayout ? routeDistances : [],
    greenCodes,
    greenNames,
    routeHoles: routeRows.flatMap((route) => route.holes ?? []),
    completedHoles,
    targetHoleCount,
    nextHole,
    partialShots: shotsByHole.get(nextHole) ?? [],
    partialHoleDistance: (hasFullRouteLayout ? routeDistances[nextHole - 1] : undefined) ?? defaultDistanceForPar(holePars[nextHole - 1] ?? 4),
  }
}
