import type { BallLie, HoleRecord, ShotRecord } from '@/types/golf'
import { isFairwayHit } from '@/utils/golf/scoring'

export interface RoundSummaryInput {
  completedHoles: HoleRecord[]
  currentHole: number
  currentPar: number
  currentShots: ShotRecord[]
  isRoundComplete: boolean
  /** 아직 샷이 없을 때 사용자가 직접 고른 볼 위치를 페어웨이 안착 판단에 쓴다. */
  lieSelectedByUser: boolean
  selectedLie: BallLie
}

/** 상단 지표: 타수 차, 페어웨이 안착률, 그린 적중률. 진행 중인 홀의 페어웨이 결과도 포함한다. */
export function buildRoundSummary({ completedHoles, currentHole, currentPar, currentShots, isRoundComplete, lieSelectedByUser, selectedLie }: RoundSummaryInput) {
  const par = completedHoles.reduce((a, h) => a + h.par, 0)
  const score = completedHoles.reduce((a, h) => a + h.score, 0)
  const currentFairwayHit = isRoundComplete || completedHoles.some((h) => h.holeNumber === currentHole)
    ? null
    : currentShots.length > 0
      ? isFairwayHit(currentShots, currentPar)
      : lieSelectedByUser && currentPar > 3 ? selectedLie === '페어웨이' : null
  const fwEligible = completedHoles.filter((h) => h.fairwayHit !== null).length + (currentFairwayHit !== null ? 1 : 0)
  const fwHit = completedHoles.filter((h) => h.fairwayHit === true).length + (currentFairwayHit === true ? 1 : 0)
  const girCount = completedHoles.filter((h) => h.gir).length
  return {
    totalDiff: score - par,
    fwEligible,
    fwHit,
    girCount,
    fwPercent: fwEligible > 0 ? Math.round((fwHit / fwEligible) * 100) : 0,
    girPercent: completedHoles.length > 0 ? Math.round((girCount / completedHoles.length) * 100) : 0,
  }
}
