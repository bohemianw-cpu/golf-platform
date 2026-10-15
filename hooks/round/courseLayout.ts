import { getSelectableCourseTees, resolveHoleTeeVariants } from '@/utils/course-tee'
import type { GolfCourseHole, GolfCourseRoute, GolfCourseTee } from '@/types/golf'
import { INITIAL_HOLE_PARS } from '@/utils/golf/clubs'
import { MAX_GOLF_DISTANCE_M, MAX_GOLF_PAR, MIN_GOLF_PAR } from '@/utils/golf/scoring'

/** 그린이 여러 개인 홀은 기본 그린, 왼쪽 그린, 이름순 순서로 고른다. */
export function preferredGreen(variants: GolfCourseTee[]): GolfCourseTee | undefined {
  return variants.find((tee) => tee.green_code === 'standard')
    ?? variants.find((tee) => tee.green_code === 'left')
    ?? [...variants].sort((a, b) => a.green_code.localeCompare(b.green_code))[0]
}

export const isValidPar = (par: number) => par >= MIN_GOLF_PAR && par <= MAX_GOLF_PAR
export const isValidRouteDistance = (distance: number) => distance > 0 && distance <= MAX_GOLF_DISTANCE_M

/** 홀 정보가 모두 있는 경로는 홀별 파를, 아니면 경로에 저장된 파 목록을 쓴다. */
export const routePars = (routes: GolfCourseRoute[]) =>
  routes.flatMap((route) => route.holes?.length === route.hole_count ? route.holes.map((hole) => hole.par) : route.pars)

/** 티를 고르지 않은 코스는 선택할 수 없는 기준 티(공식 거리)를 쓴다. */
export function holeTeeVariants(hole: GolfCourseHole, teeCode: string | null, courseTees: GolfCourseTee[]): GolfCourseTee[] {
  return teeCode
    ? resolveHoleTeeVariants(hole, teeCode, courseTees)
    : hole.tees.filter((tee) => tee.tee_selection_available === false)
}

export interface CourseLayout {
  /** 파와 홀 거리가 모두 있어 코스 정보로 라운드를 진행할 수 있다. */
  valid: boolean
  hasValidPars: boolean
  holePars: number[]
  distances: number[]
  greenCodes: string[]
  greenNames: string[]
  routeHoles: GolfCourseHole[]
}

/** 고른 경로와 티로 홀별 파, 거리, 기본 그린을 정한다. */
export function buildCourseLayout(routes: GolfCourseRoute[], teeCode: string | null): CourseLayout {
  const pars = routePars(routes)
  const hasValidPars = pars.length >= 1 && pars.length <= 18 && pars.every(isValidPar)
  const totalHoles = routes.reduce((sum, route) => sum + route.hole_count, 0)
  const courseTees = getSelectableCourseTees(routes, totalHoles)
  const variantsByHole = routes.flatMap((route) => route.holes?.length === route.hole_count
    ? route.holes.map((hole) => holeTeeVariants(hole, teeCode, courseTees))
    : [])
  const selectedGreens = variantsByHole.map(preferredGreen)
  const distances = selectedGreens.map((tee) => tee?.distance_m ?? 0)
  const routeHoles = routes.flatMap((route) => route.holes ?? [])
  const valid = hasValidPars && distances.length === pars.length && distances.every(isValidRouteDistance)
  if (!valid) {
    return { valid, hasValidPars, holePars: hasValidPars ? pars : INITIAL_HOLE_PARS, distances: [], greenCodes: [], greenNames: [], routeHoles }
  }
  const holePars = routes.flatMap((route) => route.holes?.length === route.hole_count
    ? route.holes.map((hole) => preferredGreen(holeTeeVariants(hole, teeCode, courseTees))?.par ?? hole.par)
    : route.pars)
  return {
    valid,
    hasValidPars,
    holePars,
    distances,
    greenCodes: selectedGreens.map((tee) => tee?.green_code ?? 'standard'),
    greenNames: selectedGreens.map((tee) => tee?.green_name ?? '기본 그린'),
    routeHoles,
  }
}
