'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getGolfLevelGroup } from '@/utils/golf/levels'
import CommercePanel from '@/components/my/CommercePanel'
import { AI_ANALYSIS_CONSENT_VERSION, SHARING_CONSENT_VERSION } from '@/utils/consent'
import type { CourseAggregate, FriendAggregate, FriendConnection, HoleRow, ProfileSummary, RoundDetail, RoundOverview, RoundSummary, ShotRow, UserDataPreferences } from './myTypes'
import { buildLevelProgress, toHoleRecords } from './myRecords'
import { useSampleSessions } from './useSampleSessions'
import { useRoundIntegrity } from './useRoundIntegrity'
import { useAchievements } from './useAchievements'
import { CARD, muted } from './myStyles'
import { exportRoundHistory } from './exportRoundHistory'
import SampleRoundsSection from './SampleRoundsSection'
import SharingPreferencesSection from './SharingPreferencesSection'
import TrophySection from './TrophySection'
import FriendsSection from './FriendsSection'
import RoundHistorySection from './RoundHistorySection'
import RoundDetailSection from './RoundDetailSection'
import { palette } from '@/utils/theme'
import AccountSection from './AccountSection'
import SummaryStatsSection from './SummaryStatsSection'
import HandicapSection from './HandicapSection'

const ROUND_PAGE_SIZE = 50
const ROUND_COLUMNS = 'id,created_at,registered_at,status,total_score,total_putts,club_name,golf_club,course_name,course_id,play_mode,screen_provider,entry_mode,route_ids,tee_code,tee_name,visibility'

export default function MyTab({ onStartSample }: { onStartSample?: (id: string) => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [dataPreferences, setDataPreferences] = useState<UserDataPreferences | null>(null)
  const [handicapInput, setHandicapInput] = useState('')
  const [savingHandicap, setSavingHandicap] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [rounds, setRounds] = useState<RoundSummary[]>([])
  const [roundsExhausted, setRoundsExhausted] = useState(true)
  const [loadingMoreRounds, setLoadingMoreRounds] = useState(false)
  const [overview, setOverview] = useState<RoundOverview | null>(null)
  const [overviewError, setOverviewError] = useState(false)
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

  // 목록은 최근 것부터 한 쪽씩 불러온다. 요약(라운드 수·평균·인정 라운드)은 get_my_round_overview로 따로 받는다.
  const fetchRoundPage = useCallback(async (uid: string, from: number, size = ROUND_PAGE_SIZE) => {
    const { data, error: queryError } = await supabase
      .from('rounds')
      .select(ROUND_COLUMNS)
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .range(from, from + size - 1)
    if (queryError) throw queryError
    return (data ?? []) as RoundSummary[]
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
        // 서로 기다릴 필요가 없는 요청은 한꺼번에 보낸다. 오류를 반영하는 순서는 예전과 같다.
        const [profileResult, loadedRounds, overviewResult, preferencesResult, connectionsResult] = await Promise.all([
          supabase.from('profiles').select('nickname,handicap_index,skill_group').eq('id', uid).maybeSingle(),
          fetchRoundPage(uid, 0),
          supabase.rpc('get_my_round_overview'),
          supabase.from('user_data_preferences')
            .select('user_id,allow_anonymous_aggregate,allow_friend_sharing,allow_ai_practice_analysis,score_guide_enabled,score_guide_completed_at')
            .eq('user_id', uid).maybeSingle(),
          supabase.from('friend_connections').select('id,requester_id,addressee_id,status')
            .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
        ])
        if (profileResult.error) throw profileResult.error
        const { data: preferences, error: preferencesError } = preferencesResult
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
        setRoundsExhausted(loadedRounds.length < ROUND_PAGE_SIZE)
        // 요약을 못 받아도 목록과 나머지 화면은 보여 주고, 요약 자리에만 알린다.
        const overviewRow = Array.isArray(overviewResult.data) ? overviewResult.data[0] : overviewResult.data
        setOverview(overviewResult.error || !overviewRow ? null : overviewRow as RoundOverview)
        setOverviewError(!!overviewResult.error || !overviewRow)
        setDataPreferences((preferences as UserDataPreferences | null) ?? {
          user_id: uid,
          allow_anonymous_aggregate: false,
          allow_friend_sharing: false,
          allow_ai_practice_analysis: false,
          score_guide_enabled: true,
          score_guide_completed_at: null,
        })
        const { data: connections, error: connectionsError } = connectionsResult
        if (connectionsError) throw connectionsError
        setFriends((connections ?? []) as FriendConnection[])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '내 데이터를 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [supabase, fetchRoundPage])

  const loadMoreRounds = async () => {
    if (!userId || loadingMoreRounds || roundsExhausted) return
    setLoadingMoreRounds(true)
    try {
      const page = await fetchRoundPage(userId, rounds.length)
      // 그사이 새 라운드가 생기면 같은 라운드가 다시 올 수 있어 걸러 낸다.
      setRounds((current) => [...current, ...page.filter((round) => !current.some((item) => item.id === round.id))])
      setRoundsExhausted(page.length < ROUND_PAGE_SIZE)
    } catch {
      setError('이전 기록을 더 불러오지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setLoadingMoreRounds(false)
    }
  }

  const { sampleSessions, selectedSample, setSelectedSample, startingSample, startSample } = useSampleSessions(supabase, userId, setError, onStartSample)
  // 기록 확인 결과는 목록에 보이는 라운드의 표시에만 쓴다. 레벨과 트로피는 서버 요약의 인정 라운드로 정한다.
  const { integrityByRound } = useRoundIntegrity(supabase, userId, rounds)
  const completedRoundCount = overview?.completed_rounds ?? null
  const achievementRoundIds = useMemo(() => overview?.achievement_round_ids ?? [], [overview])
  const { trophies, achievementsLoading, achievementsError } = useAchievements(supabase, achievementRoundIds)
  const earnedTrophies = trophies.filter((trophy) => trophy.earned)
  const { currentLevelIndex, currentLevel, nextLevel, levelProgress } = buildLevelProgress(achievementRoundIds.length)
  const averageScore = overview?.average_score ?? null
  const bestScore = overview?.best_score ?? null
  const currentGroup = profile?.handicap_index != null ? getGolfLevelGroup(profile.handicap_index) : profile?.skill_group ?? 'beginner'

  const suggestGroupReview = currentGroup === 'beginner' && (completedRoundCount ?? 0) >= 5 && averageScore != null && averageScore <= 75

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

  // 상세를 연 순서를 센다. 빨리 다른 라운드를 누르면 앞서 연 라운드의 늦은 응답은 버린다.
  const openRoundRequest = useRef(0)
  const openRound = async (round: RoundSummary) => {
    const request = ++openRoundRequest.current
    const isCurrent = () => request === openRoundRequest.current
    setDetailLoading(true)
    setError(null)
    setAggregate(null)
    setCourseAllAggregate(null)
    setGroupAggregate(null)
    const skillGroup = profile?.skill_group ?? currentGroup
    const firstRow = (rows: unknown) => (Array.isArray(rows) ? rows[0] : rows) as CourseAggregate | null | undefined
    // 비교 평균 세 가지는 홀·샷 기록과 서로 관계가 없어 함께 요청한다. 상세는 홀·샷이 오는 대로 먼저 보여 준다.
    const courseKnown = !!(round.course_id && round.play_mode)
    const aggregates = Promise.all([
      courseKnown ? supabase.rpc('get_course_round_aggregate', { p_course_id: round.course_id, p_play_mode: round.play_mode, p_skill_group: skillGroup, p_route_ids: round.route_ids }) : null,
      courseKnown ? supabase.rpc('get_course_round_aggregate', { p_course_id: round.course_id, p_play_mode: round.play_mode, p_skill_group: 'all', p_route_ids: round.route_ids }) : null,
      supabase.rpc('get_course_round_aggregate', { p_course_id: null, p_play_mode: null, p_skill_group: skillGroup }),
    ]).catch(() => [null, null, null] as const) // 홀·샷이 먼저 실패해도 처리되지 않은 오류로 남지 않게 한다.
    try {
      const [{ data: holeRows, error: holesError }, { data: shotRows, error: shotsError }] = await Promise.all([
        supabase.from('round_holes').select('*').eq('round_id', round.id).order('hole_number'),
        supabase.from('round_shots').select('hole_number,shot_number,club,distance_to_pin_before,distance_to_pin_after,shot_distance,ball_lie,penalty').eq('round_id', round.id).order('hole_number').order('shot_number'),
      ])
      if (!isCurrent()) return
      if (holesError) throw holesError
      if (shotsError) throw shotsError
      setDetail({ ...round, holes: toHoleRecords((holeRows ?? []) as HoleRow[], (shotRows ?? []) as ShotRow[]) })
      // 비교 평균은 못 받아도 상세는 그대로 보여 준다(예전과 같다).
      const [course, courseAll, group] = await aggregates
      if (!isCurrent()) return
      const courseRow = firstRow(course?.data)
      if (courseRow) setAggregate(courseRow)
      const courseAllRow = firstRow(courseAll?.data)
      if (courseAllRow) setCourseAllAggregate(courseAllRow)
      const groupRow = firstRow(group?.data)
      if (groupRow) setGroupAggregate(groupRow)
    } catch (err) {
      if (isCurrent()) setError(err instanceof Error ? err.message : '라운드 상세를 불러오지 못했습니다.')
    } finally {
      if (isCurrent()) setDetailLoading(false)
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
    // 전체 평균과 구장 평균은 서로 관계가 없어 함께 요청한다.
    const [{ data: overallRows, error: overallError }, { data: courseRows, error: courseError }] = await Promise.all([
      supabase.rpc('get_friend_round_aggregate', { p_friend_id: friendId, p_course_id: null, p_play_mode: null, p_route_ids: null }),
      courseId && playMode
        ? supabase.rpc('get_friend_round_aggregate', { p_friend_id: friendId, p_course_id: courseId, p_play_mode: playMode, p_route_ids: detail?.route_ids ?? [] })
        : Promise.resolve({ data: null, error: null }),
    ])
    if (overallError || courseError) { setError('친구 비교를 불러오지 못했습니다. 친구 관계와 공유 설정을 확인해 주세요.'); return }
    const first = (value: unknown) => Array.isArray(value) ? value[0] ?? null : value
    setFriendAggregate((current) => ({ ...current, [friendId]: { overall: first(overallRows) as FriendAggregate | null, course: first(courseRows) as FriendAggregate | null } }))
  }

  const exportHistory = async () => {
    if (!userId) return
    setExporting(true)
    setError(null)
    try {
      // 내보내기는 화면에 불러온 만큼이 아니라 전체 라운드를 대상으로 한다.
      const all: RoundSummary[] = []
      for (let from = 0; ; from += 500) {
        const page = await fetchRoundPage(userId, from, 500)
        all.push(...page)
        if (page.length < 500) break
      }
      await exportRoundHistory(supabase, all)
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

      <AccountSection withdrawing={withdrawing} withdrawAccount={withdrawAccount} />

      {error && <div role="alert" style={{ ...CARD, color: palette.red700, background: palette.red50 }}>{error}</div>}

      {suggestGroupReview && <section role="status" style={{ ...CARD, borderColor: palette.amber300, background: palette.amber50 }}>
        <strong style={{ color: palette.amber800 }}>실력 그룹을 다시 확인해 볼까요?</strong>
        <p style={{ ...muted, marginBottom: 0 }}>최근 완료 라운드 {completedRoundCount}회의 평균이 {averageScore?.toFixed(1)}타입니다. 초보 그룹은 비교용으로만 사용하며, 핸디캡 입력을 검토해 보세요. 이 제안은 공식 핸디캡 산정이 아닙니다.</p>
      </section>}

      <SummaryStatsSection completedRoundCount={completedRoundCount} averageScore={averageScore} bestScore={bestScore} currentGroup={currentGroup} />

      <TrophySection trophies={trophies} earnedTrophies={earnedTrophies} achievementRoundCount={achievementRoundIds.length} currentLevel={currentLevel} currentLevelIndex={currentLevelIndex} nextLevel={nextLevel} levelProgress={levelProgress} achievementsError={achievementsError} achievementsLoading={achievementsLoading} eligibilityError={overviewError} />

      <HandicapSection currentGroup={currentGroup} handicapInput={handicapInput} setHandicapInput={setHandicapInput} setProfileSaved={setProfileSaved} saveHandicap={saveHandicap} savingHandicap={savingHandicap} profileSaved={profileSaved} />

      <FriendsSection userId={userId} friends={friends} friendAggregate={friendAggregate} groupAggregate={groupAggregate} detail={detail} friendIdInput={friendIdInput} setFriendIdInput={setFriendIdInput} sendFriendRequest={sendFriendRequest} respondToFriendRequest={respondToFriendRequest} removeFriendConnection={removeFriendConnection} loadFriendComparison={loadFriendComparison} />

      <RoundHistorySection rounds={rounds} integrityByRound={integrityByRound} openRound={openRound} exportHistory={exportHistory} exporting={exporting} totalRounds={overview?.total_rounds ?? null} hasMore={!roundsExhausted} loadingMore={loadingMoreRounds} onLoadMore={() => void loadMoreRounds()} />

      {detailLoading && <p role="status" style={{ ...muted, textAlign: 'center' }}>홀별 샷 상세를 불러오는 중입니다…</p>}
      {detail && <RoundDetailSection detail={detail} setDetail={setDetail} integrityByRound={integrityByRound} dataPreferences={dataPreferences} sharing={sharing} updateVisibility={updateVisibility} aggregate={aggregate} courseAllAggregate={courseAllAggregate} />}
    </main>
  )
}
