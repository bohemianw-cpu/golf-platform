'use client'

import { useEffect, useState } from 'react'
import type { createClient } from '@/utils/supabase/client'
import type { RoundIntegritySummary, RoundSummary } from './myTypes'

/** 목록에 보이는 라운드의 기록 시간 확인 결과를 100개씩 나눠 불러온다. 못 불러오면 '시간 확인 자료 없음'으로 보인다. */
export function useRoundIntegrity(supabase: ReturnType<typeof createClient>, userId: string | null, rounds: RoundSummary[]) {
  const [integrityByRound, setIntegrityByRound] = useState<Record<string, RoundIntegritySummary>>({})

  useEffect(() => {
    if (!userId || rounds.length === 0) return
    let cancelled = false
    void (async () => {
      try {
        const result: Record<string, RoundIntegritySummary> = {}
        for (let offset = 0; offset < rounds.length; offset += 100) {
          const ids = rounds.slice(offset, offset + 100).map((round) => round.id)
          const { data, error: queryError } = await supabase.from('round_integrity')
            .select('round_id,status,observed_seconds,minimum_seconds,reason_codes')
            .in('round_id', ids)
          if (queryError) throw queryError
          for (const row of (data ?? []) as RoundIntegritySummary[]) result[row.round_id] = row
        }
        if (!cancelled) setIntegrityByRound(result)
      } catch {
        if (!cancelled) setIntegrityByRound({})
      }
    })()
    return () => { cancelled = true }
  }, [rounds, userId, supabase])

  return { integrityByRound }
}
