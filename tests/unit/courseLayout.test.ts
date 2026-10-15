import { describe, expect, it } from 'vitest'
import type { GolfCourseRoute, GolfCourseTee } from '@/types/golf'
import { buildCourseLayout, preferredGreen } from '@/hooks/round/courseLayout'
import { INITIAL_HOLE_PARS } from '@/utils/golf/clubs'

const tee = (teeCode: string, distance: number, greenCode = 'standard', extra: Partial<GolfCourseTee> = {}): GolfCourseTee => ({
  tee_code: teeCode,
  display_name: teeCode,
  tee_color: '#ffffff',
  distance_m: distance,
  green_code: greenCode,
  green_name: greenCode === 'standard' ? '기본 그린' : `${greenCode} 그린`,
  ...extra,
})

function route(id: string, holes: { par: number; tees: GolfCourseTee[] }[]): GolfCourseRoute {
  return {
    id,
    course_id: 'course',
    route_code: id,
    display_name: `${id} 코스`,
    hole_count: holes.length,
    pars: holes.map((hole) => hole.par),
    distances_m: [],
    holes: holes.map((hole, index) => ({ id: `${id}-${index + 1}`, route_id: id, hole_number: index + 1, play_order: index + 1, handicap_index: null, ...hole })),
  }
}

describe('그린 선택', () => {
  it('기본 그린, 왼쪽 그린, 이름순으로 고른다', () => {
    expect(preferredGreen([tee('white', 300, 'right'), tee('white', 310, 'standard')])?.green_code).toBe('standard')
    expect(preferredGreen([tee('white', 300, 'right'), tee('white', 310, 'left')])?.green_code).toBe('left')
    expect(preferredGreen([tee('white', 300, 'right'), tee('white', 310, 'b')])?.green_code).toBe('b')
    expect(preferredGreen([])).toBeUndefined()
  })
})

describe('코스 배치 계산', () => {
  const out = route('OUT', [
    { par: 4, tees: [tee('white', 350), tee('red', 300)] },
    { par: 3, tees: [tee('white', 150, 'left'), tee('white', 140, 'right'), tee('red', 120, 'left')] },
  ])

  it('고른 티의 거리와 기본 그린으로 홀마다 파와 거리를 정한다', () => {
    const layout = buildCourseLayout([out], 'white')
    expect(layout.valid).toBe(true)
    expect(layout.holePars).toEqual([4, 3])
    expect(layout.distances).toEqual([350, 150])
    expect(layout.greenCodes).toEqual(['standard', 'left'])
    expect(layout.routeHoles).toHaveLength(2)
  })

  it('그린마다 파가 다르면 고른 그린의 파를 쓴다', () => {
    const variant = route('IN', [{ par: 4, tees: [tee('white', 480, 'standard', { par: 5 })] }])
    expect(buildCourseLayout([variant], 'white').holePars).toEqual([5])
  })

  it('티를 고르지 않으면 선택할 수 없는 기준 티 거리를 쓴다', () => {
    const reference = route('REF', [{ par: 4, tees: [tee('official', 340, 'standard', { tee_selection_available: false })] }])
    const layout = buildCourseLayout([reference], null)
    expect(layout.valid).toBe(true)
    expect(layout.distances).toEqual([340])
  })

  it('홀 거리를 정할 수 없으면 거리 없이 파만 유지한다', () => {
    const noTees = route('NONE', [{ par: 4, tees: [] }, { par: 5, tees: [] }])
    const layout = buildCourseLayout([noTees], 'white')
    expect(layout.valid).toBe(false)
    expect(layout.hasValidPars).toBe(true)
    expect(layout.holePars).toEqual([4, 5])
    expect(layout.distances).toEqual([])
  })

  it('파 정보도 없으면 기본 18홀 파를 쓴다', () => {
    const empty: GolfCourseRoute = { id: 'X', course_id: 'course', route_code: 'X', display_name: 'X', hole_count: 9, pars: [], distances_m: [] }
    const layout = buildCourseLayout([empty], null)
    expect(layout.valid).toBe(false)
    expect(layout.holePars).toEqual(INITIAL_HOLE_PARS)
  })
})
