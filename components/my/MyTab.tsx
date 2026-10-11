'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BallLie, HoleRecord, ShotRecord } from '@/types/golf'
import { createClient } from '@/utils/supabase/client'
import { GOLF_LEVEL_GROUPS, getGolfLevelGroup, type GolfLevelGroup } from '@/utils/golf/levels'

interface RoundSummary {
  id: string
  created_at: string
  status: string
  total_score: number | null
  total_putts: number | null
  club_name: string | null
  golf_club: string | null
  course_name: string | null
  course_id: string | null
  play_mode: 'field' | 'screen' | null
  route_ids: string[]
  visibility: 'private' | 'friends' | 'aggregate'
}

interface RoundDetail extends RoundSummary {
  holes: HoleRecord[]
}

interface ProfileSummary {
  nickname: string | null
  handicap_index: number | null
  skill_group: GolfLevelGroup | null
}

interface CourseAggregate {
  sample_size: number
  average_score: number
  average_putts: number
  fairway_hit_percent: number | null
  gir_percent: number | null
}

interface FriendConnection {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'rejected'
}

interface FriendAggregate {
  sample_size: number
  average_score: number | null
  average_putts: number | null
}

interface HoleRow {
  hole_number: number
  par: number
  score: number
  putts: number
  fairway_hit: boolean | null
  gir: boolean
  shots: ShotRecord[] | null
  total_distance: number | null
}

interface ShotRow {
  hole_number: number
  shot_number: number
  club: string
  distance_to_pin_before: number
  distance_to_pin_after: number
  shot_distance: number
  ball_lie: BallLie
  penalty: number
}

const CARD: React.CSSProperties = { padding: '18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px' }
const muted: React.CSSProperties = { color: '#64748b', fontSize: '12px' }

function toHoleRecords(rows: HoleRow[], shotRows: ShotRow[] = []): HoleRecord[] {
  const shotsByHole = new Map<number, ShotRecord[]>()
  for (const row of shotRows) {
    const shots = shotsByHole.get(row.hole_number) ?? []
    shots.push({
      shotNumber: row.shot_number,
      club: row.club,
      distanceToPinBefore: row.distance_to_pin_before,
      distanceToPinAfter: row.distance_to_pin_after,
      shotDistance: row.shot_distance,
      ballLie: row.ball_lie,
      penalty: row.penalty,
    })
    shotsByHole.set(row.hole_number, shots)
  }
  return rows.map((row) => ({
    holeNumber: row.hole_number,
    par: row.par,
    score: row.score,
    scoreDiff: row.score - row.par,
    putts: row.putts,
    fairwayHit: row.fairway_hit,
    gir: row.gir,
    totalDistance: row.total_distance ?? 0,
    shots: shotsByHole.get(row.hole_number)?.length ? shotsByHole.get(row.hole_number)! : Array.isArray(row.shots) ? row.shots : [],
  }))
}

const roundLocation = (round: RoundSummary) => round.club_name || round.golf_club || '구장 정보 없음'
const formatDate = (raw: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(raw))

export default function MyTab() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [handicapInput, setHandicapInput] = useState('')
  const [savingHandicap, setSavingHandicap] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [rounds, setRounds] = useState<RoundSummary[]>([])
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
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRounds = useCallback(async (uid: string) => {
    const pageSize = 500
    const all: RoundSummary[] = []
    for (let from = 0; ; from += pageSize) {
      const { data, error: queryError } = await supabase
        .from('rounds')
        .select('id,created_at,status,total_score,total_putts,club_name,golf_club,course_name,course_id,play_mode,route_ids,visibility')
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
        if (cancelled) return
        setUserId(uid)
        setProfile((profileResult.data as ProfileSummary | null) ?? {
          nickname: session.user.user_metadata?.nickname ?? '골퍼',
          handicap_index: null,
          skill_group: 'beginner',
        })
        setHandicapInput(profileResult.data?.handicap_index == null ? '' : String(profileResult.data.handicap_index))
        setRounds(loadedRounds)
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
  const averageScore = completedRounds.length
    ? completedRounds.reduce((sum, round) => sum + (round.total_score ?? 0), 0) / completedRounds.length
    : null
  const bestScore = completedRounds.length ? Math.min(...completedRounds.map((round) => round.total_score ?? Infinity)) : null
  const currentGroup = profile?.handicap_index != null ? getGolfLevelGroup(profile.handicap_index) : profile?.skill_group ?? 'beginner'

  const progress = useMemo(() => {
    const milestones = [
      { score: 108, label: '첫 108타' },
      { score: 100, label: '100타 돌파' },
      { score: 90, label: '90타 돌파' },
      { score: 80, label: '싱글 도전' },
      { score: 72, label: '파 플레이' },
    ]
    const achieved = averageScore == null ? -1 : milestones.reduce((index, milestone, i) => averageScore <= milestone.score ? i : index, -1)
    const next = milestones[achieved + 1]
    return { achieved, milestones, next }
  }, [averageScore])

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
      const detailShots = shotsError ? [] : (shotRows ?? []) as ShotRow[]
      setDetail({ ...round, holes: toHoleRecords((holeRows ?? []) as HoleRow[], detailShots) })
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
      const exported = []
      for (let from = 0; from < rounds.length; from += 100) {
        const batch = rounds.slice(from, from + 100)
        const ids = batch.map((round) => round.id)
        if (ids.length === 0) continue
        const [{ data: holes, error: holesError }, { data: shots, error: shotsError }] = await Promise.all([
          supabase.from('round_holes').select('*').in('round_id', ids).order('hole_number'),
          supabase.from('round_shots').select('round_id,hole_number,shot_number,club,distance_to_pin_before,distance_to_pin_after,shot_distance,ball_lie,penalty').in('round_id', ids).order('hole_number').order('shot_number'),
        ])
        if (holesError) throw holesError
        const shotsByRound = new Map<string, ShotRow[]>()
        for (const row of shotsError ? [] : shots ?? []) {
          const typed = row as ShotRow & { round_id: string }
          shotsByRound.set(typed.round_id, [...(shotsByRound.get(typed.round_id) ?? []), typed])
        }
        const holesByRound = new Map<string, HoleRow[]>()
        for (const row of holes ?? []) {
          const typed = row as HoleRow & { round_id: string }
          holesByRound.set(typed.round_id, [...(holesByRound.get(typed.round_id) ?? []), typed])
        }
        for (const round of batch) {
          exported.push({
            id: round.id,
            date: round.created_at,
            course: roundLocation(round),
            courseLayout: round.course_name,
            playMode: round.play_mode,
            status: round.status,
            score: round.total_score,
            visibility: round.visibility,
            holes: toHoleRecords(holesByRound.get(round.id) ?? [], shotsByRound.get(round.id) ?? []),
          })
        }
      }
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), rounds: exported }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'golf-round-history.json'
      link.click()
      URL.revokeObjectURL(url)
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
      <section style={{ ...CARD, background: 'linear-gradient(120deg,#052e2b,#064e3b)', color: '#fff' }}>
        <p style={{ margin: '0 0 6px', color: '#a7f3d0', fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em' }}>MY GOLF DATA</p>
        <h1 style={{ margin: '0 0 8px', fontSize: '23px' }}>{profile?.nickname || '골퍼'}님의 기록 보관함</h1>
        <p style={{ margin: 0, color: '#d1fae5', fontSize: '13px' }}>모든 라운드와 홀별 샷을 저장하고, 선택한 기록의 전체 상세를 언제든지 다시 볼 수 있습니다.</p>
      </section>

      {error && <div role="alert" style={{ ...CARD, color: '#b91c1c', background: '#fef2f2' }}>{error}</div>}

      {suggestGroupReview && <section role="status" style={{ ...CARD, borderColor: '#fcd34d', background: '#fffbeb' }}>
        <strong style={{ color: '#92400e' }}>실력 그룹을 다시 확인해 볼까요?</strong>
        <p style={{ ...muted, marginBottom: 0 }}>최근 완료 라운드 {completedRounds.length}회의 평균이 {averageScore?.toFixed(1)}타입니다. 초보 그룹은 비교용으로만 사용하며, 핸디캡 입력을 검토해 보세요. 이 제안은 공식 핸디캡 산정이 아닙니다.</p>
      </section>}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px' }} aria-label="요약 통계">
        {[
          ['완료 라운드', `${completedRounds.length}회`],
          ['평균 스코어', averageScore == null ? '기록 없음' : `${averageScore.toFixed(1)}타`],
          ['베스트 스코어', bestScore == null ? '기록 없음' : `${bestScore}타`],
          ['비교 그룹', GOLF_LEVEL_GROUPS[currentGroup].label],
        ].map(([label, value]) => <div key={label} style={CARD}><div style={muted}>{label}</div><strong style={{ display: 'block', marginTop: '7px', color: '#047857', fontSize: '20px' }}>{value}</strong></div>)}
      </section>

      <section style={CARD} aria-labelledby="level-progress-title">
        <h2 id="level-progress-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>🏅 라운드 성장 기록</h2>
        <p style={{ ...muted, margin: '0 0 12px' }}>핸디캡 그룹과 별도로, 완료 라운드 평균 스코어에 따라 도전 목표를 보여줍니다.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
          {progress.milestones.map((milestone, index) => <span key={milestone.label} aria-current={index === progress.achieved ? 'step' : undefined} style={{ padding: '7px 10px', borderRadius: '999px', background: index <= progress.achieved ? '#dcfce7' : '#f1f5f9', color: index <= progress.achieved ? '#166534' : '#64748b', fontSize: '11px', fontWeight: 700 }}>{index <= progress.achieved ? '✓ ' : '○ '}{milestone.label}</span>)}
        </div>
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#334155' }}>
          {averageScore == null ? '완료 라운드를 기록하면 성장 목표가 열립니다.' : progress.next ? `다음 목표: 평균 ${progress.next.score}타 이하 (${progress.next.label})` : '모든 스코어 목표를 달성했습니다.'}
        </div>
        <p style={{ ...muted, margin: '6px 0 0', fontSize: '10px' }}>기록 기반의 재미 요소이며 핸디캡이나 프로 자격을 변경하지 않습니다.</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'end', flexWrap: 'wrap', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label htmlFor="my-handicap-index" style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: '#475569', fontWeight: 700 }}>내 핸디캡 지수 · 비교 그룹 {GOLF_LEVEL_GROUPS[currentGroup].label}</label>
            <input id="my-handicap-index" type="number" min="-10" max="54" step="0.1" inputMode="decimal" value={handicapInput} onChange={(event) => { setHandicapInput(event.target.value); setProfileSaved(false) }} placeholder="모르면 비워 두세요" style={{ width: '100%', boxSizing: 'border-box', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '7px' }} />
          </div>
          <button type="button" onClick={() => void saveHandicap()} disabled={savingHandicap} style={{ padding: '9px 12px', border: 0, borderRadius: '7px', background: '#047857', color: '#fff', fontWeight: 700, cursor: savingHandicap ? 'wait' : 'pointer' }}>{savingHandicap ? '저장 중…' : '핸디캡 그룹 저장'}</button>
          {profileSaved && <span role="status" style={{ ...muted, color: '#047857' }}>비교 그룹을 업데이트했습니다.</span>}
        </div>
      </section>

      <section style={CARD} aria-labelledby="compare-title">
        <h2 id="compare-title" style={{ margin: '0 0 6px', fontSize: '16px' }}>📊 비교 분석</h2>
        <p style={{ ...muted, margin: 0 }}>친구 비교는 상대가 친구 공개를 허용한 완료 기록만 사용합니다. 같은 구장/방식의 평균과 친구 전체 평균을 따로 확인할 수 있습니다. 익명 핸디캡 그룹 평균은 5명 이상 표본일 때만 표시합니다.</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
          <label htmlFor="friend-account-id" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)' }}>친구 계정 ID</label>
          <input id="friend-account-id" value={friendIdInput} onChange={(event) => setFriendIdInput(event.target.value)} placeholder="친구 계정 ID(UUID)" style={{ minWidth: '220px', flex: 1, padding: '9px', border: '1px solid #cbd5e1', borderRadius: '7px' }} />
          <button type="button" onClick={() => void sendFriendRequest()} style={{ padding: '9px 12px', border: 0, borderRadius: '7px', background: '#047857', color: '#fff', fontWeight: 700 }}>친구 요청</button>
        </div>
        {groupAggregate && <p style={{ ...muted, margin: '10px 0 0' }}>같은 그룹 익명 전체 평균 · 표본 {groupAggregate.sample_size}회 · {Number(groupAggregate.average_score).toFixed(1)}타 · 퍼트 {Number(groupAggregate.average_putts).toFixed(1)}</p>}
        <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
          {friends.map((connection) => {
            const incoming = connection.addressee_id === userId && connection.status === 'pending'
            const friendId = connection.requester_id === userId ? connection.addressee_id : connection.requester_id
            const comparison = friendAggregate[friendId]
            return <div key={connection.id} style={{ padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ flex: 1, fontSize: '10px', overflowWrap: 'anywhere' }}>{friendId}</code>
              {incoming ? <><button type="button" onClick={() => void respondToFriendRequest(connection, 'accepted')}>수락</button><button type="button" onClick={() => void respondToFriendRequest(connection, 'rejected')}>거절</button></> : connection.status === 'accepted' ? <>
                <button type="button" onClick={() => void loadFriendComparison(friendId, detail?.course_id, detail?.play_mode)}>평균 비교</button>
                {comparison && <span style={muted}>전체 {comparison.overall?.average_score == null ? '공개 기록 없음' : `${comparison.overall.average_score}타 (${comparison.overall.sample_size}회)`} · 이 구장 {comparison.course?.average_score == null ? '공개 기록 없음' : `${comparison.course.average_score}타 (${comparison.course.sample_size}회)`}</span>}
                <button type="button" onClick={() => void removeFriendConnection(connection)} aria-label="친구 관계 해제" style={{ border: 0, background: 'transparent', color: '#64748b', fontSize: '10px', cursor: 'pointer' }}>친구 해제</button>
              </> : connection.status === 'rejected' ? <><span style={muted}>요청이 거절됨</span><button type="button" onClick={() => void removeFriendConnection(connection)} style={{ border: 0, background: 'transparent', color: '#64748b', fontSize: '10px', cursor: 'pointer' }}>관계 삭제</button></> : <span style={muted}>요청 대기 중</span>}
            </div>
          })}
        </div>
      </section>

      <section style={CARD} aria-labelledby="history-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h2 id="history-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>📚 내 라운드 전체 기록 ({rounds.length})</h2>
            <p style={{ ...muted, margin: 0 }}>서버에 저장된 라운드를 최신순으로 표시합니다.</p>
          </div>
          <button type="button" onClick={exportHistory} disabled={exporting || rounds.length === 0} style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 700, cursor: exporting || rounds.length === 0 ? 'not-allowed' : 'pointer' }}>{exporting ? '내보내는 중…' : '전체 기록 JSON 내보내기'}</button>
        </div>
        {rounds.length === 0 ? <p style={{ ...muted, marginBottom: 0 }}>아직 서버에 저장된 라운드가 없습니다. Score 탭에서 첫 라운드를 기록해 보세요.</p> : (
          <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
            {rounds.map((round) => <button key={round.id} type="button" onClick={() => void openRound(round)} style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff', cursor: 'pointer' }}>
              <span><strong style={{ display: 'block', color: '#0f172a', fontSize: '13px' }}>{roundLocation(round)}</strong><span style={{ display: 'block', marginTop: '4px', color: '#64748b', fontSize: '11px' }}>{formatDate(round.created_at)} · {round.course_name || '코스 미입력'} · {round.play_mode === 'field' ? '필드' : round.play_mode === 'screen' ? '스크린' : '방식 미설정'}</span></span>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><strong style={{ display: 'block', color: round.total_score == null ? '#64748b' : '#047857', fontSize: '17px' }}>{round.total_score == null ? '진행 중' : `${round.total_score}타`}</strong><span style={{ fontSize: '10px', color: '#64748b' }}>{round.status === 'completed' ? `${round.visibility === 'private' ? '비공개' : '공유 설정'}` : '기록 이어하기 가능'}</span></span>
            </button>)}
          </div>
        )}
      </section>

      {detailLoading && <p role="status" style={{ ...muted, textAlign: 'center' }}>홀별 샷 상세를 불러오는 중입니다…</p>}
      {detail && <section style={CARD} aria-labelledby="round-detail-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'start' }}>
          <div><h2 id="round-detail-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>{roundLocation(detail)} 상세</h2><p style={{ ...muted, margin: 0 }}>{formatDate(detail.created_at)} · {detail.course_name || '코스 미입력'} · 총 {detail.total_score ?? '진행 중'}타</p></div>
          <button type="button" onClick={() => setDetail(null)} aria-label="라운드 상세 닫기" style={{ border: '1px solid #cbd5e1', borderRadius: '7px', padding: '6px 9px', background: '#fff', cursor: 'pointer' }}>닫기</button>
        </div>
        <div style={{ display: 'grid', gap: '9px', marginTop: '14px' }}>
          {detail.course_id && detail.play_mode && <div style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '9px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div><strong style={{ fontSize: '12px', color: '#0f172a' }}>익명 구장 평균 비교</strong><p style={{ ...muted, margin: '4px 0 0' }}>내 이름과 샷 상세는 공유하지 않습니다. 같은 핸디캡 그룹과 플레이 방식의 라운드가 5건 이상일 때만 평균을 표시합니다.</p></div>
              {detail.status === 'completed' && <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => void updateVisibility(detail, 'friends')} disabled={sharing} aria-pressed={detail.visibility === 'friends'} style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '7px', background: detail.visibility === 'friends' ? '#eff6ff' : '#fff', color: '#1d4ed8', fontSize: '11px', fontWeight: 700, cursor: sharing ? 'wait' : 'pointer' }}>{sharing ? '저장 중…' : detail.visibility === 'friends' ? '친구 공개 중 · 중단' : '친구에게 공개'}</button>
                <button type="button" onClick={() => void updateVisibility(detail, 'aggregate')} disabled={sharing} aria-pressed={detail.visibility === 'aggregate'} style={{ padding: '8px 10px', border: '1px solid #a7f3d0', borderRadius: '7px', background: detail.visibility === 'aggregate' ? '#ecfdf5' : '#fff', color: '#047857', fontSize: '11px', fontWeight: 700, cursor: sharing ? 'wait' : 'pointer' }}>{sharing ? '저장 중…' : detail.visibility === 'aggregate' ? '익명 평균 참여 중 · 중단' : '익명 평균에 참여'}</button>
              </div>}
            </div>
            {aggregate || courseAllAggregate ? <div style={{ display: 'grid', gap: '8px', marginTop: '10px', color: '#334155', fontSize: '11px' }}>
              {aggregate && <div><strong>같은 핸디 그룹</strong> · 표본 {aggregate.sample_size}회 · 평균 {Number(aggregate.average_score).toFixed(1)}타 · 퍼트 {Number(aggregate.average_putts).toFixed(1)} · 페어웨이 {aggregate.fairway_hit_percent == null ? '—' : `${aggregate.fairway_hit_percent}%`} · GIR {aggregate.gir_percent == null ? '—' : `${aggregate.gir_percent}%`}</div>}
              {courseAllAggregate && <div><strong>구장 전체 그룹</strong> · 표본 {courseAllAggregate.sample_size}회 · 평균 {Number(courseAllAggregate.average_score).toFixed(1)}타 · 퍼트 {Number(courseAllAggregate.average_putts).toFixed(1)} · 페어웨이 {courseAllAggregate.fairway_hit_percent == null ? '—' : `${courseAllAggregate.fairway_hit_percent}%`} · GIR {courseAllAggregate.gir_percent == null ? '—' : `${courseAllAggregate.gir_percent}%`}</div>}
              {!aggregate && <p style={{ ...muted, margin: 0 }}>같은 핸디 그룹은 5명 이상 표본이 모이지 않았습니다.</p>}
              {!courseAllAggregate && <p style={{ ...muted, margin: 0 }}>구장 전체는 5명 이상 표본이 모이지 않았습니다.</p>}
            </div> : <p style={{ ...muted, margin: '8px 0 0' }}>현재 기준을 만족하는 익명 표본이 아직 없습니다.</p>}
          </div>}
          {detail.holes.map((hole) => <article key={hole.holeNumber} style={{ padding: '11px', border: '1px solid #e2e8f0', borderRadius: '9px', background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f172a', fontSize: '12px' }}><strong>{hole.holeNumber}번 홀 · Par {hole.par}</strong><span>{hole.score}타 · 퍼트 {hole.putts}</span></div>
            <ol style={{ margin: '8px 0 0', paddingLeft: '20px', display: 'grid', gap: '5px', color: '#475569', fontSize: '11px' }}>
              {hole.shots.map((shot) => <li key={`${hole.holeNumber}-${shot.shotNumber}`}>{shot.shotNumber}타 · {shot.club} · {shot.shotDistance}m · {shot.ballLie}{shot.penalty ? ` · 벌타 ${shot.penalty}` : ''}</li>)}
              {hole.shots.length === 0 && <li style={{ color: '#94a3b8' }}>저장된 샷 상세가 없습니다.</li>}
            </ol>
          </article>)}
          {detail.holes.length === 0 && <p style={muted}>아직 입력된 홀이 없습니다.</p>}
        </div>
      </section>}
    </main>
  )
}
