'use client'

import { useCallback, useRef, useState, type RefObject } from 'react'
import type { createClient } from '@/utils/supabase/client'
import { normalizeCourseName } from '@/utils/course-name'
import type { HoleRecord, ShotRecord } from '@/types/golf'

type SupabaseClient = ReturnType<typeof createClient>

/** 라운드 행에 저장하는 코스 정보. 저장 시점의 최신 값을 쓰도록 ref로 넘긴다. */
export interface RoundMeta {
  club: string
  course: string
  playMode: 'field' | 'screen' | null
  screenProvider: string | null
  entryMode: 'live' | 'backfill'
  holeCount: number
  courseId: string | null
  routeIds: string[]
  teeCode: string | null
  teeName: string | null
}

const sumBy = (holes: HoleRecord[], key: 'score' | 'putts') => holes.reduce((a, h) => a + h[key], 0)

interface RoundSyncOptions {
  supabase: SupabaseClient
  isSample: boolean
  metaRef: RefObject<RoundMeta>
  setSaveError: (message: string | null) => void
  /** 라운드 등록이 서버에 저장된 뒤 호출된다. */
  onRegistered: () => void
}

/**
 * 진행 중 라운드를 서버에 저장한다. 홀과 샷은 각각 순서대로 저장되도록 대기열에 넣고,
 * 샘플 입력은 서버의 실제 라운드에 쓰지 않는다.
 */
export function useRoundSync({ supabase, isSample, metaRef, setSaveError, onRegistered }: RoundSyncOptions) {
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const roundIdRef = useRef<string | null>(null)
  const roundPromiseRef = useRef<Promise<string> | null>(null)
  const savingCountRef = useRef(0)
  const idleWaitersRef = useRef<(() => void)[]>([])
  const shotSyncQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const holeSyncQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  // 아직 서버에 못 올린 것. 모두 저장되기 전에는 저장 실패 안내를 지우지 않는다.
  const holesUnsavedRef = useRef(false)
  const unsavedShotHolesRef = useRef(new Set<number>())
  const clearSaveErrorIfAllSaved = useCallback(() => {
    if (!holesUnsavedRef.current && unsavedShotHolesRef.current.size === 0) setSaveError(null)
  }, [setSaveError])

  const setRoundId = useCallback((id: string | null) => {
    roundIdRef.current = id
    setCurrentRoundId(id)
  }, [])

  /** 새 라운드를 시작할 때 이전 라운드 id와 생성 중인 요청을 잊는다. */
  const resetRound = useCallback(() => {
    setRoundId(null)
    roundPromiseRef.current = null
    holesUnsavedRef.current = false
    unsavedShotHolesRef.current.clear()
  }, [setRoundId])

  const track = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    savingCountRef.current += 1
    setIsSaving(true)
    try {
      return await fn()
    } finally {
      savingCountRef.current -= 1
      if (savingCountRef.current === 0) {
        setIsSaving(false)
        const waiters = idleWaitersRef.current
        idleWaitersRef.current = []
        waiters.forEach((resolve) => resolve())
      }
    }
  }, [])

  /** 진행 중인 서버 저장이 모두 끝날 때까지 기다린다. 실패한 저장도 끝난 것으로 본다. */
  const waitForSavesToSettle = useCallback(async () => {
    await shotSyncQueueRef.current.catch(() => undefined)
    await holeSyncQueueRef.current.catch(() => undefined)
    if (savingCountRef.current > 0) await new Promise<void>((resolve) => idleWaitersRef.current.push(resolve))
  }, [])

  /** 대기열에 들어간 샷·홀 저장이 끝날 때까지 기다린다. */
  const waitForQueuedSyncs = useCallback(async () => {
    await shotSyncQueueRef.current
    await holeSyncQueueRef.current
  }, [])

  const ensureRoundId = useCallback(
    async (userId: string): Promise<string> => {
      if (roundIdRef.current) return roundIdRef.current
      if (!roundPromiseRef.current) {
        roundPromiseRef.current = (async () => {
          const meta = metaRef.current
          const name = normalizeCourseName(meta.club.trim()) || '골프장 미지정'
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('skill_group')
            .eq('id', userId)
            .maybeSingle()
          if (profileError) throw profileError
          const { data, error } = await supabase
            .from('rounds')
            .insert({
              user_id: userId,
              club_name: name,
              golf_club: name,
              course_name: normalizeCourseName(meta.course),
              play_mode: meta.playMode,
              screen_provider: meta.playMode === 'screen' ? meta.screenProvider : null,
              entry_mode: meta.entryMode,
              holes_count: meta.holeCount,
              course_id: meta.courseId,
              route_ids: meta.routeIds,
              tee_code: meta.teeCode,
              tee_name: meta.teeName,
              skill_group_at_round: profile?.skill_group ?? 'beginner',
              status: 'in_progress',
            })
            .select('id')
            .single()
          if (error) throw error
          setRoundId(data.id)
          return data.id as string
        })().finally(() => {
          roundPromiseRef.current = null
        })
      }
      return roundPromiseRef.current
    },
    [supabase, metaRef, setRoundId]
  )

  /** 완료된 홀 전체를 순서대로 동기화하고, 취소된 마지막 홀을 서버에서도 제거한다. */
  const syncHoles = useCallback(
    (all: HoleRecord[]): Promise<boolean> => {
      if (isSample) return Promise.resolve(true)
      const pending = holeSyncQueueRef.current.then(async () => {
        try {
          await track(async () => {
            const {
              data: { session },
            } = await supabase.auth.getSession()
            if (!session?.user) throw new Error('로그인이 필요합니다.')
            if (!metaRef.current.playMode) throw new Error('필드 또는 스크린을 선택해 주세요.')
            const roundId = await ensureRoundId(session.user.id)

            if (all.length > 0) {
              const { error } = await supabase.from('round_holes').upsert(
                all.map((h) => ({
                  round_id: roundId,
                  hole_number: h.holeNumber,
                  par: h.par,
                  score: h.score,
                  putts: h.putts,
                  fairway_hit: h.fairwayHit,
                  gir: h.gir,
                  total_distance: h.totalDistance,
                  green_code: h.greenCode || 'standard',
                  green_name: h.greenName || '기본 그린',
                })),
                { onConflict: 'round_id,hole_number' }
              )
              if (error) throw error
            }

            const lastCompletedHole = all.reduce((max, hole) => Math.max(max, hole.holeNumber), 0)
            const { error: staleHoleError } = await supabase.from('round_holes')
              .delete().eq('round_id', roundId).gt('hole_number', lastCompletedHole)
            if (staleHoleError) throw staleHoleError

            const meta = metaRef.current
            const name = normalizeCourseName(meta.club.trim()) || '골프장 미지정'
            const { error: updateError } = await supabase
              .from('rounds')
              .update({
                club_name: name,
                golf_club: name,
                course_name: normalizeCourseName(meta.course),
                play_mode: meta.playMode,
                screen_provider: meta.playMode === 'screen' ? meta.screenProvider : null,
                course_id: meta.courseId,
                route_ids: meta.routeIds,
                tee_code: meta.teeCode,
                tee_name: meta.teeName,
                total_score: sumBy(all, 'score'),
                total_putts: sumBy(all, 'putts'),
                updated_at: new Date().toISOString(),
              })
              .eq('id', roundId)
            if (updateError) throw updateError
          })
          holesUnsavedRef.current = false
          clearSaveErrorIfAllSaved()
          return true
        } catch (err) {
          console.error('홀 저장 에러:', err)
          holesUnsavedRef.current = true
          setSaveError('서버 저장에 실패했습니다. 기록은 이 기기에 보관되어 있습니다.')
          return false
        }
      })
      holeSyncQueueRef.current = pending
      return pending
    },
    [supabase, track, ensureRoundId, isSample, metaRef, setSaveError, clearSaveErrorIfAllSaved]
  )

  /** 진행 중인 홀도 샷 단위로 서버에 저장해 기기 간 이어하기를 지원한다. */
  const syncShotEvents = useCallback(
    (holeNumber: number, shots: ShotRecord[]): Promise<boolean> => {
      if (isSample) return Promise.resolve(true)
      const pending = shotSyncQueueRef.current.then(async () => {
        try {
          await track(async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) throw new Error('로그인이 필요합니다.')
            if (!metaRef.current.playMode) throw new Error('필드 또는 스크린을 선택해 주세요.')
            const roundId = await ensureRoundId(session.user.id)
            if (shots.length > 0) {
              const { error } = await supabase.from('round_shots').upsert(
                shots.map((shot) => ({
                  round_id: roundId,
                  hole_number: holeNumber,
                  shot_number: shot.shotNumber,
                  club: shot.club,
                  distance_to_pin_before: shot.distanceToPinBefore,
                  distance_to_pin_after: shot.distanceToPinAfter,
                  shot_distance: shot.shotDistance,
                  ball_lie: shot.ballLie,
                  penalty: shot.penalty,
                  input_method: shot.inputMethod ?? 'manual',
                })),
                { onConflict: 'round_id,hole_number,shot_number' }
              )
              if (error) throw error
            }
            const { error } = await supabase
              .from('round_shots')
              .delete()
              .eq('round_id', roundId)
              .eq('hole_number', holeNumber)
              .gt('shot_number', shots.length)
            if (error) throw error
          })
          unsavedShotHolesRef.current.delete(holeNumber)
          clearSaveErrorIfAllSaved()
          return true
        } catch (err) {
          unsavedShotHolesRef.current.add(holeNumber)
          const reason = err && typeof err === 'object' && 'message' in err
            ? String(err.message)
            : String(err)
          console.warn('샷 동기화 실패:', reason)
          setSaveError('샷 서버 저장에 실패했습니다. 이 기기의 임시 기록은 유지됩니다.')
          return false
        }
      })
      shotSyncQueueRef.current = pending
      return pending
    },
    [supabase, track, ensureRoundId, isSample, metaRef, setSaveError, clearSaveErrorIfAllSaved]
  )

  /** 완료된 라운드를 등록한다. 등록 후에는 서버에서 기록을 고칠 수 없다. */
  const finalizeRound = useCallback(
    async (finalHoles: HoleRecord[]): Promise<boolean> => {
      if (isSample) return true
      try {
        await track(async () => {
          const id = roundIdRef.current
          if (!id) throw new Error('round id 없음')
          const { error } = await supabase
            .from('rounds')
            .update({
              status: 'completed',
              registered_at: new Date().toISOString(),
              total_score: sumBy(finalHoles, 'score'),
              total_putts: sumBy(finalHoles, 'putts'),
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select('id')
            .single()
          if (error) throw error
        })
        onRegistered()
        return true
      } catch (err) {
        console.error('라운드 완료 저장 에러:', err)
        setSaveError('라운드 완료 처리에 실패했습니다. 다시 시도해 주세요.')
        return false
      }
    },
    [supabase, track, isSample, onRegistered, setSaveError]
  )

  /** 서버의 현재 라운드를 지운다. 등록된 라운드는 서버 정책이 삭제를 막는다. */
  const deleteServerRound = useCallback(async (id: string) => {
    await track(async () => {
      const { error } = await supabase.from('rounds').delete().eq('id', id).select('id').single()
      if (error) throw error
    })
  }, [supabase, track])

  return {
    currentRoundId,
    isSaving,
    roundIdRef,
    setRoundId,
    resetRound,
    track,
    waitForQueuedSyncs,
    waitForSavesToSettle,
    syncHoles,
    syncShotEvents,
    finalizeRound,
    deleteServerRound,
  }
}
