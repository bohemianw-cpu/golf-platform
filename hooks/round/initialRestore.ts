import { getSignedInUser, type createClient } from '@/utils/supabase/client'
import type { ChooseFn } from '@/components/score/ConfirmDialog'
import { readDraft, type Draft } from './draft'
import type { RoundRow } from './restoreRound'

// 같은 페이지 세션에서 "이어하기" 확인은 사용자당 한 번만 묻는다.
// (탭 이동 등으로 컴포넌트가 다시 마운트되어도 상태가 유지됨)
let promptedUserId: string | null = null

interface Options {
  supabase: ReturnType<typeof createClient>
  isSample: boolean
  sampleSessionId: string | null
  choose: ChooseFn
  /** 로그인한 사용자 id를 기록할 곳. */
  userIdRef: { current: string | null }
  applyDraft: (draft: Draft) => void
  resumeFromDb: (round: RoundRow) => Promise<void>
  clearDraft: () => void
  setSaveError: (message: string | null) => void
  setReady: (ready: boolean) => void
}

/**
 * 스코어 탭을 처음 열 때 이어서 할 라운드를 찾는다.
 * 샘플은 이 기기 기록이나 서버의 샘플 기록을, 실제 라운드는 이 기기 임시 기록과 서버의 진행 중 라운드를 차례로 확인한다.
 */
export async function runInitialRestore({ supabase, isSample, sampleSessionId, choose, userIdRef, applyDraft, resumeFromDb, clearDraft, setSaveError, setReady }: Options) {
  try {
    // 연결이 없어 토큰을 새로 받지 못해도 이 기기에서 마지막으로 로그인한 사용자의 임시 기록으로 이어 갈 수 있다.
    const { user } = await getSignedInUser(supabase)
    if (!user) return
    const userId = user.id
    userIdRef.current = userId
    const draft = readDraft(userId, isSample, sampleSessionId)
    if (isSample) {
      if (draft) applyDraft(draft)
      else if (sampleSessionId) {
        const { data: sample, error } = await supabase.from('sample_round_sessions').select('payload')
          .eq('id', sampleSessionId).eq('user_id', userId).maybeSingle()
        const payload = sample?.payload as Draft | null
        if (!error && payload && payload.userId === userId && Array.isArray(payload.holePars) && Array.isArray(payload.completedHoles)) applyDraft(payload)
      }
      setReady(true)
      return
    }

    // 이미 이 페이지 세션에서 확인을 마친 경우(탭 이동 등으로 재마운트):
    // 다시 묻지 않고, 로컬 백업이 있으면 조용히 복구한다.
    if (promptedUserId === userId && draft) {
      applyDraft(draft)
      return
    }
    const alreadyPrompted = promptedUserId === userId
    promptedUserId = userId

    // 1) 로컬 백업 (아직 서버에 못 올린 샷까지 포함)
    if (draft && !alreadyPrompted) {
      const answer = await choose(
        `이 기기에 저장된 임시 기록이 있습니다.\n${draft.golfClubName || '골프장 미지정'} · ${draft.completedHoles.length}홀 완료`,
        [
          { label: '이어서 하기', value: 'resume', tone: 'primary' },
          { label: '버리기', value: 'discard', tone: 'danger' },
        ]
      )
      if (answer === 'resume') {
        applyDraft(draft)
        return
      }
      clearDraft()
    }

    // 2) 서버의 진행 중 라운드
    const { data: rounds, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) throw error

    const round = rounds?.[0] as RoundRow | undefined
    if (!round) return

    const answer = await choose(
      `진행 중이던 라운드(${round.club_name || round.golf_club || '골프장'})가 있습니다.`,
      [
        { label: '이어서 하기', value: 'resume', tone: 'primary' },
        { label: '삭제하고 새로 시작', value: 'delete', tone: 'danger' },
        { label: '나중에 (그대로 두기)', value: 'later', tone: 'neutral' },
      ]
    )
    if (answer === 'resume') await resumeFromDb(round)
    else if (answer === 'delete') {
      const { error: delError } = await supabase.from('rounds').delete().eq('id', round.id).select('id').single()
      if (delError) throw delError
    }
  } catch (err) {
    console.error('진행 중 라운드 확인 실패:', err)
    setSaveError('이전 라운드를 불러오지 못했습니다.')
  } finally {
    setReady(true)
  }
}
