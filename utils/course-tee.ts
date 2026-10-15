import type { GolfCourseHole, GolfCourseRoute, GolfCourseTee } from '@/types/golf'

export function teeDisplayOrder(tee: GolfCourseTee): number {
  const label = `${tee.tee_code} ${tee.display_name}`.normalize('NFKC').toLocaleLowerCase('ko-KR')
  if (/black|블랙/.test(label)) return 0
  if (/blue|블루/.test(label)) return 1
  if (/white|화이트/.test(label)) return 2
  if (/yellow|gold|옐로|골드/.test(label)) return 3
  if (/red|레드/.test(label)) return 4
  return 5
}

export function getSelectableCourseTees(routes: GolfCourseRoute[], totalHoles: number): GolfCourseTee[] {
  const holes = routes.flatMap((route) => route.holes ?? [])
  if (totalHoles < 1 || totalHoles > 18 || holes.length !== totalHoles || routes.some((route) => route.holes?.length !== route.hole_count)) return []

  const candidates = holes.flatMap((hole) => hole.tees)
    .filter(isSelectableTee)
    .filter((tee, index, all) => all.findIndex((candidate) => candidate.tee_code === tee.tee_code) === index)
    .map((tee, index) => ({ tee, index }))
    .sort((a, b) => teeDisplayOrder(a.tee) - teeDisplayOrder(b.tee) || a.index - b.index)
    .map(({ tee }) => tee)

  return candidates.filter((candidate) => holes.every((hole) => resolveHoleTeeVariants(hole, candidate.tee_code, candidates).length > 0))
}

export function resolveHoleTeeVariants(
  hole: GolfCourseHole,
  selectedTeeCode: string | null,
  courseTees: GolfCourseTee[],
): GolfCourseTee[] {
  if (!selectedTeeCode) return []
  const playableTees = hole.tees.filter(isSelectableTee)
  const selectedVariants = playableTees.filter((tee) => tee.tee_code === selectedTeeCode)
  if (selectedVariants.length > 0) return selectedVariants

  const selectedTee = courseTees.find((tee) => tee.tee_code === selectedTeeCode)
  if (!selectedTee) return []
  const selectedOrder = teeDisplayOrder(selectedTee)
  const fallback = playableTees
    .filter((tee) => teeDisplayOrder(tee) < selectedOrder)
    .sort((a, b) => teeDisplayOrder(b) - teeDisplayOrder(a))[0]
  return fallback ? playableTees.filter((tee) => tee.tee_code === fallback.tee_code) : []
}

export function isSelectableTee(tee: GolfCourseTee): boolean {
  return tee.tee_selection_available !== false && tee.distance_m > 0
}
