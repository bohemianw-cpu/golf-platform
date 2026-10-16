'use client'

import { useEffect, useMemo, useState } from 'react'
import type { createClient } from '@/utils/supabase/client'
import type { AchievementHoleRow, AchievementShotRow, RoundSummary } from './myTypes'
import { buildTrophies } from './myRecords'

/** 트로피 판정에 쓰는 홀·샷 기록을 불러와 트로피 목록을 만든다. 라운드 20개씩, 행 1000개씩 나눠 불러온다. */
export function useAchievements(supabase: ReturnType<typeof createClient>, achievementRounds: RoundSummary[]) {
  const [achievementHoles, setAchievementHoles] = useState<AchievementHoleRow[]>([])
  const [achievementShots, setAchievementShots] = useState<AchievementShotRow[]>([])
  const [achievementsLoading, setAchievementsLoading] = useState(false)
  const [achievementsError, setAchievementsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setAchievementsLoading(true)
      setAchievementsError(null)
      const holes: AchievementHoleRow[] = []
      const shots: AchievementShotRow[] = []
      try {
        for (let offset = 0; offset < achievementRounds.length; offset += 20) {
          const ids = achievementRounds.slice(offset, offset + 20).map((round) => round.id)
          for (let from = 0; ; from += 1000) {
            const { data, error: queryError } = await supabase.from('round_holes')
              .select('round_id,hole_number,par,score,putts,fairway_hit,gir').in('round_id', ids).order('round_id').order('hole_number').range(from, from + 999)
            if (queryError) throw queryError
            holes.push(...((data ?? []) as AchievementHoleRow[]))
            if ((data ?? []).length < 1000) break
          }
          for (let from = 0; ; from += 1000) {
            const { data, error: queryError } = await supabase.from('round_shots')
              .select('round_id,club,shot_distance,penalty').in('round_id', ids).order('round_id').order('hole_number').order('shot_number').range(from, from + 999)
            if (queryError) throw queryError
            shots.push(...((data ?? []) as AchievementShotRow[]))
            if ((data ?? []).length < 1000) break
          }
        }
        if (!cancelled) {
          setAchievementHoles(holes)
          setAchievementShots(shots)
        }
      } catch {
        if (!cancelled) setAchievementsError('일부 홀·샷 기록을 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setAchievementsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [achievementRounds, supabase])

  const trophies = useMemo(() => buildTrophies(achievementRounds, achievementHoles, achievementShots), [achievementRounds, achievementHoles, achievementShots])
  return { trophies, achievementsLoading, achievementsError }
}
