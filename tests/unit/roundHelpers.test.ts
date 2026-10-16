import { describe, expect, it } from 'vitest'
import type { ClubItem, HoleRecord, ShotRecord } from '@/types/golf'
import type { ClubStatsMap } from '@/utils/golf/scoring'
import { createClubAdvice, GREEN_APPROACH_REMAINING, isWithinGreenReach } from '@/hooks/round/clubAdvice'
import { buildRoundSummary } from '@/hooks/round/roundSummary'

const CLUBS: ClubItem[] = [
  { id: '1', name: '드라이버', category: 'driver' },
  { id: '2', name: '7번 아이언', category: 'iron' },
  { id: '3', name: '56도 웨지', category: 'wedge' },
  { id: '4', name: '내 퍼터', category: 'putter' },
]
const stat = (average: number, max = average) => ({ totalDist: average, count: 1, maxDist: max, minDist: average })
const STATS: ClubStatsMap = { 드라이버: stat(230), '7번 아이언': stat(140), '56도 웨지': stat(80, 95) }

describe('클럽 추천', () => {
  it('드라이버·퍼터와 어프로치 웨지를 category로 찾는다', () => {
    const advice = createClubAdvice([...CLUBS.slice(0, 2), { ...CLUBS[2], preferredApproach: true }, CLUBS[3]])
    expect(advice.teeClubName).toBe('드라이버')
    expect(advice.putterName).toBe('내 퍼터')
    expect(advice.preferredApproachWedgeName).toBe('56도 웨지')
    expect(advice.isPutter('내 퍼터')).toBe(true)
    expect(advice.isPutter('퍼터')).toBe(true)
    expect(advice.isDriver('드라이버')).toBe(true)
    expect(advice.isDriver('7번 아이언')).toBe(false)
  })

  it('드라이버가 없으면 퍼터가 아닌 첫 클럽으로 티샷한다', () => {
    expect(createClubAdvice(CLUBS.slice(1)).teeClubName).toBe('7번 아이언')
    expect(createClubAdvice([CLUBS[3]]).teeClubName).toBe('')
  })

  it('70m 이내는 어프로치 웨지를 먼저 추천한다', () => {
    const preferred = createClubAdvice([...CLUBS.slice(0, 2), { ...CLUBS[2], preferredApproach: true }, CLUBS[3]])
    expect(preferred.recommendForDistance(60, STATS)).toBe('56도 웨지')
    expect(createClubAdvice(CLUBS).recommendForDistance(140, STATS)).toBe('7번 아이언')
  })

  it('그린 도달 거리: 웨지는 최대 비거리, 다른 클럽은 평균 비거리', () => {
    const advice = createClubAdvice(CLUBS)
    expect(advice.greenReachDistance('56도 웨지', STATS)).toBe(95)
    expect(advice.greenReachDistance('7번 아이언', STATS)).toBe(140)
    expect(isWithinGreenReach(150, 140)).toBe(true)
    expect(isWithinGreenReach(151, 140)).toBe(false)
  })

  it('샷 후 남은 거리 기본값: 웨지는 최소 5m, 다른 클럽은 10m 단위', () => {
    const advice = createClubAdvice(CLUBS)
    expect(advice.suggestedRemainingForClub(100, '56도 웨지', STATS)).toBe(GREEN_APPROACH_REMAINING)
    expect(advice.suggestedRemainingForClub(3, '56도 웨지', STATS)).toBe(3)
    expect(advice.suggestedRemainingForClub(120, '56도 웨지', STATS)).toBe(25)
    expect(advice.suggestedRemainingForClub(360, '드라이버', STATS)).toBe(130)
    expect(advice.suggestedRemainingForClub(100, '7번 아이언', STATS)).toBe(0)
  })
})

const shot = (ballLie: ShotRecord['ballLie']): ShotRecord =>
  ({ shotNumber: 1, club: '드라이버', distanceToPinBefore: 360, distanceToPinAfter: 140, shotDistance: 220, ballLie, penalty: 0 })
const hole = (holeNumber: number, par: number, score: number, fairwayHit: boolean | null, gir: boolean): HoleRecord =>
  ({ holeNumber, greenCode: 'standard', greenName: '기본 그린', par, totalDistance: 360, shots: [], score, scoreDiff: score - par, putts: 2, fairwayHit, gir })

describe('라운드 요약', () => {
  const base = { currentHole: 3, currentPar: 4, currentShots: [], isRoundComplete: false, lieSelectedByUser: false, selectedLie: '페어웨이' as const }

  it('타수 차와 그린 적중률은 끝낸 홀만 센다', () => {
    const summary = buildRoundSummary({ ...base, completedHoles: [hole(1, 4, 5, true, false), hole(2, 3, 3, null, true)] })
    expect(summary).toEqual({ totalDiff: 1, fwEligible: 1, fwHit: 1, girCount: 1, fwPercent: 100, girPercent: 50 })
  })

  it('진행 중인 홀의 티샷 결과도 페어웨이 안착률에 넣는다', () => {
    const completedHoles = [hole(1, 4, 4, true, true)]
    expect(buildRoundSummary({ ...base, completedHoles, currentShots: [shot('러프')] }).fwPercent).toBe(50)
    expect(buildRoundSummary({ ...base, completedHoles, lieSelectedByUser: true }).fwHit).toBe(2)
    expect(buildRoundSummary({ ...base, completedHoles }).fwEligible).toBe(1)
    expect(buildRoundSummary({ ...base, completedHoles, currentPar: 3, lieSelectedByUser: true }).fwEligible).toBe(1)
  })

  it('끝난 라운드나 이미 기록한 홀은 진행 중 결과를 더하지 않는다', () => {
    const completedHoles = [hole(3, 4, 4, false, false)]
    expect(buildRoundSummary({ ...base, completedHoles, currentShots: [shot('페어웨이')] }).fwEligible).toBe(1)
    expect(buildRoundSummary({ ...base, completedHoles: [], isRoundComplete: true, currentShots: [shot('페어웨이')] }).fwEligible).toBe(0)
  })
})
