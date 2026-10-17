'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { createClient } from '@/utils/supabase/client'
import { writeDraft, type Draft } from './draft'

/** 진행 중 라운드 상태 중 이 기기와 샘플 서버 기록에 보관하는 부분. */
export type DraftSnapshot = Omit<Draft, 'userId' | 'sampleSessionId' | 'roundId'>

interface Options {
  supabase: ReturnType<typeof createClient>
  ready: boolean
  isRegistered: boolean
  isSample: boolean
  sampleSessionId: string | null
  userIdRef: RefObject<string | null>
  roundIdRef: RefObject<string | null>
  /** 서버에 만든 라운드 id. 이 기기 보관본에만 넣는다. */
  roundId: string | null
  snapshot: DraftSnapshot
  setSaveError: (message: string | null) => void
}

/**
 * 진행 중 라운드를 이 기기에 보관하고, 샘플 라운드는 서버의 샘플 기록에도 저장한다.
 * 등록 전 마지막 홀까지 복구할 수 있도록 등록하기 전까지 보관한다.
 */
export function useDraftBackup({ supabase, ready, isRegistered, isSample, sampleSessionId, userIdRef, roundIdRef, roundId, snapshot, setSaveError }: Options) {
  const sampleSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    const uid = userIdRef.current
    if (!ready || !uid || isRegistered) return
    const hasData = snapshot.completedHoles.length > 0 || snapshot.currentShots.length > 0 || !!roundIdRef.current || !!snapshot.courseInfoLocked
    if (!hasData) {
      writeDraft(isSample, null)
      return
    }
    writeDraft(isSample, { userId: uid, sampleSessionId: isSample ? sampleSessionId : null, roundId, ...snapshot })
  }, [ready, isRegistered, roundId, snapshot, isSample, sampleSessionId, userIdRef, roundIdRef])

  // 샘플 기록을 서버의 샘플 기록에 저장한다. 가장 최근 내용이 실패하면 기억해 두었다가 연결이 돌아오면 다시 보낸다.
  // 예전 내용의 성공·실패는 더 새 내용이 곧 저장되므로 따지지 않는다.
  const latestSampleRef = useRef<Draft | null>(null)
  const unsavedSampleRef = useRef<Draft | null>(null)
  const saveSample = useCallback((payload: Draft) => {
    if (!sampleSessionId || !userIdRef.current) return
    const userId = userIdRef.current
    sampleSaveQueueRef.current = sampleSaveQueueRef.current.then(async () => {
      const { error } = await supabase.from('sample_round_sessions')
        .update({ payload, updated_at: new Date().toISOString() })
        .eq('id', sampleSessionId).eq('user_id', userId)
      if (payload !== latestSampleRef.current) return
      if (error) {
        unsavedSampleRef.current = payload
        setSaveError('샘플 기록을 서버에 저장하지 못했습니다. 연결되면 자동으로 다시 저장해요.')
      } else {
        unsavedSampleRef.current = null
        setSaveError(null)
      }
    })
  }, [sampleSessionId, supabase, userIdRef, setSaveError])

  useEffect(() => {
    if (!isSample || !sampleSessionId || !ready || !userIdRef.current) return
    const payload: Draft = { userId: userIdRef.current, sampleSessionId, roundId: null, ...snapshot }
    latestSampleRef.current = payload
    saveSample(payload)
  }, [isSample, sampleSessionId, ready, snapshot, userIdRef, saveSample])

  useEffect(() => {
    if (!isSample) return
    const retry = () => {
      const pending = unsavedSampleRef.current
      if (pending && navigator.onLine && document.visibilityState === 'visible') saveSample(pending)
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', retry)
    }
  }, [isSample, saveSample])
}
