import type { ClubItem } from '@/types/golf'
import { fallbackClubDistance } from '@/utils/golf/clubs'
import { getExpectedDistance, recommendClub, roundTo10, roundToTenth, type ClubStatsMap } from '@/utils/golf/scoring'

// 그린 온 가능 거리(+10m) 안일 때 샷 후 남은 거리의 기본값 (m).
// 웨지는 최대 비거리, 다른 클럽은 평균 비거리를 기준으로 한다.
export const GREEN_APPROACH_REMAINING = 5
const GREEN_REACH_MARGIN_M = 10
export const isWithinGreenReach = (distance: number, averageDistance: number): boolean =>
  distance <= averageDistance + GREEN_REACH_MARGIN_M

/** 내 클럽 구성으로 클럽 추천과 남은 거리 기본값을 계산한다. 이름이 아닌 category 기준이다. */
export function createClubAdvice(clubs: ClubItem[]) {
  const teeClubName = (clubs.find((c) => c.category === 'driver') ?? clubs.find((c) => c.category !== 'putter'))?.name ?? ''
  const putterName = clubs.find((c) => c.category === 'putter')?.name ?? null
  const preferredApproachWedgeName = clubs.find((c) => c.category === 'wedge' && c.preferredApproach)?.name ?? null

  const recommendForDistance = (distance: number, stats: ClubStatsMap, exclude?: (club: ClubItem) => boolean) =>
    distance <= 70 && preferredApproachWedgeName
      ? preferredApproachWedgeName
      : recommendClub(distance, clubs, stats, exclude)
  const isPutter = (name: string) => name === '퍼터' || clubs.find((c) => c.name === name)?.category === 'putter'
  const isDriver = (name: string) => clubs.find((c) => c.name === name)?.category === 'driver'

  const greenReachDistance = (clubName: string, stats: ClubStatsMap) => {
    const club = clubs.find((item) => item.name === clubName)
    return club?.category === 'wedge'
      ? Math.max(stats[clubName]?.maxDist ?? 0, fallbackClubDistance(club, clubName))
      : getExpectedDistance(clubName, clubs, stats)
  }
  const suggestedRemainingForClub = (distance: number, clubName: string, stats: ClubStatsMap) => {
    const club = clubs.find((item) => item.name === clubName)
    if (club?.category === 'wedge') {
      const maxDistance = greenReachDistance(clubName, stats)
      return Math.min(distance, Math.max(GREEN_APPROACH_REMAINING, roundToTenth(distance - maxDistance)))
    }
    return roundTo10(distance - getExpectedDistance(clubName, clubs, stats))
  }

  return { teeClubName, putterName, preferredApproachWedgeName, recommendForDistance, isPutter, isDriver, greenReachDistance, suggestedRemainingForClub }
}

export type ClubAdvice = ReturnType<typeof createClubAdvice>
