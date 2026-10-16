import { describe, expect, it } from 'vitest'
import type { ShotRecord } from '@/types/golf'
import { buildHoleRecord, buildQuickPutts, buildShot, type ShotInput } from '@/hooks/round/shotRecords'

const shot = (extra: Partial<ShotRecord>): ShotRecord => ({
  shotNumber: 1, inputMethod: 'manual', club: '드라이버', distanceToPinBefore: 360, distanceToPinAfter: 140, shotDistance: 220, ballLie: '페어웨이', penalty: 0, ...extra,
})
const input = (extra: Partial<ShotInput> = {}): ShotInput => ({
  currentShots: [], distanceBefore: 360, remainingDistance: 140, selectedClub: '드라이버', selectedLie: '페어웨이', isPinOver: false, putterName: '퍼터', ...extra,
})

describe('샷 한 개 만들기', () => {
  it('보통 샷은 남은 거리와 비거리를 그대로 기록한다', () => {
    const { shot: result, isHoleOut } = buildShot(input())
    expect(isHoleOut).toBe(false)
    expect(result).toEqual({ shotNumber: 1, inputMethod: 'manual', club: '드라이버', distanceToPinBefore: 360, distanceToPinAfter: 140, shotDistance: 220, ballLie: '페어웨이', penalty: 0 })
  })

  it('샷 번호는 이 홀에 기록한 샷 다음 번호다', () => {
    expect(buildShot(input({ currentShots: [shot({}), shot({ shotNumber: 2 })] })).shot.shotNumber).toBe(3)
  })

  it('남은 거리 0은 홀아웃으로 기록한다', () => {
    const { shot: result, isHoleOut } = buildShot(input({ distanceBefore: 120, remainingDistance: 0, selectedClub: 'PW' }))
    expect(isHoleOut).toBe(true)
    expect(result).toMatchObject({ ballLie: '홀아웃', distanceToPinAfter: 0, shotDistance: 120, club: 'PW', penalty: 0 })
  })

  it('그린 위에서 홀아웃하면 고른 클럽과 상관없이 퍼터로 기록한다', () => {
    const onGreen = [shot({ ballLie: '그린', distanceToPinAfter: 3 })]
    expect(buildShot(input({ currentShots: onGreen, distanceBefore: 3, remainingDistance: 0, selectedClub: 'PW' })).shot.club).toBe('퍼터')
    // 퍼터가 없는 골프백이면 고른 클럽 그대로
    expect(buildShot(input({ currentShots: onGreen, distanceBefore: 3, remainingDistance: 0, selectedClub: 'PW', putterName: null })).shot.club).toBe('PW')
  })

  it('OB는 원위치 재타라 거리를 유지하고 비거리 0, 1벌타로 기록한다', () => {
    const { shot: result, isHoleOut } = buildShot(input({ selectedLie: 'OB', remainingDistance: 0 }))
    expect(isHoleOut).toBe(false)
    expect(result).toMatchObject({ ballLie: 'OB', distanceToPinBefore: 360, distanceToPinAfter: 360, shotDistance: 0, penalty: 1 })
  })

  it('핀을 넘기면 비거리에 남은 거리를 더한다. 홀아웃이면 넘김을 무시한다', () => {
    expect(buildShot(input({ distanceBefore: 100, remainingDistance: 5, isPinOver: true })).shot.shotDistance).toBe(105)
    expect(buildShot(input({ distanceBefore: 100, remainingDistance: 0, isPinOver: true })).shot.shotDistance).toBe(100)
  })

  it('해저드와 OB 특설티는 벌타를 붙인다', () => {
    expect(buildShot(input({ selectedLie: '해저드' })).shot.penalty).toBe(1)
    expect(buildShot(input({ selectedLie: 'OB티' })).shot.penalty).toBe(2)
  })
})

describe('퍼트 한 번에 입력', () => {
  it('마지막 퍼트가 홀아웃이고 중간 거리는 처음 거리를 똑같이 나눈다', () => {
    const putts = buildQuickPutts([shot({ ballLie: '그린', distanceToPinAfter: 9 })], 9, 3, '퍼터')
    expect(putts.map((p) => [p.shotNumber, p.distanceToPinBefore, p.distanceToPinAfter, p.shotDistance, p.ballLie])).toEqual([
      [2, 9, 6, 3, '그린'],
      [3, 6, 3, 3, '그린'],
      [4, 3, 0, 3, '홀아웃'],
    ])
    expect(putts.every((p) => p.club === '퍼터' && p.inputMethod === 'quick_putt' && p.penalty === 0)).toBe(true)
  })

  it('나누어떨어지지 않으면 0.1m 단위로 반올림한다', () => {
    const putts = buildQuickPutts([], 10, 3, '퍼터')
    expect(putts.map((p) => p.distanceToPinAfter)).toEqual([6.7, 3.3, 0])
    expect(putts.map((p) => p.shotDistance)).toEqual([3.3, 3.4, 3.3])
  })

  it('1퍼트는 바로 홀아웃이다', () => {
    expect(buildQuickPutts([], 2.5, 1, '퍼터')).toEqual([{ shotNumber: 1, inputMethod: 'quick_putt', club: '퍼터', distanceToPinBefore: 2.5, distanceToPinAfter: 0, shotDistance: 2.5, ballLie: '홀아웃', penalty: 0 }])
  })
})

describe('홀 기록 만들기', () => {
  const isPutter = (club: string) => club === '퍼터'
  const shots: ShotRecord[] = [
    shot({ shotNumber: 1, ballLie: '페어웨이' }),
    shot({ shotNumber: 2, club: '7번 아이언', distanceToPinBefore: 140, distanceToPinAfter: 8, shotDistance: 132, ballLie: '그린' }),
    shot({ shotNumber: 3, club: '퍼터', distanceToPinBefore: 8, distanceToPinAfter: 1, shotDistance: 7, ballLie: '그린' }),
    shot({ shotNumber: 4, club: '퍼터', distanceToPinBefore: 1, distanceToPinAfter: 0, shotDistance: 1, ballLie: '홀아웃' }),
  ]

  it('타수, 파 대비, 퍼트 수, 페어웨이·그린 적중을 계산한다', () => {
    expect(buildHoleRecord({ holeNumber: 3, par: 4, totalDistance: 360, greenCode: 'left', greenName: '왼쪽 그린', shots, isPutter })).toEqual({
      holeNumber: 3, greenCode: 'left', greenName: '왼쪽 그린', par: 4, totalDistance: 360, shots, score: 4, scoreDiff: 0, putts: 2, fairwayHit: true, gir: true,
    })
  })

  it('그린 정보가 없으면 기본 그린으로 기록하고 벌타를 타수에 더한다', () => {
    const withPenalty = [shot({ shotNumber: 1, ballLie: 'OB', penalty: 1, shotDistance: 0, distanceToPinAfter: 360 }), ...shots.map((s) => ({ ...s, shotNumber: s.shotNumber + 1 }))]
    const record = buildHoleRecord({ holeNumber: 1, par: 4, totalDistance: 360, shots: withPenalty, isPutter })
    expect(record).toMatchObject({ greenCode: 'standard', greenName: '기본 그린', score: 6, scoreDiff: 2 })
  })
})
