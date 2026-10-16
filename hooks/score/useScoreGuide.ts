'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSignedInUser, type createClient } from '@/utils/supabase/client'

const SCORE_GUIDE_SEEN_KEY = 'golf-score-guide-seen:'

export interface ScoreGuideState {
  enabled: boolean
  startAutomatically: boolean
  markSeen: () => void
}

/** 스코어 탭 안내 투어를 켤지, 처음 한 번 자동으로 보여 줄지 계정·기기 설정에서 읽고 본 시점을 저장한다. */
export function useScoreGuide(supabase: ReturnType<typeof createClient>): ScoreGuideState {
  const [enabled, setEnabled] = useState(true)
  const [completedAt, setCompletedAt] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { user } = await getSignedInUser(supabase)
      if (!user) {
        if (!cancelled) { setEnabled(false); setLoaded(true) }
        return
      }
      let seenOnThisDevice: string | null = null
      try { seenOnThisDevice = window.localStorage.getItem(`${SCORE_GUIDE_SEEN_KEY}${user.id}`) } catch { /* Storage may be unavailable. */ }
      const { data } = await supabase.from('user_data_preferences')
        .select('score_guide_enabled,score_guide_completed_at')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      setUserId(user.id)
      setEnabled(data?.score_guide_enabled ?? true)
      setCompletedAt(data?.score_guide_completed_at ?? seenOnThisDevice)
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [supabase])

  const markSeen = useCallback(() => {
    if (completedAt) return
    const seenAt = new Date().toISOString()
    setCompletedAt(seenAt)
    if (userId) {
      try { window.localStorage.setItem(`${SCORE_GUIDE_SEEN_KEY}${userId}`, seenAt) } catch { /* The account preference still persists. */ }
    }
    void supabase.rpc('set_my_score_guide_preference', { p_enabled: enabled, p_completed: true })
  }, [completedAt, enabled, userId, supabase])

  return { enabled, startAutomatically: loaded && enabled && !completedAt, markSeen }
}
