import { describe, expect, it } from 'vitest'
import type { BallLie, ClubItem, ShotRecord } from '@/types/golf'
import {
  buildClubApproach,
  buildClubStats,
  calcHoleScore,
  calcShotDistance,
  clamp,
  countPutts,
  getExpectedDistance,
  getPenaltyByLie,
  isFairwayHit,
  isGreenInRegulation,
  recommendClub,
  roundTo10,
} from '@/utils/golf/scoring'

const shot = (club: string, before: number, after: number, ballLie: BallLie, penalty = 0, shotDistance = Math.max(0, before - after)): ShotRecord =>
  ({ shotNumber: 1, club, distanceToPinBefore: before, distanceToPinAfter: after, shotDistance, ballLie, penalty })
const CLUBS: ClubItem[] = [
  { id: '1', name: '드라이버', category: 'driver' },
  { id: '2', name: '7번 아이언', category: 'iron' },
  { id: '3', name: '56도 웨지', category: 'wedge' },
  { id: '4', name: '퍼터', category: 'putter' },
]
const isPutter = (name: string) => name === '퍼터'

describe('타수와 벌타', () => {
  it('OB는 1벌타, OB티는 2벌타, 일반 위치는 벌타가 없다', () => {
    expect(getPenaltyByLie('OB')).toBe(1)
    expect(getPenaltyByLie('해저드')).toBe(1)
    expect(getPenaltyByLie('OB티')).toBe(2)
    expect(getPenaltyByLie('러프')).toBe(0)
  })

  it('홀 타수는 샷 수에 벌타를 더한다', () => {
    expect(calcHoleScore([shot('드라이버', 360, 360, 'OB', 1), shot('드라이버', 360, 140, '페어웨이'), shot('퍼터', 3, 0, '홀아웃')])).toBe(4)
  })

  it('퍼트는 퍼터로 친 샷만 센다', () => {
    expect(countPutts([shot('56도 웨지', 30, 3, '그린'), shot('퍼터', 3, 1, '그린'), shot('퍼터', 1, 0, '홀아웃')], isPutter)).toBe(2)
  })
})

describe('그린 적중(GIR)과 페어웨이 적중', () => {
  it('파 4에서 두 번째 샷으로 그린에 오르면 GIR이다', () => {
    expect(isGreenInRegulation([shot('드라이버', 360, 140, '페어웨이'), shot('7번 아이언', 140, 5, '그린'), shot('퍼터', 5, 0, '홀아웃')], 4)).toBe(true)
  })

  it('벌타가 있으면 그만큼 늦게 오른 것으로 본다', () => {
    expect(isGreenInRegulation([shot('드라이버', 360, 360, 'OB', 1), shot('7번 아이언', 360, 5, '그린')], 4)).toBe(false)
  })

  it('파 3은 페어웨이 적중을 따지지 않는다', () => {
    expect(isFairwayHit([shot('7번 아이언', 140, 5, '그린')], 3)).toBeNull()
    expect(isFairwayHit([shot('드라이버', 360, 140, '페어웨이')], 4)).toBe(true)
    expect(isFairwayHit([shot('드라이버', 360, 150, '러프')], 4)).toBe(false)
  })
})

describe('클럽 통계와 추천', () => {
  it('벌타 샷과 퍼터는 평균 비거리에서 빠진다', () => {
    const stats = buildClubStats([
      shot('드라이버', 360, 140, '페어웨이'),
      shot('드라이버', 360, 160, '러프'),
      shot('드라이버', 360, 360, 'OB', 1, 230),
      shot('퍼터', 5, 0, '홀아웃'),
    ], isPutter)
    expect(stats['드라이버']).toEqual({ totalDist: 420, count: 2, maxDist: 220, minDist: 200 })
    expect(stats['퍼터']).toBeUndefined()
    expect(getExpectedDistance('드라이버', CLUBS, stats)).toBe(210)
  })

  it('기록이 없으면 클럽 종류별 기본 비거리를 쓴다', () => {
    expect(getExpectedDistance('7번 아이언', CLUBS, {})).toBe(140)
  })

  it('남은 거리를 넘기지 않는 가장 긴 클럽을 추천하고, 퍼터는 추천하지 않는다', () => {
    expect(recommendClub(150, CLUBS, {})).toBe('7번 아이언')
    expect(recommendClub(250, CLUBS, {})).toBe('드라이버')
    expect(recommendClub(20, CLUBS, {})).toBe('56도 웨지')
  })

  it('제외 조건이 있으면 그 클럽을 빼고 추천한다', () => {
    expect(recommendClub(250, CLUBS, {}, (club) => club.category === 'driver')).toBe('7번 아이언')
  })

  it('핀 접근율은 샷 전 거리 대비 줄어든 비율이다', () => {
    const approach = buildClubApproach([shot('56도 웨지', 60, 6, '그린')], () => 70, isPutter)
    expect(approach['56도 웨지'].count).toBe(1)
    expect(approach['56도 웨지'].totalRate).toBeCloseTo(90)
  })
})

describe('거리 계산', () => {
  it('핀을 넘기면 남은 거리를 더해 비거리를 계산한다', () => {
    expect(calcShotDistance(150, 10, false)).toBe(140)
    expect(calcShotDistance(150, 10, true)).toBe(160)
    expect(calcShotDistance(5, 8, false)).toBe(0)
  })

  it('반올림과 범위 제한', () => {
    expect(roundTo10(144)).toBe(140)
    expect(roundTo10(-20)).toBe(0)
    expect(clamp(Number.NaN, 0, 2000)).toBe(0)
    expect(clamp(2500, 0, 2000)).toBe(2000)
  })
})
