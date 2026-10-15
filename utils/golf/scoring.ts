import type { ClubItem, BallLie, ShotRecord } from '@/types/golf'
import { fallbackClubDistance } from './clubs'

export const PENALTY_LIES: BallLie[] = ['해저드', '해저드티', 'OB', 'OB티']
export const MIN_GOLF_PAR = 3
export const MAX_GOLF_PAR = 7
export const MAX_GOLF_DISTANCE_M = 2000

export const getPenaltyByLie = (lie: BallLie): number => {
  switch (lie) {
    case '해저드':
    case '해저드티':
    case 'OB':
      return 1
    case 'OB티':
      return 2
    default:
      return 0
  }
}

export const isPenaltyLie = (lie: BallLie): boolean => PENALTY_LIES.includes(lie)

export const roundTo10 = (dist: number): number => Math.max(0, Math.round(dist / 10) * 10)
export const roundToTenth = (dist: number): number => Math.round(dist * 10) / 10

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min))

export const defaultDistanceForPar = (par: number): number => {
  if (par <= 3) return 150
  if (par === 4) return 360
  if (par === 5) return 480
  return 560
}

/** 샷 비거리. OB 원위치 재타는 비거리 0(통계 제외) */
export const calcShotDistance = (
  prevDistance: number,
  remaining: number,
  isPinOver: boolean
): number => roundToTenth(isPinOver ? prevDistance + remaining : Math.max(0, prevDistance - remaining))

// ---------- 클럽 통계 ----------
export interface ClubStat {
  totalDist: number
  count: number
  maxDist: number
  minDist: number
}
export type ClubStatsMap = Record<string, ClubStat>

/** 벌타 샷·퍼터·비거리 0 샷은 평균에서 제외 */
export function buildClubStats(
  shots: ShotRecord[],
  isPutter: (clubName: string) => boolean
): ClubStatsMap {
  const map: ClubStatsMap = {}
  for (const s of shots) {
    if (s.shotDistance <= 0 || s.penalty > 0 || isPenaltyLie(s.ballLie) || isPutter(s.club)) continue
    const cur = map[s.club]
    if (!cur) {
      map[s.club] = { totalDist: s.shotDistance, count: 1, maxDist: s.shotDistance, minDist: s.shotDistance }
    } else {
      cur.totalDist += s.shotDistance
      cur.count += 1
      cur.maxDist = Math.max(cur.maxDist, s.shotDistance)
      cur.minDist = Math.min(cur.minDist, s.shotDistance)
    }
  }
  return map
}

export function getExpectedDistance(
  clubName: string,
  clubs: ClubItem[],
  stats: ClubStatsMap
): number {
  const st = stats[clubName]
  if (st && st.count > 0) return Math.round(st.totalDist / st.count)
  return fallbackClubDistance(clubs.find((c) => c.name === clubName), clubName)
}

/** 남은 거리를 넘기지 않는 가장 긴 클럽 → 없으면 가장 짧은 클럽 */
export function recommendClub(
  targetDist: number,
  clubs: ClubItem[],
  stats: ClubStatsMap,
  exclude?: (club: ClubItem) => boolean
): string | null {
  const base = clubs.filter((c) => c.category !== 'putter')
  const filtered = exclude ? base.filter((c) => !exclude(c)) : base
  const usable = filtered.length > 0 ? filtered : base
  if (usable.length === 0) return null

  let best: string | null = null
  let minRemaining = Infinity
  for (const c of usable) {
    const diff = targetDist - getExpectedDistance(c.name, clubs, stats)
    if (diff >= 0 && diff < minRemaining) {
      minRemaining = diff
      best = c.name
    }
  }
  if (best) return best

  let shortest = usable[0]
  let shortestDist = getExpectedDistance(shortest.name, clubs, stats)
  for (const c of usable) {
    const d = getExpectedDistance(c.name, clubs, stats)
    if (d < shortestDist) {
      shortest = c
      shortestDist = d
    }
  }
  return shortest.name
}

// ---------- 홀 결과 ----------
/** 퍼터로 친 샷만 퍼트로 계산 */
export const countPutts = (shots: ShotRecord[], isPutter: (clubName: string) => boolean): number =>
  shots.filter((s) => isPutter(s.club)).length

export const calcHoleScore = (shots: ShotRecord[]): number =>
  shots.reduce((acc, s) => acc + 1 + s.penalty, 0)

/** 페널티 타수까지 포함한 누적 타수가 (파-2) 이내에서 그린에 올랐는지 */
export function isGreenInRegulation(shots: ShotRecord[], par: number): boolean {
  let strokes = 0
  for (const s of shots) {
    strokes += 1
    if ((s.ballLie === '그린' || s.ballLie === '홀아웃') && strokes <= par - 2) return true
    strokes += s.penalty
  }
  return false
}

export const isFairwayHit = (shots: ShotRecord[], par: number): boolean | null =>
  par > 3 && shots.length > 0 ? shots[0].ballLie === '페어웨이' : null

// ---------- 접근율 ----------
export interface ApproachStat {
  totalRate: number
  count: number
}
export type ClubApproachMap = Record<string, ApproachStat>

/**
 * 클럽별 핀 접근율: 샷 전 대비 샷 후 남은 거리가 줄어든 비율(%)
 * 대상: 남은 거리 <= (평균 비거리 + 20m) 인 샷, 퍼터는 그린 위/30m 이내
 * 벌타 샷은 제외
 */
export function buildClubApproach(
  shots: ShotRecord[],
  expected: (clubName: string) => number,
  isPutter: (clubName: string) => boolean
): ClubApproachMap {
  const map: ClubApproachMap = {}
  for (const s of shots) {
    if (s.shotDistance <= 0 || s.penalty > 0 || isPenaltyLie(s.ballLie) || s.distanceToPinBefore <= 0) continue
    const isTarget = isPutter(s.club)
      ? s.ballLie === '그린' || s.ballLie === '홀아웃' || s.distanceToPinBefore <= 30
      : s.distanceToPinBefore <= expected(s.club) + 20
    if (!isTarget) continue
    const rate = Math.max(0, (1 - s.distanceToPinAfter / s.distanceToPinBefore) * 100)
    const cur = map[s.club] ?? (map[s.club] = { totalRate: 0, count: 0 })
    cur.totalRate += rate
    cur.count += 1
  }
  return map
}
