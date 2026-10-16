'use client'

import { useEffect, useState } from 'react'
import type { createClient } from '@/utils/supabase/client'
import type { SampleRoundSession } from './myTypes'

/** 샘플 라운드 목록을 불러오고 새 샘플 라운드를 시작한다. */
export function useSampleSessions(supabase: ReturnType<typeof createClient>, userId: string | null, setError: (message: string | null) => void, onStartSample?: (id: string) => void) {
  const [sampleSessions, setSampleSessions] = useState<SampleRoundSession[]>([])
  const [selectedSample, setSelectedSample] = useState<SampleRoundSession | null>(null)
  const [startingSample, setStartingSample] = useState(false)

  useEffect(() => {
    if (!userId) return
    void supabase.from('sample_round_sessions').select('id,created_at,updated_at,payload')
      .eq('user_id', userId).order('updated_at', { ascending: false }).limit(50)
      .then(({ data, error: queryError }) => {
        if (queryError) setError('샘플 기록을 불러오지 못했습니다.')
        else setSampleSessions((data ?? []) as SampleRoundSession[])
      })
  }, [userId, supabase, setError])

  const startSample = async () => {
    if (!userId || startingSample) return
    setStartingSample(true)
    setError(null)
    const { data, error: insertError } = await supabase.from('sample_round_sessions')
      .insert({ user_id: userId, payload: {} }).select('id,created_at,updated_at,payload').single()
    if (insertError || !data) setError('샘플 기록을 시작하지 못했습니다. 다시 시도해 주세요.')
    else onStartSample?.(data.id)
    setStartingSample(false)
  }

  return { sampleSessions, selectedSample, setSelectedSample, startingSample, startSample }
}
