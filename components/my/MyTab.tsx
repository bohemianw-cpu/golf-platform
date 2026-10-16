'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { GOLF_LEVEL_GROUPS, getGolfLevelGroup } from '@/utils/golf/levels'
import { AgreementDetails } from '@/components/auth/AgreementDetails'
import CommercePanel from '@/components/my/CommercePanel'
import { AI_ANALYSIS_CONSENT_VERSION, SHARING_CONSENT_VERSION } from '@/utils/consent'
import type { AchievementHoleRow, AchievementShotRow, CourseAggregate, FriendAggregate, FriendConnection, HoleRow, ProfileSummary, RoundDetail, RoundIntegritySummary, RoundSummary, SampleRoundSession, ShotRow, UserDataPreferences } from './myTypes'
import { buildTrophies, GOLF_LEVELS, toHoleRecords } from './myRecords'
import { CARD, muted } from './myStyles'
import { exportRoundHistory } from './exportRoundHistory'
import SampleRoundsSection from './SampleRoundsSection'
import SharingPreferencesSection from './SharingPreferencesSection'
import TrophySection from './TrophySection'
import FriendsSection from './FriendsSection'
import RoundHistorySection from './RoundHistorySection'
import RoundDetailSection from './RoundDetailSection'
import { color, palette } from '@/utils/theme'

export default function MyTab({ onStartSample }: { onStartSample?: (id: string) => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [dataPreferences, setDataPreferences] = useState<UserDataPreferences | null>(null)
  const [handicapInput, setHandicapInput] = useState('')
  const [savingHandicap, setSavingHandicap] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [rounds, setRounds] = useState<RoundSummary[]>([])
  const [sampleSessions, setSampleSessions] = useState<SampleRoundSession[]>([])
  const [selectedSample, setSelectedSample] = useState<SampleRoundSession | null>(null)
  const [startingSample, setStartingSample] = useState(false)
  const [integrityByRound, setIntegrityByRound] = useState<Record<string, RoundIntegritySummary>>({})
  const [integrityLoading, setIntegrityLoading] = useState(false)
  const [integrityError, setIntegrityError] = useState(false)
  const [achievementHoles, setAchievementHoles] = useState<AchievementHoleRow[]>([])
  const [achievementShots, setAchievementShots] = useState<AchievementShotRow[]>([])
  const [achievementsLoading, setAchievementsLoading] = useState(false)
  const [achievementsError, setAchievementsError] = useState<string | null>(null)
  const [detail, setDetail] = useState<RoundDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [aggregate, setAggregate] = useState<CourseAggregate | null>(null)
  const [courseAllAggregate, setCourseAllAggregate] = useState<CourseAggregate | null>(null)
  const [groupAggregate, setGroupAggregate] = useState<CourseAggregate | null>(null)
  const [friends, setFriends] = useState<FriendConnection[]>([])
  const [friendIdInput, setFriendIdInput] = useState('')
  const [friendAggregate, setFriendAggregate] = useState<Record<string, { overall: FriendAggregate | null; course: FriendAggregate | null }>>({})
  const [sharing, setSharing] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRounds = useCallback(async (uid: string) => {
    const pageSize = 500
    const all: RoundSummary[] = []
    for (let from = 0; ; from += pageSize) {
      const { data, error: queryError } = await supabase
        .from('rounds')
        .select('id,created_at,registered_at,status,total_score,total_putts,club_name,golf_club,course_name,course_id,play_mode,screen_provider,entry_mode,route_ids,tee_code,tee_name,visibility')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1)
      if (queryError) throw queryError
      const page = (data ?? []) as RoundSummary[]
      all.push(...page)
      if (page.length < pageSize) break
    }
    return all
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!session?.user) {
          if (!cancelled) {
            setUserId(null)
            setProfile(null)
            setRounds([])
          }
          return
        }
        const uid = session.user.id
        const [profileResult, loadedRounds] = await Promise.all([
          supabase.from('profiles').select('nickname,handicap_index,skill_group').eq('id', uid).maybeSingle(),
          loadRounds(uid),
        ])
        if (profileResult.error) throw profileResult.error
        const { data: preferences, error: preferencesError } = await supabase.from('user_data_preferences')
          .select('user_id,allow_anonymous_aggregate,allow_friend_sharing,allow_ai_practice_analysis,score_guide_enabled,score_guide_completed_at')
          .eq('user_id', uid).maybeSingle()
        if (preferencesError) throw preferencesError
        if (cancelled) return
        setUserId(uid)
        setProfile((profileResult.data as ProfileSummary | null) ?? {
          nickname: session.user.user_metadata?.nickname ?? '골퍼',
          handicap_index: null,
          skill_group: 'beginner',
        })
        setHandicapInput(profileResult.data?.handicap_index == null ? '' : String(profileResult.data.handicap_index))
        setRounds(loadedRounds)
        setDataPreferences((preferences as UserDataPreferences | null) ?? {
          user_id: uid,
          allow_anonymous_aggregate: false,
          allow_friend_sharing: false,
          allow_ai_practice_analysis: false,
          score_guide_enabled: true,
          score_guide_completed_at: null,
        })
        const { data: connections, error: connectionsError } = await supabase
          .from('friend_connections').select('id,requester_id,addressee_id,status')
          .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
        if (connectionsError) throw connectionsError
        setFriends((connections ?? []) as FriendConnection[])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '내 데이터를 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [supabase, loadRounds])

  const completedRounds = useMemo(() => rounds.filter((round) => round.status === 'completed' && round.total_score != null), [rounds])
  const achievementRounds = useMemo(() => completedRounds.filter((round) =>
    !!round.registered_at && integrityByRound[round.id]?.status === 'time_plausible',
  ), [completedRounds, integrityByRound])
  useEffect(() => {
    if (!userId) return
    void supabase.from('sample_round_sessions').select('id,created_at,updated_at,payload')
      .eq('user_id', userId).order('updated_at', { ascending: false }).limit(50)
      .then(({ data, error: queryError }) => {
        if (queryError) setError('샘플 기록을 불러오지 못했습니다.')
        else setSampleSessions((data ?? []) as SampleRoundSession[])
      })
  }, [userId, supabase])

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
  const earnedTrophies = trophies.filter((trophy) => trophy.earned)
  const currentLevelIndex = GOLF_LEVELS.reduce((index, level, i) => achievementRounds.length >= level.rounds ? i : index, -1)
  const currentLevel = currentLevelIndex + 1
  const nextLevel = GOLF_LEVELS[currentLevelIndex + 1]
  const previousLevelRounds = currentLevelIndex < 0 ? 0 : GOLF_LEVELS[currentLevelIndex].rounds
  const levelProgress = nextLevel ? Math.max(0, Math.min(100, ((achievementRounds.length - previousLevelRounds) / (nextLevel.rounds - previousLevelRounds)) * 100)) : 100
  const averageScore = completedRounds.length
    ? completedRounds.reduce((sum, round) => sum + (round.total_score ?? 0), 0) / completedRounds.length
    : null
  const bestScore = completedRounds.length ? Math.min(...completedRounds.map((round) => round.total_score ?? Infinity)) : null
  const currentGroup = profile?.handicap_index != null ? getGolfLevelGroup(profile.handicap_index) : profile?.skill_group ?? 'beginner'

  const suggestGroupReview = currentGroup === 'beginner' && completedRounds.length >= 5 && averageScore != null && averageScore <= 75

  const saveHandicap = async () => {
    if (!userId) return
    const parsed = handicapInput.trim() === '' ? null : Number(handicapInput)
    if (parsed != null && (!Number.isFinite(parsed) || parsed < -10 || parsed > 54)) {
      setError('핸디캡은 -10부터 54 사이의 숫자로 입력해 주세요.')
      return
    }
    setSavingHandicap(true)
    setProfileSaved(false)
    setError(null)
    const skillGroup = getGolfLevelGroup(parsed)
    const { data: savedRows, error: saveError } = await supabase.rpc('update_my_golf_level', { p_handicap_index: parsed })
    if (saveError || !savedRows || (Array.isArray(savedRows) && savedRows.length === 0)) setError('핸디캡 그룹을 저장하지 못했습니다.')
    else {
      setProfile((current) => current ? { ...current, handicap_index: parsed, skill_group: skillGroup } : current)
      setProfileSaved(true)
      setGroupAggregate(null)
      const { data: refreshedGroupRows } = await supabase.rpc('get_course_round_aggregate', {
        p_course_id: null,
        p_play_mode: null,
        p_skill_group: skillGroup,
        p_route_ids: null,
      })
      const refreshedGroup = Array.isArray(refreshedGroupRows) ? refreshedGroupRows[0] : refreshedGroupRows
      if (refreshedGroup) setGroupAggregate(refreshedGroup as CourseAggregate)
    }
    setSavingHandicap(false)
  }

  const openRound = async (round: RoundSummary) => {
    setDetailLoading(true)
    setError(null)
    setAggregate(null)
    setCourseAllAggregate(null)
    setGroupAggregate(null)
    try {
      const [{ data: holeRows, error: holesError }, { data: shotRows, error: shotsError }] = await Promise.all([
        supabase.from('round_holes').select('*').eq('round_id', round.id).order('hole_number'),
        supabase.from('round_shots').select('hole_number,shot_number,club,distance_to_pin_before,distance_to_pin_after,shot_distance,ball_lie,penalty').eq('round_id', round.id).order('hole_number').order('shot_number'),
      ])
      if (holesError) throw holesError
      if (shotsError) throw shotsError
      setDetail({ ...round, holes: toHoleRecords((holeRows ?? []) as HoleRow[], (shotRows ?? []) as ShotRow[]) })
      if (round.course_id && round.play_mode) {
        const { data: aggregateRows } = await supabase.rpc('get_course_round_aggregate', {
          p_course_id: round.course_id,
          p_play_mode: round.play_mode,
          p_skill_group: profile?.skill_group ?? currentGroup,
          p_route_ids: round.route_ids,
        })
        const first = Array.isArray(aggregateRows) ? aggregateRows[0] : aggregateRows
        if (first) setAggregate(first as CourseAggregate)
        const { data: allRows } = await supabase.rpc('get_course_round_aggregate', {
          p_course_id: round.course_id,
          p_play_mode: round.play_mode,
          p_skill_group: 'all',
          p_route_ids: round.route_ids,
        })
        const allFirst = Array.isArray(allRows) ? allRows[0] : allRows
        if (allFirst) setCourseAllAggregate(allFirst as CourseAggregate)
      }
      const { data: groupRows } = await supabase.rpc('get_course_round_aggregate', {
        p_course_id: null,
        p_play_mode: null,
        p_skill_group: profile?.skill_group ?? currentGroup,
      })
      const groupRow = Array.isArray(groupRows) ? groupRows[0] : groupRows
      if (groupRow) setGroupAggregate(groupRow as CourseAggregate)
    } catch (err) {
      setError(err instanceof Error ? err.message : '라운드 상세를 불러오지 못했습니다.')
    } finally {
      setDetailLoading(false)
    }
  }

  const updateVisibility = async (round: RoundDetail, target: 'friends' | 'aggregate') => {
    if (!userId) return
    const isStopping = round.visibility === target
    if (!isStopping && target === 'friends' && !dataPreferences?.allow_friend_sharing) {
      setError('친구 비교 공유를 사용하려면 MY의 공유 설정에서 선택 동의를 켜 주세요.')
      return
    }
    if (!isStopping && target === 'aggregate' && !dataPreferences?.allow_anonymous_aggregate) {
      setError('익명 평균 분석에 참여하려면 MY의 공유 설정에서 선택 동의를 켜 주세요.')
      return
    }
    const visibility = round.visibility === target ? 'private' : target
    setSharing(true)
    setError(null)
    try {
      const { error: updateError } = await supabase.from('rounds')
        .update({ visibility })
        .eq('id', round.id)
        .eq('user_id', userId)
      if (updateError) throw updateError
      setDetail({ ...round, visibility })
      setRounds((current) => current.map((item) => item.id === round.id ? { ...item, visibility } : item))
      setAggregate(null)
      setCourseAllAggregate(null)
      setGroupAggregate(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '공개 설정을 변경하지 못했습니다.')
    } finally {
      setSharing(false)
    }
  }

  const updateDataSharingPreference = async (kind: 'anonymous_aggregate' | 'friend_sharing' | 'ai_practice_analysis', enabled: boolean) => {
    if (!userId || !dataPreferences || savingPreferences) return
    setSavingPreferences(true)
    setError(null)
    try {
      const { error: preferenceError } = await supabase.rpc('set_my_data_sharing_preference', {
        p_preference: kind,
        p_enabled: enabled,
        p_policy_version: kind === 'ai_practice_analysis' ? AI_ANALYSIS_CONSENT_VERSION : SHARING_CONSENT_VERSION,
      })
      if (preferenceError) throw preferenceError
      const key = kind === 'anonymous_aggregate' ? 'allow_anonymous_aggregate' : kind === 'friend_sharing' ? 'allow_friend_sharing' : 'allow_ai_practice_analysis'
      const updated = { ...dataPreferences, [key]: enabled }
      setDataPreferences(updated)
      if (!enabled && kind !== 'ai_practice_analysis') {
        const visibility = kind === 'anonymous_aggregate' ? 'aggregate' : 'friends'
        setRounds((current) => current.map((round) => round.visibility === visibility ? { ...round, visibility: 'private' } : round))
        setDetail((current) => current?.visibility === visibility ? { ...current, visibility: 'private' } : current)
      }
      setAggregate(null)
      setCourseAllAggregate(null)
      setGroupAggregate(null)
      setFriendAggregate({})
    } catch (err) {
      setError(err instanceof Error ? err.message : '공유 설정을 저장하지 못했습니다.')
    } finally {
      setSavingPreferences(false)
    }
  }

  const withdrawAccount = async () => {
    if (!userId || withdrawing || !window.confirm('탈퇴하면 계정과 모든 라운드·샷 기록이 삭제됩니다. 계속하시겠습니까?')) return
    setWithdrawing(true)
    setError(null)
    try {
      const { error: withdrawalError } = await supabase.rpc('withdraw_my_account')
      if (withdrawalError) throw withdrawalError
      await supabase.auth.signOut()
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '탈퇴 처리에 실패했습니다.')
      setWithdrawing(false)
    }
  }

  const updateScoreGuidePreference = async (enabled: boolean) => {
    if (!userId || !dataPreferences || savingPreferences) return
    setSavingPreferences(true)
    setError(null)
    try {
      const { error: preferenceError } = await supabase.rpc('set_my_score_guide_preference', { p_enabled: enabled, p_completed: false })
      if (preferenceError) throw preferenceError
      setDataPreferences({ ...dataPreferences, score_guide_enabled: enabled })
    } catch (err) {
      setError(err instanceof Error ? err.message : '도움말 설정을 저장하지 못했습니다.')
    } finally {
      setSavingPreferences(false)
    }
  }

  const sendFriendRequest = async () => {
    if (!userId || !friendIdInput.trim()) return
    const friendId = friendIdInput.trim()
    if (friendId === userId) { setError('내 계정에는 친구 요청을 보낼 수 없습니다.'); return }
    const { error: requestError } = await supabase.from('friend_connections').insert({ requester_id: userId, addressee_id: friendId })
    if (requestError) { setError('친구 요청을 보내지 못했습니다. 계정 ID를 확인하거나 이미 요청한 관계인지 확인해 주세요.'); return }
    setFriendIdInput('')
    const { data } = await supabase.from('friend_connections').select('id,requester_id,addressee_id,status').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    setFriends((data ?? []) as FriendConnection[])
  }

  const respondToFriendRequest = async (connection: FriendConnection, status: 'accepted' | 'rejected') => {
    const { error: responseError } = await supabase.from('friend_connections').update({ status }).eq('id', connection.id)
    if (responseError) { setError('친구 요청 상태를 변경하지 못했습니다.'); return }
    setFriends((current) => current.map((item) => item.id === connection.id ? { ...item, status } : item))
  }

  const removeFriendConnection = async (connection: FriendConnection) => {
    const { error: deleteError } = await supabase.from('friend_connections').delete().eq('id', connection.id)
    if (deleteError) { setError('친구 관계를 정리하지 못했습니다.'); return }
    setFriends((current) => current.filter((item) => item.id !== connection.id))
    setFriendAggregate((current) => {
      const next = { ...current }
      const friendId = connection.requester_id === userId ? connection.addressee_id : connection.requester_id
      delete next[friendId]
      return next
    })
  }

  const loadFriendComparison = async (friendId: string, courseId?: string | null, playMode?: 'field' | 'screen' | null) => {
    const { data: overallRows, error: overallError } = await supabase.rpc('get_friend_round_aggregate', { p_friend_id: friendId, p_course_id: null, p_play_mode: null, p_route_ids: null })
    const { data: courseRows, error: courseError } = courseId && playMode
      ? await supabase.rpc('get_friend_round_aggregate', { p_friend_id: friendId, p_course_id: courseId, p_play_mode: playMode, p_route_ids: detail?.route_ids ?? [] })
      : { data: null, error: null }
    if (overallError || courseError) { setError('친구 비교를 불러오지 못했습니다. 친구 관계와 공유 설정을 확인해 주세요.'); return }
    const first = (value: unknown) => Array.isArray(value) ? value[0] ?? null : value
    setFriendAggregate((current) => ({ ...current, [friendId]: { overall: first(overallRows) as FriendAggregate | null, course: first(courseRows) as FriendAggregate | null } }))
  }

  const exportHistory = async () => {
    if (!userId) return
    setExporting(true)
    setError(null)
    try {
      await exportRoundHistory(supabase, rounds)
    } catch (err) {
      setError(err instanceof Error ? err.message : '기록 내보내기에 실패했습니다.')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <div role="status" style={{ padding: '48px 16px', textAlign: 'center', ...muted }}>내 라운드 기록을 불러오는 중입니다…</div>
  if (!userId) return <div style={{ ...CARD, margin: '20px 16px', textAlign: 'center' }}><h1 style={{ marginTop: 0 }}>MY 데이터</h1><p style={muted}>로그인하면 라운드와 샷 기록을 모든 기기에서 확인할 수 있습니다.</p></div>

  return (
    <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '16px', display: 'grid', gap: '14px' }}>
      <section style={{ ...CARD, background: `linear-gradient(120deg,${palette.forest950},${palette.emerald900})`, color: palette.white }}>
        <p style={{ margin: '0 0 6px', color: palette.emerald200, fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em' }}>MY GOLF DATA</p>
        <h1 style={{ margin: '0 0 8px', fontSize: '23px' }}>{profile?.nickname || '골퍼'}님의 기록 보관함</h1>
        <p style={{ margin: 0, color: palette.emerald100, fontSize: '13px' }}>모든 라운드와 홀별 샷을 저장하고, 선택한 기록의 전체 상세를 언제든지 다시 볼 수 있습니다.</p>
      </section>

      <SampleRoundsSection sampleSessions={sampleSessions} selectedSample={selectedSample} setSelectedSample={setSelectedSample} startSample={startSample} startingSample={startingSample} onStartSample={onStartSample} />

      <CommercePanel />

      <SharingPreferencesSection dataPreferences={dataPreferences} savingPreferences={savingPreferences} updateDataSharingPreference={updateDataSharingPreference} updateScoreGuidePreference={updateScoreGuidePreference} />

      <section style={CARD} aria-labelledby="account-policy-title">
        <h2 id="account-policy-title" style={{ margin: '0 0 8px', fontSize: 16 }}>약관·개인정보·탈퇴</h2>
        <AgreementDetails kind="terms" />
        <AgreementDetails kind="privacy" />
        <p style={muted}>탈퇴 시 계정·라운드·샷 기록을 삭제합니다. 탈퇴 처리 기록은 6개월 뒤 자동 삭제됩니다.</p>
        <button type="button" disabled={withdrawing} onClick={() => void withdrawAccount()} style={{ border: `1px solid ${palette.red200}`, borderRadius: 7, padding: '8px 12px', color: palette.red700, background: palette.white }}>{withdrawing ? '탈퇴 처리 중…' : '회원 탈퇴'}</button>
      </section>

      {error && <div role="alert" style={{ ...CARD, color: palette.red700, background: palette.red50 }}>{error}</div>}

      {suggestGroupReview && <section role="status" style={{ ...CARD, borderColor: palette.amber300, background: palette.amber50 }}>
        <strong style={{ color: palette.amber800 }}>실력 그룹을 다시 확인해 볼까요?</strong>
        <p style={{ ...muted, marginBottom: 0 }}>최근 완료 라운드 {completedRounds.length}회의 평균이 {averageScore?.toFixed(1)}타입니다. 초보 그룹은 비교용으로만 사용하며, 핸디캡 입력을 검토해 보세요. 이 제안은 공식 핸디캡 산정이 아닙니다.</p>
      </section>}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px' }} aria-label="요약 통계">
        {[
          ['완료 라운드', `${completedRounds.length}회`],
          ['평균 스코어', averageScore == null ? '기록 없음' : `${averageScore.toFixed(1)}타`],
          ['베스트 스코어', bestScore == null ? '기록 없음' : `${bestScore}타`],
          ['비교 그룹', GOLF_LEVEL_GROUPS[currentGroup].label],
        ].map(([label, value]) => <div key={label} style={CARD}><div style={muted}>{label}</div><strong style={{ display: 'block', marginTop: '7px', color: color.brand, fontSize: '20px' }}>{value}</strong></div>)}
      </section>

      <TrophySection trophies={trophies} earnedTrophies={earnedTrophies} achievementRounds={achievementRounds} currentLevel={currentLevel} currentLevelIndex={currentLevelIndex} nextLevel={nextLevel} levelProgress={levelProgress} achievementsError={achievementsError} achievementsLoading={achievementsLoading} integrityError={integrityError} integrityLoading={integrityLoading} />

      <section style={CARD} aria-labelledby="level-progress-title">
        <h2 id="level-progress-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>⛳ 내 핸디캡 그룹</h2>
        <p style={{ ...muted, margin: '0 0 12px' }}>현재 비교 그룹: {GOLF_LEVEL_GROUPS[currentGroup].label}. 핸디캡 지수를 직접 입력해 비교에 사용할 그룹을 설정할 수 있습니다.</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label htmlFor="my-handicap-index" style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: palette.slate600, fontWeight: 700 }}>내 핸디캡 지수</label>
            <input id="my-handicap-index" type="number" min="-10" max="54" step="0.1" inputMode="decimal" value={handicapInput} onChange={(event) => { setHandicapInput(event.target.value); setProfileSaved(false) }} placeholder="모르면 비워 두세요" style={{ width: '100%', boxSizing: 'border-box', padding: '8px', border: `1px solid ${palette.slate300}`, borderRadius: '7px' }} />
          </div>
          <button type="button" onClick={() => void saveHandicap()} disabled={savingHandicap} style={{ padding: '9px 12px', border: 0, borderRadius: '7px', background: color.brand, color: palette.white, fontWeight: 700, cursor: savingHandicap ? 'wait' : 'pointer' }}>{savingHandicap ? '저장 중…' : '핸디캡 그룹 저장'}</button>
          {profileSaved && <span role="status" style={{ ...muted, color: color.brand }}>비교 그룹을 업데이트했습니다.</span>}
        </div>
      </section>

      <FriendsSection userId={userId} friends={friends} friendAggregate={friendAggregate} groupAggregate={groupAggregate} detail={detail} friendIdInput={friendIdInput} setFriendIdInput={setFriendIdInput} sendFriendRequest={sendFriendRequest} respondToFriendRequest={respondToFriendRequest} removeFriendConnection={removeFriendConnection} loadFriendComparison={loadFriendComparison} />

      <RoundHistorySection rounds={rounds} integrityByRound={integrityByRound} openRound={openRound} exportHistory={exportHistory} exporting={exporting} />

      {detailLoading && <p role="status" style={{ ...muted, textAlign: 'center' }}>홀별 샷 상세를 불러오는 중입니다…</p>}
      {detail && <RoundDetailSection detail={detail} setDetail={setDetail} integrityByRound={integrityByRound} dataPreferences={dataPreferences} sharing={sharing} updateVisibility={updateVisibility} aggregate={aggregate} courseAllAggregate={courseAllAggregate} />}
    </main>
  )
}
