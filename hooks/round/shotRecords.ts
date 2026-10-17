import type { BallLie, HoleRecord, ShotRecord } from '@/types/golf'
import {
  calcHoleScore,
  calcShotDistance,
  clamp,
  countPutts,
  getPenaltyByLie,
  isFairwayHit,
  isGreenInRegulation,
  MAX_GOLF_DISTANCE_M,
  roundToTenth,
} from '@/utils/golf/scoring'

export interface ShotInput {
  /** 지금까지 이 홀에 기록한 샷 */
  currentShots: ShotRecord[]
  /** 이번 샷 전 핀까지 거리 */
  distanceBefore: number
  /** 입력한 샷 후 남은 거리 */
  remainingDistance: number
  selectedClub: string
  selectedLie: BallLie
  /** 핀을 넘겼는지 */
  isPinOver: boolean
  putterName: string | null
}

/**
 * 입력한 값으로 저장할 샷 한 개를 만든다.
 * - 남은 거리가 0이면 홀아웃이다. OB는 원위치 재타라서 예외다.
 * - 그린 위에서 홀아웃하면 퍼트 수가 맞도록 퍼터로 기록한다.
 * - OB는 거리를 그대로 두고 비거리는 0으로 기록해 통계에서 뺀다.
 */
export function buildShot({ currentShots, distanceBefore, remainingDistance, selectedClub, selectedLie, isPinOver, putterName }: ShotInput) {
  const prevShot = currentShots[currentShots.length - 1]
  const isHoleOut = remainingDistance === 0 && selectedLie !== 'OB'
  const ballLie: BallLie = isHoleOut ? '홀아웃' : selectedLie
  const club = isHoleOut && prevShot?.ballLie === '그린' && putterName ? putterName : selectedClub
  const isOb = ballLie === 'OB'
  const distanceAfter = isHoleOut ? 0 : isOb ? distanceBefore : remainingDistance
  const shot: ShotRecord = {
    shotNumber: currentShots.length + 1,
    inputMethod: 'manual',
    club,
    distanceToPinBefore: distanceBefore,
    distanceToPinAfter: distanceAfter,
    shotDistance: isOb ? 0 : clamp(calcShotDistance(distanceBefore, distanceAfter, isPinOver && !isHoleOut), 0, MAX_GOLF_DISTANCE_M),
    ballLie,
    penalty: getPenaltyByLie(ballLie),
  }
  return { shot, isHoleOut }
}

/**
 * 퍼트 count번을 한 번에 입력한다. 마지막 퍼트가 홀아웃이고,
 * 중간 퍼트의 남은 거리는 처음 거리를 count등분한 추정값이다.
 */
export function buildQuickPutts(currentShots: ShotRecord[], distanceBefore: number, count: number, putterName: string): ShotRecord[] {
  const putts: ShotRecord[] = []
  let before = distanceBefore
  for (let i = 1; i <= count; i++) {
    const last = i === count
    const after = last ? 0 : Math.max(0, roundToTenth((distanceBefore * (count - i)) / count))
    putts.push({
      shotNumber: currentShots.length + i,
      inputMethod: 'quick_putt',
      club: putterName,
      distanceToPinBefore: before,
      distanceToPinAfter: after,
      shotDistance: Math.max(0, roundToTenth(before - after)),
      ballLie: last ? '홀아웃' : '그린',
      penalty: 0,
    })
    before = after
  }
  return putts
}

export interface HoleInput {
  holeNumber: number
  par: number
  totalDistance: number
  greenCode?: string
  greenName?: string
  shots: ShotRecord[]
  isPutter: (club: string) => boolean
}

/** 끝난 홀의 기록(타수, 파 대비, 퍼트 수, 페어웨이·그린 적중)을 만든다. */
export function buildHoleRecord({ holeNumber, par, totalDistance, greenCode, greenName, shots, isPutter }: HoleInput): HoleRecord {
  const score = calcHoleScore(shots)
  return {
    holeNumber,
    greenCode: greenCode ?? 'standard',
    greenName: greenName ?? '기본 그린',
    par,
    totalDistance,
    shots,
    score,
    scoreDiff: score - par,
    putts: countPutts(shots, isPutter),
    fairwayHit: isFairwayHit(shots, par),
    gir: isGreenInRegulation(shots, par),
  }
}
