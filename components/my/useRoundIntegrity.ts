'use client'

import { useEffect, useState } from 'react'
import type { createClient } from '@/utils/supabase/client'
import type { RoundIntegritySummary, RoundSummary } from './myTypes'

/** 라운드마다 기록 시간이 그럴듯한지 판정한 결과를 100개씩 나눠 불러온다. */
export function useRoundIntegrity(supabase: ReturnType<typeof createClient>, userId: string | null, rounds: RoundSummary[]) {
  const [integrityByRound, setIntegrityByRound] = useState<Record<string, RoundIntegritySummary>>({})
  const [integrityLoading, setIntegrityLoading] = useState(false)
  const [integrityError, setIntegrityError] = useState(false)

  useEffect(() => {
    if (!userId || rounds.length === 0) return
    let cancelled = false
    void (async () => {
      setIntegrityLoading(true)
      setIntegrityError(false)
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
        if (!cancelled) { setIntegrityByRound({}); setIntegrityError(true) }
      } finally {
        if (!cancelled) setIntegrityLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [rounds, userId, supabase])

  return { integrityByRound, integrityLoading, integrityError }
}
