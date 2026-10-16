'use client'

import { useEffect, useMemo, useState } from 'react'
import type { createClient } from '@/utils/supabase/client'
import type { RoundSummary, TrophyStats } from './myTypes'
import { buildTrophies, EMPTY_TROPHY_STATS } from './myRecords'

/** 인정 라운드의 트로피 판정용 집계를 서버에서 받아 트로피 목록을 만든다. 홀·샷 기록은 내려받지 않는다. */
export function useAchievements(supabase: ReturnType<typeof createClient>, achievementRounds: RoundSummary[]) {
  const [stats, setStats] = useState<TrophyStats>(EMPTY_TROPHY_STATS)
  const [achievementsLoading, setAchievementsLoading] = useState(false)
  const [achievementsError, setAchievementsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setAchievementsLoading(true)
      setAchievementsError(null)
      try {
        let next = EMPTY_TROPHY_STATS
        if (achievementRounds.length > 0) {
          const { data, error: queryError } = await supabase.rpc('get_my_trophy_stats', { p_round_ids: achievementRounds.map((round) => round.id) })
          if (queryError) throw queryError
          const row = Array.isArray(data) ? data[0] : data
          if (row) next = row as TrophyStats
        }
        if (!cancelled) setStats(next)
      } catch {
        if (!cancelled) setAchievementsError('일부 홀·샷 기록을 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setAchievementsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [achievementRounds, supabase])

  const trophies = useMemo(() => buildTrophies(achievementRounds.length, stats), [achievementRounds.length, stats])
  return { trophies, achievementsLoading, achievementsError }
}
