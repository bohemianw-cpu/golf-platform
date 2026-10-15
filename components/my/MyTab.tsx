'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BallLie, HoleRecord, ShotRecord } from '@/types/golf'
import { createClient } from '@/utils/supabase/client'
import { GOLF_LEVEL_GROUPS, getGolfLevelGroup, type GolfLevelGroup } from '@/utils/golf/levels'
import { AgreementDetails } from '@/components/auth/AgreementDetails'
import CommercePanel from '@/components/my/CommercePanel'
import { AI_ANALYSIS_CONSENT_VERSION, SHARING_CONSENT_VERSION } from '@/utils/consent'

interface RoundSummary {
  id: string
  created_at: string
  registered_at?: string | null
  status: string
  total_score: number | null
  total_putts: number | null
  club_name: string | null
  golf_club: string | null
  course_name: string | null
  course_id: string | null
  play_mode: 'field' | 'screen' | null
  screen_provider?: string | null
  entry_mode?: 'live' | 'backfill'
  route_ids: string[]
  tee_code: string | null
  tee_name: string | null
  visibility: 'private' | 'friends' | 'aggregate'
}

interface RoundDetail extends RoundSummary {
  holes: HoleRecord[]
}

interface RoundIntegritySummary {
  round_id: string
  status: 'in_progress' | 'self_reported' | 'time_plausible' | 'review_required'
  observed_seconds: number | null
  minimum_seconds: number | null
  reason_codes: string[]
}

interface SampleRoundSession {
  id: string
  created_at: string
  updated_at: string
  payload: Record<string, unknown> | null
}

const integrityLabel = (value?: RoundIntegritySummary) => {
  if (!value) return '시간 확인 자료 없음'
  if (value.status === 'time_plausible') return '소요시간 기준 통과 · 현장 미확인'
  if (value.status === 'review_required') return '기록 확인 필요'
  if (value.status === 'self_reported') return '자가 기록'
  return '기록 진행 중'
}

const integrityReasonNames: Record<string, string> = {
  legacy_without_audit: '기존 기록이라 입력 시간 자료가 없음',
  backfilled: '지난 라운드 입력',
  incomplete_event_evidence: '홀·샷 입력 이력이 완전하지 않음',
  below_minimum_duration: '최저 소요시간보다 짧음',
  rapid_input: '짧은 시간에 많은 샷이 입력됨',
  post_completion_correction: '완료 후 기록 수정',
}

interface ProfileSummary {
  nickname: string | null
  handicap_index: number | null
  skill_group: GolfLevelGroup | null
}

interface UserDataPreferences {
  user_id: string
  allow_anonymous_aggregate: boolean
  allow_friend_sharing: boolean
  allow_ai_practice_analysis: boolean
  score_guide_enabled: boolean
  score_guide_completed_at: string | null
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
  green_code?: string | null
  green_name?: string | null
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

interface AchievementHoleRow {
  round_id: string
  hole_number: number
  par: number
  score: number
  putts: number
  fairway_hit: boolean | null
  gir: boolean
}

interface AchievementShotRow {
  round_id: string
  club: string
  shot_distance: number
  penalty: number
}

interface TrophyItem {
  id: string
  title: string
  description: string
  icon: string
  earned: boolean
  category: string
  evidence: string
}

const GOLF_LEVELS = [
  { rounds: 1, label: '첫 티샷' },
  { rounds: 3, label: '라운드 수집가' },
  { rounds: 5, label: '꾸준한 골퍼' },
  { rounds: 10, label: '코스 탐험가' },
  { rounds: 25, label: '클럽하우스 단골' },
  { rounds: 50, label: '골프 라이프' },
]

function buildTrophies(rounds: RoundSummary[], holes: AchievementHoleRow[], shots: AchievementShotRow[]): TrophyItem[] {
  const eligibleIds = new Set(rounds.map((round) => round.id))
  const eligibleShots = shots.filter((shot) => eligibleIds.has(shot.round_id))
  const byRound = new Map<string, AchievementHoleRow[]>()
  const shotsByRound = new Map<string, AchievementShotRow[]>()
  for (const hole of holes) if (eligibleIds.has(hole.round_id)) byRound.set(hole.round_id, [...(byRound.get(hole.round_id) ?? []), hole])
  for (const shot of eligibleShots) shotsByRound.set(shot.round_id, [...(shotsByRound.get(shot.round_id) ?? []), shot])
  const roundHoles = rounds.map((round) => ({ round, holes: byRound.get(round.id) ?? [], shots: shotsByRound.get(round.id) ?? [] }))
  const allHoles = roundHoles.flatMap(({ holes: items }) => items)
  const birdies = allHoles.filter((hole) => hole.score <= hole.par - 1).length
  const eagles = allHoles.filter((hole) => hole.score <= hole.par - 2).length
  const fairwayHoles = allHoles.filter((hole) => hole.par >= 4 && hole.fairway_hit != null)
  const girHoles = allHoles.filter((hole) => hole.gir != null)
  const bestFairway = fairwayHoles.length ? fairwayHoles.filter((hole) => hole.fairway_hit).length / fairwayHoles.length : 0
  const bestGir = girHoles.length ? girHoles.filter((hole) => hole.gir).length / girHoles.length : 0
  const fullRoundTotals = roundHoles.filter(({ holes: items }) => items.length >= 18).map(({ holes: items }) => ({ score: items.reduce((sum, hole) => sum + hole.score, 0), par: items.reduce((sum, hole) => sum + hole.par, 0) }))
  const firstScore = (score: number) => fullRoundTotals.some((item) => item.score <= score)
  const bestPutts = roundHoles.filter(({ holes: items }) => items.length >= 9).some(({ holes: items }) => items.reduce((sum, hole) => sum + hole.putts, 0) / items.length <= 1.8)
  const driverLong = eligibleShots.some((shot) => /드라이버|driver/i.test(shot.club) && shot.shot_distance >= 250)
  const noPenalty = roundHoles.some(({ shots: items }) => items.length > 0 && items.every((shot) => shot.penalty === 0))
  const parOrBetterNine = roundHoles.some(({ holes: items }) => items.filter((hole) => hole.score <= hole.par).length >= 9)

  return [
    { id: 'first-round', title: '첫 라운드', description: '첫 라운드를 완료했어요.', icon: '⛳', earned: rounds.length >= 1, category: '레벨업', evidence: `${rounds.length} / 1회` },
    { id: 'round-3', title: '라운드 수집가', description: '완료 라운드 3회를 기록했어요.', icon: '🗺️', earned: rounds.length >= 3, category: '레벨업', evidence: `${Math.min(rounds.length, 3)} / 3회` },
    { id: 'round-5', title: '꾸준한 골퍼', description: '완료 라운드 5회를 기록했어요.', icon: '🌱', earned: rounds.length >= 5, category: '레벨업', evidence: `${Math.min(rounds.length, 5)} / 5회` },
    { id: 'round-10', title: '코스 탐험가', description: '완료 라운드 10회를 기록했어요.', icon: '🧭', earned: rounds.length >= 10, category: '레벨업', evidence: `${Math.min(rounds.length, 10)} / 10회` },
    { id: 'round-25', title: '클럽하우스 단골', description: '완료 라운드 25회를 기록했어요.', icon: '🏆', earned: rounds.length >= 25, category: '레벨업', evidence: `${Math.min(rounds.length, 25)} / 25회` },
    { id: 'round-50', title: '골프 라이프', description: '완료 라운드 50회를 기록했어요.', icon: '👑', earned: rounds.length >= 50, category: '레벨업', evidence: `${Math.min(rounds.length, 50)} / 50회` },
    { id: 'first-birdie', title: '첫 버디', description: '홀별 스코어에서 첫 버디 이상을 기록했어요.', icon: '🐦', earned: birdies > 0, category: '스코어', evidence: `${birdies}회` },
    { id: 'first-eagle', title: '이글 헌터', description: '홀별 스코어에서 첫 이글 이상을 기록했어요.', icon: '🦅', earned: eagles > 0, category: '스코어', evidence: `${eagles}회` },
    { id: 'under-100', title: '100타 벽 돌파', description: '100타 이하 스코어를 기록했어요.', icon: '💯', earned: firstScore(100), category: '스코어', evidence: firstScore(100) ? '달성' : '목표 100타 이하' },
    { id: 'under-90', title: '90타 벽 돌파', description: '90타 이하 스코어를 기록했어요.', icon: '🎯', earned: firstScore(90), category: '스코어', evidence: firstScore(90) ? '달성' : '목표 90타 이하' },
    { id: 'single', title: '싱글 입문', description: '79타 이하 스코어를 기록했어요.', icon: '✨', earned: firstScore(79), category: '스코어', evidence: firstScore(79) ? '달성' : '목표 79타 이하' },
    { id: 'par-nine', title: '파 세이브 행진', description: '한 라운드에서 파 또는 버디 이상을 9홀 기록했어요.', icon: '🟢', earned: parOrBetterNine, category: '코스 공략', evidence: parOrBetterNine ? '달성' : '한 라운드 9홀 목표' },
    { id: 'even-par', title: '이븐파 라운드', description: '18홀 합계 기준 이븐파를 기록했어요.', icon: '⚖️', earned: fullRoundTotals.some((item) => item.score === item.par), category: '코스 공략', evidence: fullRoundTotals.some((item) => item.score === item.par) ? '달성' : '18홀 기록 필요' },
    { id: 'under-par', title: '언더파 라운드', description: '18홀 합계 기준 언더파를 기록했어요.', icon: '🔥', earned: fullRoundTotals.some((item) => item.score < item.par), category: '코스 공략', evidence: fullRoundTotals.some((item) => item.score < item.par) ? '달성' : '18홀 기록 필요' },
    { id: 'fairway-70', title: '페어웨이 파인더', description: '기록된 파 4·5 홀에서 페어웨이 안착률 70%를 달성했어요.', icon: '🧭', earned: fairwayHoles.length >= 9 && bestFairway >= 0.7, category: '샷 메이커', evidence: fairwayHoles.length ? `${Math.round(bestFairway * 100)}% · ${fairwayHoles.length}홀` : '페어웨이 기록 대기' },
    { id: 'gir-50', title: '그린 공략가', description: '기록된 홀에서 GIR 50%를 달성했어요.', icon: '🎯', earned: girHoles.length >= 9 && bestGir >= 0.5, category: '샷 메이커', evidence: girHoles.length ? `${Math.round(bestGir * 100)}% · ${girHoles.length}홀` : '그린 적중 기록 대기' },
    { id: 'drive-250', title: '장타 기념', description: '드라이버 샷 250m 이상을 기록했어요.', icon: '🚀', earned: driverLong, category: '샷 메이커', evidence: driverLong ? '달성' : '목표 250m' },
    { id: 'putt-rhythm', title: '퍼트 리듬', description: '9홀 이상 라운드에서 홀당 평균 퍼트 1.8 이하를 기록했어요.', icon: '🏌️', earned: bestPutts, category: '샷 메이커', evidence: bestPutts ? '달성' : '9홀 평균 1.8 이하' },
    { id: 'clean-round', title: '무벌타 기록', description: '저장된 샷 기록에 벌타가 없어요.', icon: '🍀', earned: noPenalty, category: '샷 메이커', evidence: noPenalty ? '달성' : '샷별 벌타 기록 대기' },
  ]
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
    greenCode: row.green_code ?? 'standard',
    greenName: row.green_name ?? '기본 그린',
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
      const exported = []
      for (let from = 0; from < rounds.length; from += 100) {
        const batch = rounds.slice(from, from + 100)
        const ids = batch.map((round) => round.id)
        if (ids.length === 0) continue
        const [{ data: holes, error: holesError }, { data: shots, error: shotsError }, { data: integrity, error: integrityError }] = await Promise.all([
          supabase.from('round_holes').select('*').in('round_id', ids).order('hole_number'),
          supabase.from('round_shots').select('round_id,hole_number,shot_number,club,distance_to_pin_before,distance_to_pin_after,shot_distance,ball_lie,penalty').in('round_id', ids).order('hole_number').order('shot_number'),
          supabase.from('round_integrity').select('*').in('round_id', ids),
        ])
        if (holesError) throw holesError
        if (integrityError) throw integrityError
        const inputEvents: Record<string, unknown>[] = []
        for (let eventFrom = 0; ; eventFrom += 500) {
          const { data: eventPage, error: eventError } = await supabase.from('round_input_events')
            .select('round_id,event_type,hole_number,shot_number,input_method,received_at')
            .in('round_id', ids).order('id').range(eventFrom, eventFrom + 499)
          if (eventError) throw eventError
          inputEvents.push(...(eventPage ?? []))
          if (!eventPage || eventPage.length < 500) break
        }
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
            entryMode: round.entry_mode ?? 'live',
            status: round.status,
            score: round.total_score,
            visibility: round.visibility,
            holes: toHoleRecords(holesByRound.get(round.id) ?? [], shotsByRound.get(round.id) ?? []),
            integrity: (integrity ?? []).find((item) => item.round_id === round.id) ?? null,
            inputEvents: inputEvents.filter((item) => item.round_id === round.id),
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

      <section style={{ ...CARD, borderColor: '#93c5fd', background: '#eff6ff' }} aria-labelledby="sample-round-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div><h2 id="sample-round-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>🧪 샘플 샷 입력</h2><p style={{ ...muted, margin: 0 }}>가상으로 입력해 볼 수 있습니다. 실제 라운드 평균·클럽 분석·배지·트로피에서는 제외됩니다.</p></div>
          <button type="button" onClick={() => void startSample()} disabled={startingSample || !onStartSample} style={{ padding: '10px 14px', border: 0, borderRadius: '8px', background: '#1d4ed8', color: '#fff', fontWeight: 700, cursor: startingSample ? 'wait' : 'pointer' }}>{startingSample ? '준비 중…' : '샘플 입력 시작'}</button>
        </div>
        <div style={{ display: 'grid', gap: '6px', marginTop: '10px' }}>
          {sampleSessions.map((sample) => {
            const payload = sample.payload ?? {}
            const holes = Array.isArray(payload.completedHoles) ? payload.completedHoles as HoleRecord[] : []
            const club = typeof payload.golfClubName === 'string' && payload.golfClubName ? payload.golfClubName : '구장 미선택'
            return <button key={sample.id} type="button" onClick={() => setSelectedSample(sample)} style={{ width: '100%', padding: '10px 12px', textAlign: 'left', border: '1px solid #bfdbfe', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}><strong style={{ color: '#1e3a8a', fontSize: '12px' }}>{club}</strong><span style={{ display: 'block', color: '#64748b', fontSize: '10px', marginTop: 3 }}>{formatDate(sample.updated_at)} · 완료 {holes.length}홀 · 샘플</span></button>
          })}
        </div>
        {selectedSample && <div style={{ marginTop: 10, padding: 12, background: '#fff', border: '1px solid #bfdbfe', borderRadius: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: 12 }}>{String(selectedSample.payload?.golfClubName || '샘플 기록')} · {String(selectedSample.payload?.courseName || '')}</strong><button type="button" onClick={() => setSelectedSample(null)} style={{ border: 0, background: 'transparent', color: '#64748b' }}>닫기</button></div>
          {(Array.isArray(selectedSample.payload?.completedHoles) ? selectedSample.payload?.completedHoles as HoleRecord[] : []).map((hole) => <div key={hole.holeNumber} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', fontSize: 11 }}><strong>{hole.holeNumber}번 홀 · Par {hole.par} · {hole.score}타</strong><div style={{ color: '#64748b', marginTop: 3 }}>{hole.shots.map((shot) => `${shot.shotNumber}타 ${shot.club} ${shot.shotDistance}m (${shot.ballLie})`).join(' · ')}</div></div>)}
          {Array.isArray(selectedSample.payload?.currentShots) && (selectedSample.payload.currentShots as ShotRecord[]).length > 0 && <div style={{ padding: '8px 0', fontSize: 11 }}><strong>진행 중 · {String(selectedSample.payload?.currentHole ?? '')}번 홀</strong><div style={{ color: '#64748b', marginTop: 3 }}>{(selectedSample.payload.currentShots as ShotRecord[]).map((shot) => `${shot.shotNumber}타 ${shot.club} ${shot.shotDistance}m (${shot.ballLie})`).join(' · ')}</div></div>}
          <p style={{ ...muted, margin: '8px 0 0' }}>샘플 기록은 모든 실제 평균과 배지·트로피에서 제외됩니다.</p>
        </div>}
      </section>

      <CommercePanel />

      <section style={CARD} aria-labelledby="sharing-preferences-title">
        <h2 id="sharing-preferences-title" style={{ margin: '0 0 5px', fontSize: 16 }}>공유 및 도움말 설정</h2>
        <p style={{ ...muted, margin: '0 0 12px' }}>가입 때 선택한 항목을 관리합니다. 동의를 끄면 이후 분석에서 제외하거나 기존 라운드를 비공개로 바꿉니다. 가입 시 동의하지 않았더라도 여기서 설정을 바꿀 수 있습니다.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
            <input type="checkbox" checked={dataPreferences?.allow_anonymous_aggregate ?? false} disabled={savingPreferences} onChange={(event) => void updateDataSharingPreference('anonymous_aggregate', event.target.checked)} style={{ marginTop: 2 }} />
            <span><strong>익명 평균 분석 참여</strong><br />개별 라운드에서 익명 평균 참여를 선택한 기록만 구장·실력 그룹 비교에 사용합니다. 5명 이상 표본의 합계 평균만 표시합니다.</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
            <input type="checkbox" checked={dataPreferences?.allow_friend_sharing ?? false} disabled={savingPreferences} onChange={(event) => void updateDataSharingPreference('friend_sharing', event.target.checked)} style={{ marginTop: 2 }} />
            <span><strong>친구 비교 데이터 공유 허용</strong><br />친구로 수락한 회원에게는 내가 개별 라운드를 친구 공개로 지정한 경우에만 스코어·퍼트 평균을 제공합니다. 해제하면 친구 공개 기록을 모두 비공개로 변경합니다.</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
            <input type="checkbox" checked={dataPreferences?.allow_ai_practice_analysis ?? false} disabled={savingPreferences} onChange={(event) => void updateDataSharingPreference('ai_practice_analysis', event.target.checked)} style={{ marginTop: 2 }} />
            <span><strong>AI 연습 제안 분석</strong><br />선택 시 샷 기록 일부를 OpenAI API에 보내 연습 제안을 만듭니다. 해제하면 새 분석 요청을 보내지 않습니다.</span>
          </label>
          <AgreementDetails kind="ai" />
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
            <input type="checkbox" checked={dataPreferences?.score_guide_enabled ?? true} disabled={savingPreferences} onChange={(event) => void updateScoreGuidePreference(event.target.checked)} style={{ marginTop: 2 }} />
            <span><strong>스코어 입력 도움말 아이콘 표시 및 첫 사용 안내</strong><br />켜면 Score 탭 첫 사용 때 안내가 나오고, 입력 화면에서 물음표 아이콘으로 언제든 다시 볼 수 있습니다.</span>
          </label>
        </div>
      </section>

      <section style={CARD} aria-labelledby="account-policy-title">
        <h2 id="account-policy-title" style={{ margin: '0 0 8px', fontSize: 16 }}>약관·개인정보·탈퇴</h2>
        <AgreementDetails kind="terms" />
        <AgreementDetails kind="privacy" />
        <p style={muted}>탈퇴 시 계정·라운드·샷 기록을 삭제합니다. 탈퇴 처리 기록은 6개월 뒤 자동 삭제됩니다.</p>
        <button type="button" disabled={withdrawing} onClick={() => void withdrawAccount()} style={{ border: '1px solid #fecaca', borderRadius: 7, padding: '8px 12px', color: '#b91c1c', background: '#fff' }}>{withdrawing ? '탈퇴 처리 중…' : '회원 탈퇴'}</button>
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

      <section style={{ ...CARD, borderColor: '#a7f3d0', background: 'linear-gradient(180deg,#f0fdf4,#fff 48%)' }} aria-labelledby="trophy-collection-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start', flexWrap: 'wrap' }}>
          <div>
            <h2 id="trophy-collection-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>🏆 레벨 & 트로피 컬렉션</h2>
            <p style={{ ...muted, margin: 0 }}>등록 후 시간 검증을 통과한 라운드만 레벨과 트로피에 반영됩니다. MY에서 언제든 확인할 수 있습니다.</p>
          </div>
          <strong style={{ color: '#047857', fontSize: 12 }}>🏅 {earnedTrophies.length} / {trophies.length} 획득</strong>
        </div>
        <div style={{ marginTop: 14, padding: 14, borderRadius: 12, color: '#fff', background: 'linear-gradient(120deg,#064e3b,#047857)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <div><div style={{ color: '#a7f3d0', fontSize: 11, fontWeight: 700 }}>MY GOLF LEVEL</div><strong style={{ display: 'block', marginTop: 3, fontSize: 20 }}>Lv.{currentLevel} · {currentLevelIndex >= 0 ? GOLF_LEVELS[currentLevelIndex].label : '첫 라운드 전'}</strong></div>
            <div style={{ textAlign: 'right', fontSize: 12 }}>{achievementRounds.length}회 인정</div>
          </div>
          <div role="progressbar" aria-label="다음 레벨 진행도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={levelProgress} style={{ height: 8, marginTop: 11, overflow: 'hidden', borderRadius: 99, background: '#ffffff40' }}><div style={{ height: '100%', width: `${levelProgress}%`, borderRadius: 99, background: '#fde68a', transition: 'width .25s ease' }} /></div>
          <p style={{ margin: '6px 0 0', color: '#d1fae5', fontSize: 11 }}>{nextLevel ? `다음 레벨까지 ${Math.max(0, nextLevel.rounds - achievementRounds.length)}회 · ${nextLevel.label}` : '최고 레벨에 도달했어요. 새로운 기록 트로피에 도전해 보세요!'}</p>
        </div>
        {achievementsError && <p role="status" style={{ ...muted, color: '#b45309', margin: '10px 0 0' }}>{achievementsError} 다시 불러오면 획득 여부가 갱신됩니다.</p>}
        {integrityError && <p role="alert" style={{ ...muted, color: '#b91c1c', margin: '10px 0 0' }}>기록 검증 결과를 불러오지 못해 레벨과 트로피를 잠시 표시할 수 없습니다.</p>}
        {integrityLoading && <p role="status" style={{ ...muted, margin: '10px 0 0' }}>인정되는 라운드를 확인하고 있습니다…</p>}
        {achievementsLoading && <p role="status" style={{ ...muted, margin: '10px 0 0' }}>홀·샷 기록으로 트로피를 확인하고 있습니다…</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,210px),1fr))', gap: 8, marginTop: 12 }}>
          {trophies.map((trophy) => <article key={trophy.id} style={{ minWidth: 0, padding: 10, display: 'flex', gap: 9, alignItems: 'center', border: `1px solid ${trophy.earned ? '#a7f3d0' : '#e2e8f0'}`, borderRadius: 10, background: trophy.earned ? '#f0fdf4' : '#f8fafc', opacity: trophy.earned ? 1 : .82 }}>
            <span aria-hidden="true" style={{ flex: '0 0 34px', width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 10, background: trophy.earned ? '#dcfce7' : '#e2e8f0', fontSize: 19, filter: trophy.earned ? 'none' : 'grayscale(1)' }}>{trophy.earned ? trophy.icon : '🔒'}</span>
            <div style={{ minWidth: 0, flex: 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, alignItems: 'center' }}><strong style={{ color: '#0f172a', fontSize: 12 }}>{trophy.title}</strong><span style={{ color: '#64748b', fontSize: 9, whiteSpace: 'nowrap' }}>{trophy.category}</span></div><p style={{ margin: '3px 0', color: '#475569', fontSize: 10, lineHeight: 1.4 }}>{trophy.description}</p><span style={{ color: trophy.earned ? '#047857' : '#64748b', fontSize: 10, fontWeight: 700 }}>{trophy.earned ? '획득 · ' : '진행 · '}{trophy.evidence}</span></div>
          </article>)}
        </div>
        <p style={{ ...muted, margin: '10px 0 0', fontSize: 10 }}>재미를 위한 개인 기록 배지이며 핸디캡이나 공식 자격에 영향을 주지 않습니다. 9홀 라운드도 기록 가능한 항목에 반영됩니다.</p>
      </section>

      <section style={CARD} aria-labelledby="level-progress-title">
        <h2 id="level-progress-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>⛳ 내 핸디캡 그룹</h2>
        <p style={{ ...muted, margin: '0 0 12px' }}>현재 비교 그룹: {GOLF_LEVEL_GROUPS[currentGroup].label}. 핸디캡 지수를 직접 입력해 비교에 사용할 그룹을 설정할 수 있습니다.</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label htmlFor="my-handicap-index" style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: '#475569', fontWeight: 700 }}>내 핸디캡 지수</label>
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
              <span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', color: '#0f172a', fontSize: '13px' }}>{roundLocation(round)}</strong><span style={{ display: 'block', marginTop: '4px', color: '#64748b', fontSize: '11px', overflowWrap: 'anywhere' }}>{formatDate(round.created_at)} · {round.course_name || '코스 미입력'} · {round.tee_name ? `${round.tee_name} · ` : ''}{round.play_mode === 'field' ? '필드' : round.play_mode === 'screen' ? `스크린${round.screen_provider ? ` · ${round.screen_provider}` : ''}` : '방식 미설정'}</span></span>
              <span style={{ textAlign: 'right', maxWidth: '45%', overflowWrap: 'anywhere' }}><strong style={{ display: 'block', color: round.total_score == null ? '#64748b' : '#047857', fontSize: '17px' }}>{round.total_score == null ? '진행 중' : `${round.total_score}타`}</strong><span style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>{round.registered_at ? '등록 완료 · 수정 불가' : round.status === 'completed' ? integrityLabel(integrityByRound[round.id]) : '기록 이어하기 가능'}</span></span>
            </button>)}
          </div>
        )}
      </section>

      {detailLoading && <p role="status" style={{ ...muted, textAlign: 'center' }}>홀별 샷 상세를 불러오는 중입니다…</p>}
      {detail && <section style={CARD} aria-labelledby="round-detail-title">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'start' }}>
          <div><h2 id="round-detail-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>{roundLocation(detail)} 상세</h2><p style={{ ...muted, margin: 0 }}>{formatDate(detail.created_at)} · {detail.course_name || '코스 미입력'}{detail.tee_name ? ` · ${detail.tee_name}` : ''}{detail.play_mode === 'screen' && detail.screen_provider ? ` · ${detail.screen_provider}` : ''} · 총 {detail.total_score ?? '진행 중'}타</p></div>
          <button type="button" onClick={() => setDetail(null)} aria-label="라운드 상세 닫기" style={{ border: '1px solid #cbd5e1', borderRadius: '7px', padding: '6px 9px', background: '#fff', cursor: 'pointer' }}>닫기</button>
        </div>
        {detail.registered_at && <div role="status" style={{ marginTop: 10, padding: '9px 11px', border: '1px solid #bbf7d0', borderRadius: 8, background: '#f0fdf4', color: '#166534', fontSize: 12, fontWeight: 700 }}>✓ 스코어 등록 완료 · 이 라운드는 읽기 전용이며 샷 수정·취소·삭제 기능을 제공하지 않습니다.</div>}
        {detail.status === 'completed' && <p style={{ ...muted, margin: '10px 0 0' }}>{detail.registered_at ? '스코어 등록 완료 · 샷 데이터 수정 불가. ' : ''}기록 확인: {integrityLabel(integrityByRound[detail.id])}{integrityByRound[detail.id]?.observed_seconds != null && integrityByRound[detail.id]?.minimum_seconds != null ? ` · 서버 관측 ${Math.floor((integrityByRound[detail.id]?.observed_seconds ?? 0) / 60)}분 / 최저선 ${Math.floor((integrityByRound[detail.id]?.minimum_seconds ?? 0) / 60)}분` : ''}{integrityByRound[detail.id]?.reason_codes.length ? ` · ${integrityByRound[detail.id].reason_codes.map((reason) => integrityReasonNames[reason] ?? reason).join(', ')}` : ''}. 시간 기준 통과는 실제 플레이나 현장 방문의 증명이 아닙니다.</p>}
        <div style={{ display: 'grid', gap: '9px', marginTop: '14px' }}>
          {detail.course_id && detail.play_mode && <div style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '9px', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div><strong style={{ fontSize: '12px', color: '#0f172a' }}>익명 구장 평균 비교</strong><p style={{ ...muted, margin: '4px 0 0' }}>내 이름과 샷 상세는 공유하지 않습니다. 같은 핸디캡 그룹과 플레이 방식의 라운드가 5건 이상일 때만 평균을 표시합니다.</p></div>
              {!detail.registered_at && detail.status === 'completed' && (!dataPreferences?.allow_anonymous_aggregate || !dataPreferences.allow_friend_sharing) && <p style={{ ...muted, flexBasis: '100%', margin: 0 }}>아래 라운드 공유 기능을 사용하려면 먼저 위 설정에서 해당 선택 동의를 켜 주세요.</p>}
              {!detail.registered_at && detail.status === 'completed' && <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => void updateVisibility(detail, 'friends')} disabled={sharing || (!dataPreferences?.allow_friend_sharing && detail.visibility !== 'friends')} aria-pressed={detail.visibility === 'friends'} title={dataPreferences?.allow_friend_sharing ? undefined : 'MY의 공유 설정에서 친구 비교 동의를 켜 주세요'} style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '7px', background: detail.visibility === 'friends' ? '#eff6ff' : '#fff', color: '#1d4ed8', fontSize: '11px', fontWeight: 700, cursor: sharing ? 'wait' : 'pointer', opacity: dataPreferences?.allow_friend_sharing || detail.visibility === 'friends' ? 1 : .55 }}>{sharing ? '저장 중…' : detail.visibility === 'friends' ? '친구 공개 중 · 중단' : '친구에게 공개'}</button>
                <button type="button" onClick={() => void updateVisibility(detail, 'aggregate')} disabled={sharing || (!dataPreferences?.allow_anonymous_aggregate && detail.visibility !== 'aggregate')} aria-pressed={detail.visibility === 'aggregate'} title={dataPreferences?.allow_anonymous_aggregate ? undefined : 'MY의 공유 설정에서 익명 평균 동의를 켜 주세요'} style={{ padding: '8px 10px', border: '1px solid #a7f3d0', borderRadius: '7px', background: detail.visibility === 'aggregate' ? '#ecfdf5' : '#fff', color: '#047857', fontSize: '11px', fontWeight: 700, cursor: sharing ? 'wait' : 'pointer', opacity: dataPreferences?.allow_anonymous_aggregate || detail.visibility === 'aggregate' ? 1 : .55 }}>{sharing ? '저장 중…' : detail.visibility === 'aggregate' ? '익명 평균 참여 중 · 중단' : '익명 평균에 참여'}</button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f172a', fontSize: '12px' }}><strong>{hole.holeNumber}번 홀 · Par {hole.par} · {hole.greenName || '기본 그린'}</strong><span>{hole.score}타 · 퍼트 {hole.putts}</span></div>
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
