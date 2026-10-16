'use client'

import { useEffect, useState } from 'react'
import type { createClient } from '@/utils/supabase/client'

export interface ScreenProvidersState {
  providers: string[]
  loading: boolean
  error: boolean
}

/** 스크린 라운드를 고르면 검증된 스크린 서비스 목록을 불러온다. */
export function useScreenProviders(supabase: ReturnType<typeof createClient>, playMode: 'field' | 'screen' | null): ScreenProvidersState {
  const [providers, setProviders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (playMode !== 'screen') return
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) setLoading(true) })
    void supabase.rpc('list_verified_screen_providers').then(({ data, error }) => {
      if (cancelled) return
      setProviders(error ? [] : (data ?? []).map((row: { provider: string }) => row.provider))
      setError(!!error)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [playMode, supabase])

  return { providers, loading, error }
}
