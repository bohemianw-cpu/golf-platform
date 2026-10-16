import { getSelectableCourseTees, isSelectableTee, resolveHoleTeeVariants, teeDisplayOrder } from '@/utils/course-tee'
import type { GolfCourseHole, GolfCourseRoute, GolfCourseTee } from '@/types/golf'
import { palette } from '@/utils/theme'

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

export const DEFAULT_EIGHTEEN_HOLE_NINE_HOLE_COURSES = new Set(['남양주CC', '태광CC(퍼블릭)'])

export function completeTeeOptions(routes: GolfRouteOption[], totalHoles: number): GolfCourseTee[] {
  return getSelectableCourseTees(routes, totalHoles)
}

export function hasCompleteReferenceDistances(routes: GolfRouteOption[], totalHoles: number): boolean {
  const holes = routes.flatMap((route) => route.holes ?? [])
  return totalHoles >= 1 && totalHoles <= 18
    && holes.length === totalHoles
    && routes.every((route) => route.holes?.length === route.hole_count)
    && holes.every((hole) => hole.tees.some((tee) => tee.tee_selection_available === false))
}

export function RouteDistancePreview({ route, selectedTeeCode, courseTees }: { route: GolfRouteOption; selectedTeeCode: string | null; courseTees: GolfCourseTee[] }) {
  const holes = route.holes ?? []
  const routeTees = holes.flatMap((hole) => hole.tees)
    .filter((tee, index, all) => all.findIndex((candidate) => candidate.tee_code === tee.tee_code) === index)
  const selectedTee = courseTees.find((tee) => tee.tee_code === selectedTeeCode)
  const tees = [...routeTees, ...(selectedTee && !routeTees.some((tee) => tee.tee_code === selectedTee.tee_code) ? [selectedTee] : [])]
    .sort((a, b) => teeDisplayOrder(a) - teeDisplayOrder(b))
  const parTotal = holes.reduce((sum, hole) => sum + hole.par, 0)

  return (
    <details className="course-hole-preview" style={{ marginTop: '8px', border: `1px solid ${palette.slate200}`, borderRadius: '7px', background: palette.white }}>
      <summary className="course-hole-preview__summary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px', fontSize: '11px', fontWeight: 700, color: palette.slate700, cursor: 'pointer' }}>
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
            <tr style={{ background: palette.slate50, color: palette.slate600 }}>
              <th scope="col" style={{ padding: '4px 2px', borderBottom: `1px solid ${palette.slate200}` }}>홀</th>
              <th scope="col" style={{ padding: '4px 2px', borderBottom: `1px solid ${palette.slate200}` }}>Par</th>
              {tees.map((tee) => <th key={tee.tee_code} scope="col" aria-label={`${tee.display_name}${tee.tee_code === selectedTeeCode ? ', 선택한 티' : ''}`} className={tee.tee_code === selectedTeeCode ? 'course-hole-preview__selected-tee' : undefined} style={{ padding: '4px 2px', borderBottom: `1px solid ${palette.slate200}` }}>
                {!isSelectableTee(tee)
                  ? <span>{tee.display_name}</span>
                  : <><span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, marginRight: 4, border: `1px solid ${palette.slate400}`, borderRadius: '50%', background: tee.tee_color, verticalAlign: '-1px' }} />{tee.display_name}</>}
              </th>)}
            </tr>
          </thead>
          <tbody>
            {holes.map((hole) => {
              const par = holeParDisplay(hole)
              return <tr key={hole.id}>
                <th scope="row" style={{ padding: '6px', borderBottom: `1px solid ${palette.slate100}`, color: palette.slate700 }}>{hole.hole_number}</th>
                <td style={{ padding: '6px', borderBottom: `1px solid ${palette.slate100}`, fontWeight: 700 }}>{par}</td>
                {tees.map((tee) => {
                  const isSelectedTee = tee.tee_code === selectedTeeCode
                  const variants = isSelectedTee
                    ? resolveHoleTeeVariants(hole, selectedTeeCode, courseTees)
                    : hole.tees.filter((item) => item.tee_code === tee.tee_code)
                  const usingFallbackTee = isSelectedTee && variants[0]?.tee_code !== selectedTeeCode
                  return <td key={tee.tee_code} className={tee.tee_code === selectedTeeCode ? 'course-hole-preview__selected-tee' : undefined} style={{ padding: '5px 2px', borderBottom: `1px solid ${palette.slate100}`, color: variants.length ? palette.slate900 : palette.slate400, fontWeight: tee.tee_code === selectedTeeCode ? 700 : 400 }}>
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

export function holeParDisplay(hole: GolfCourseHole): string {
  const overrides = [...new Set(hole.tees.map((tee) => tee.par).filter((par): par is number => par != null))].sort()
  return overrides.length > 0 ? overrides.join('/') : String(hole.par)
}

export function formatTeeDistance(tee: GolfCourseTee): string {
  const originalYards = tee.source_unit === 'yd' && tee.source_distance != null ? ` · ${tee.source_distance}yd` : ''
  const sourceLabel = tee.distance_m_source === 'official'
    ? tee.tee_selection_available === false ? ' (기준 M)' : ''
    : tee.source_unit === 'yd' ? ' (환산 M)' : ''
  return `${tee.distance_m}m${originalYards}${sourceLabel}`
}
