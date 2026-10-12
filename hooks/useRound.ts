'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { normalizeCourseName } from '@/utils/course-name'
import type { ClubItem, BallLie, ShotRecord, HoleRecord, GolfCourseRoute, GolfCourseTee } from '@/types/golf'
import { INITIAL_HOLE_PARS } from '@/utils/golf/clubs'
import {
  buildClubApproach,
  buildClubStats,
  calcHoleScore,
  calcShotDistance,
  clamp,
  countPutts,
  defaultDistanceForPar,
  getExpectedDistance,
  getPenaltyByLie,
  isFairwayHit,
  isGreenInRegulation,
  recommendClub,
  roundTo10,
  type ClubStatsMap,
} from '@/utils/golf/scoring'
import type { ChooseFn } from '@/components/score/ConfirmDialog'

const DRAFT_KEY = 'golf-score-draft-v1'

// 같은 페이지 세션에서 "이어하기" 확인은 사용자당 한 번만 묻는다.
// (탭 이동 등으로 컴포넌트가 다시 마운트되어도 상태가 유지됨)
let promptedUserId: string | null = null

interface Draft {
  userId: string
  roundId: string | null
  golfClubName: string
  courseName: string
  playMode?: 'field' | 'screen' | null
  courseId?: string | null
  routeIds?: string[]
  teeCode?: string | null
  teeName?: string | null
  routeDistances?: number[]
  greenCodes?: string[]
  greenNames?: string[]
  routeHoles?: GolfCourseRoute['holes']
  holePars: number[]
  currentHole: number
  holeDistance: number
  currentShots: ShotRecord[]
  completedHoles: HoleRecord[]
}

// 웨지가 추천(그린 온 예상)될 때 샷 후 남은 거리의 기본값 (m)
const WEDGE_GREEN_REMAINING = 5

function readDraft(userId: string): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    const d = raw ? (JSON.parse(raw) as Draft) : null
    return d && d.userId === userId && (d.completedHoles?.length > 0 || d.currentShots?.length > 0) ? d : null
  } catch {
    return null
  }
}

interface RoundRow {
  id: string
  club_name?: string | null
  golf_club?: string | null
  course_name?: string | null
  play_mode?: 'field' | 'screen' | null
  course_id?: string | null
  route_ids?: string[]
  tee_code?: string | null
  tee_name?: string | null
}

interface HoleRow {
  hole_number: number
  par: number
  score: number
  putts: number
  fairway_hit: boolean | null
  gir: boolean
  shots?: ShotRecord[] | null
  total_distance?: number | null
  green_code?: string | null
  green_name?: string | null
}

interface RoundShotRow {
  hole_number: number
  shot_number: number
  club: string
  distance_to_pin_before: number
  distance_to_pin_after: number
  shot_distance: number
  ball_lie: BallLie
  penalty: number
}

interface Dialogs {
  choose: ChooseFn
  confirm: (message: string, okLabel?: string, tone?: 'primary' | 'danger') => Promise<boolean>
}

const sumBy = (holes: HoleRecord[], key: 'score' | 'putts') => holes.reduce((a, h) => a + h[key], 0)

export function useRound(clubs: ClubItem[], { choose, confirm }: Dialogs) {
  // createClient()를 렌더마다 호출하지 않도록 고정
  const supabase = useMemo(() => createClient(), [])

  // ---------- 상태 ----------
  const [golfClubName, setGolfClubName] = useState('')
  const [courseName, setCourseName] = useState('OUT/IN')
  const [playMode, setPlayMode] = useState<'field' | 'screen' | null>(null)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [routeIds, setRouteIds] = useState<string[]>([])
  const [teeCode, setTeeCode] = useState<string | null>(null)
  const [teeName, setTeeName] = useState<string | null>(null)
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const [currentHole, setCurrentHole] = useState(1)
  const [holePars, setHolePars] = useState<number[]>(INITIAL_HOLE_PARS)
  const [routeDistances, setRouteDistances] = useState<number[]>([])
  const [routeHoles, setRouteHoles] = useState<GolfCourseRoute['holes']>([])
  const [greenCodes, setGreenCodes] = useState<string[]>([])
  const [greenNames, setGreenNames] = useState<string[]>([])
  const [holeDistance, setHoleDistance] = useState(360)
  const [currentShots, setCurrentShots] = useState<ShotRecord[]>([])
  const [completedHoles, setCompletedHoles] = useState<HoleRecord[]>([])

  const [selectedClubValue, setSelectedClub] = useState('')
  const [selectedLie, setSelectedLie] = useState<BallLie>('페어웨이')
  const [remainingDistance, setRemainingDistance] = useState(150)
  const [isPinOver, setIsPinOver] = useState(false)

  const [isRoundComplete, setIsRoundComplete] = useState(false)
  const [showRoundReport, setShowRoundReport] = useState(false)

  // ---------- refs ----------
  const roundIdRef = useRef<string | null>(null)
  const roundPromiseRef = useRef<Promise<string> | null>(null)
  const savingCountRef = useRef(0)
  const shotSyncQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const initRef = useRef(false)
  const userIdRef = useRef<string | null>(null)
  const metaRef = useRef({ club: '', course: '', playMode: null as 'field' | 'screen' | null, courseId: null as string | null, routeIds: [] as string[], teeCode: null as string | null, teeName: null as string | null })
  useEffect(() => {
    metaRef.current = { club: golfClubName, course: courseName, playMode, courseId, routeIds, teeCode, teeName }
  }, [golfClubName, courseName, playMode, courseId, routeIds, teeCode, teeName])

  const setRoundId = useCallback((id: string | null) => {
    roundIdRef.current = id
    setCurrentRoundId(id)
  }, [])

  // ---------- 클럽 파생값 (이름이 아닌 category 기준) ----------
  const teeClubName = useMemo(
    () => (clubs.find((c) => c.category === 'driver') ?? clubs.find((c) => c.category !== 'putter'))?.name ?? '',
    [clubs]
  )
  const putterName = useMemo(() => clubs.find((c) => c.category === 'putter')?.name ?? null, [clubs])
  const isPutter = useCallback(
    (name: string) => name === '퍼터' || clubs.find((c) => c.name === name)?.category === 'putter',
    [clubs]
  )

  const isWedge = useCallback(
    (name: string) => clubs.find((c) => c.name === name)?.category === 'wedge',
    [clubs]
  )

  const isDriver = useCallback(
    (name: string) => clubs.find((c) => c.name === name)?.category === 'driver',
    [clubs]
  )

  // Removed clubs fall back to the current tee club without effect-driven state updates.
  const selectedClub = clubs.some((club) => club.name === selectedClubValue)
    ? selectedClubValue
    : teeClubName

  // ---------- 통계 ----------
  const allShots = useMemo(
    () => [...completedHoles.flatMap((h) => h.shots), ...currentShots],
    [completedHoles, currentShots]
  )
  const clubStats = useMemo(() => buildClubStats(allShots, isPutter), [allShots, isPutter])
  // 클럽 분석 표 표시용: 퍼터 포함
  const clubStatsAll = useMemo(() => buildClubStats(allShots, () => false), [allShots])
  const expectedDistance = useCallback(
    (name: string) => getExpectedDistance(name, clubs, clubStats),
    [clubs, clubStats]
  )

  const clubApproach = useMemo(
    () => buildClubApproach(allShots, expectedDistance, isPutter),
    [allShots, expectedDistance, isPutter]
  )

  const currentPar = holePars[currentHole - 1] || 4
  const currentPrevDistance =
    currentShots.length === 0 ? holeDistance : currentShots[currentShots.length - 1].distanceToPinAfter
  const isPutterOrGreen = selectedLie === '그린' || isPutter(selectedClub)
  const calculatedShotDistance = calcShotDistance(currentPrevDistance, remainingDistance, isPinOver)

  const recommendedClub = useMemo(() => {
    const lastShot = currentShots[currentShots.length - 1]
    const onGreen = lastShot?.ballLie === '그린'
    if ((onGreen || currentPrevDistance <= 15) && putterName) return putterName
    // 드라이버로 친 직후에는 거리가 멀어도 드라이버 다음 채를 추천 (OB 원위치 재타는 제외)
    const afterDriver = !!lastShot && isDriver(lastShot.club) && lastShot.ballLie !== 'OB'
    return (
      recommendClub(
        currentPrevDistance,
        clubs,
        clubStats,
        afterDriver ? (c) => c.category === 'driver' : undefined
      ) ?? teeClubName
    )
  }, [currentShots, currentPrevDistance, putterName, clubs, clubStats, teeClubName, isDriver])

  // 직전에 저장한 샷이 그린에 올랐는지 (퍼트 빠른 입력 노출 조건)
  const isOnGreen = currentShots[currentShots.length - 1]?.ballLie === '그린'

  const recommendedLie: BallLie | null = isWedge(selectedClub) ? '그린' : null

  const summary = useMemo(() => {
    const par = completedHoles.reduce((a, h) => a + h.par, 0)
    const score = sumBy(completedHoles, 'score')
    const fwEligible = completedHoles.filter((h) => h.fairwayHit !== null).length
    const fwHit = completedHoles.filter((h) => h.fairwayHit === true).length
    const girCount = completedHoles.filter((h) => h.gir).length
    return {
      totalDiff: score - par,
      fwEligible,
      fwHit,
      girCount,
      fwPercent: fwEligible > 0 ? Math.round((fwHit / fwEligible) * 100) : 0,
      girPercent: completedHoles.length > 0 ? Math.round((girCount / completedHoles.length) * 100) : 0,
    }
  }, [completedHoles])

  const currentHoleScore = calcHoleScore(currentShots)

  // ---------- 입력 초기화 헬퍼 ----------
  const prepareHole = useCallback(
    (holeNum: number, pars: number[], doneHoles: HoleRecord[], distances = routeDistances) => {
      const par = pars[holeNum - 1] ?? 4
      const dist = distances[holeNum - 1] ?? defaultDistanceForPar(par)
      const stats = buildClubStats(doneHoles.flatMap((h) => h.shots), isPutter)
      const club = par <= 3 ? recommendClub(dist, clubs, stats) ?? teeClubName : teeClubName
      setCurrentHole(holeNum)
      setCurrentShots([])
      setHoleDistance(dist)
      const greenLie = isWedge(club)
      setSelectedClub(club)
      setSelectedLie(greenLie ? '그린' : '페어웨이')
      setIsPinOver(false)
      setRemainingDistance(
        greenLie ? Math.min(WEDGE_GREEN_REMAINING, dist) : roundTo10(dist - getExpectedDistance(club, clubs, stats))
      )
    },
    [clubs, isPutter, isWedge, teeClubName, routeDistances]
  )

  const setNextInputs = useCallback(
    (prevDist: number, lie: BallLie, stats: ClubStatsMap, lastClub?: string) => {
      setIsPinOver(false)
      if (lie === '그린' && putterName) {
        setSelectedClub(putterName)
        setSelectedLie('그린')
        setRemainingDistance(Math.max(0, Math.round(prevDist - getExpectedDistance(putterName, clubs, stats))))
        return
      }
      const afterDriver = !!lastClub && isDriver(lastClub) && lie !== 'OB'
      const rec =
        recommendClub(prevDist, clubs, stats, afterDriver ? (c) => c.category === 'driver' : undefined) ??
        teeClubName
      const greenLie = isWedge(rec)
      setSelectedClub(rec)
      setSelectedLie(greenLie ? '그린' : '페어웨이')
      setRemainingDistance(
        greenLie ? Math.min(WEDGE_GREEN_REMAINING, prevDist) : roundTo10(prevDist - getExpectedDistance(rec, clubs, stats))
      )
    },
    [clubs, putterName, isWedge, isDriver, teeClubName]
  )

  // ---------- 로컬 백업 ----------
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {}
  }, [])

  useEffect(() => {
    const uid = userIdRef.current
    if (!ready || !uid || isRoundComplete) return // 완료된 라운드의 백업은 서버 확정 후에만 삭제
    const hasData = completedHoles.length > 0 || currentShots.length > 0 || !!roundIdRef.current
    try {
      if (!hasData) {
        localStorage.removeItem(DRAFT_KEY)
        return
      }
      const draft: Draft = {
        userId: uid,
        roundId: currentRoundId,
        golfClubName,
        courseName,
        playMode,
        courseId,
        routeIds,
        teeCode,
        teeName,
        routeDistances,
        greenCodes,
        greenNames,
        routeHoles,
        holePars,
        currentHole,
        holeDistance,
        currentShots,
        completedHoles,
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {}
  }, [ready, isRoundComplete, currentRoundId, golfClubName, courseName, playMode, courseId, routeIds, teeCode, teeName, routeDistances, greenCodes, greenNames, routeHoles, holePars, currentHole, holeDistance, currentShots, completedHoles])

  // ---------- Supabase ----------
  const track = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    savingCountRef.current += 1
    setIsSaving(true)
    try {
      return await fn()
    } finally {
      savingCountRef.current -= 1
      if (savingCountRef.current === 0) setIsSaving(false)
    }
  }, [])

  const ensureRoundId = useCallback(
    async (userId: string): Promise<string> => {
      if (roundIdRef.current) return roundIdRef.current
      if (!roundPromiseRef.current) {
        roundPromiseRef.current = (async () => {
          const name = normalizeCourseName(metaRef.current.club.trim()) || '골프장 미지정'
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
              course_name: normalizeCourseName(metaRef.current.course),
              play_mode: metaRef.current.playMode,
              course_id: metaRef.current.courseId,
              route_ids: metaRef.current.routeIds,
              tee_code: metaRef.current.teeCode,
              tee_name: metaRef.current.teeName,
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
    [supabase, setRoundId]
  )

  /** 완료된 홀 전체를 한 번에 upsert → 앞서 실패한 홀도 함께 복구됨 */
  const syncHoles = useCallback(
    async (all: HoleRecord[]): Promise<boolean> => {
      setSaveError(null)
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
                shots: h.shots,
                total_distance: h.totalDistance,
                green_code: h.greenCode || 'standard',
                green_name: h.greenName || '기본 그린',
              })),
              { onConflict: 'round_id,hole_number' }
            )
            if (error) throw error
          }

          const name = normalizeCourseName(metaRef.current.club.trim()) || '골프장 미지정'
          const { error: updateError } = await supabase
            .from('rounds')
            .update({
              club_name: name,
              golf_club: name,
              course_name: normalizeCourseName(metaRef.current.course),
              play_mode: metaRef.current.playMode,
              course_id: metaRef.current.courseId,
              route_ids: metaRef.current.routeIds,
              tee_code: metaRef.current.teeCode,
              tee_name: metaRef.current.teeName,
              total_score: sumBy(all, 'score'),
              total_putts: sumBy(all, 'putts'),
              updated_at: new Date().toISOString(),
            })
            .eq('id', roundId)
          if (updateError) throw updateError
        })
        return true
      } catch (err) {
        console.error('홀 저장 에러:', err)
        setSaveError('서버 저장에 실패했습니다. 기록은 이 기기에 보관되어 있습니다.')
        return false
      }
    },
    [supabase, track, ensureRoundId]
  )

  /** 진행 중인 홀도 샷 단위로 서버에 저장해 기기 간 이어하기를 지원한다. */
  const syncShotEvents = useCallback(
    (holeNumber: number, shots: ShotRecord[]): Promise<boolean> => {
      const pending = shotSyncQueueRef.current.then(async () => {
        setSaveError(null)
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
          return true
        } catch (err) {
          console.error('샷 동기화 에러:', err)
          setSaveError('샷 서버 저장에 실패했습니다. 이 기기의 임시 기록은 유지됩니다.')
          return false
        }
      })
      shotSyncQueueRef.current = pending
      return pending
    },
    [supabase, track, ensureRoundId]
  )

  const finalizeRound = useCallback(
    async (finalHoles: HoleRecord[]): Promise<boolean> => {
      try {
        await track(async () => {
          const id = roundIdRef.current
          if (!id) throw new Error('round id 없음')
          const { error } = await supabase
            .from('rounds')
            .update({
              status: 'completed',
              total_score: sumBy(finalHoles, 'score'),
              total_putts: sumBy(finalHoles, 'putts'),
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)
          if (error) throw error
        })
        clearDraft()
        return true
      } catch (err) {
        console.error('라운드 완료 저장 에러:', err)
        setSaveError('라운드 완료 처리에 실패했습니다. 다시 시도해 주세요.')
        return false
      }
    },
    [supabase, track, clearDraft]
  )

  const syncAndMaybeFinalize = useCallback(
    async (holes: HoleRecord[], finalize: boolean) => {
      const ok = await syncHoles(holes)
      if (ok && finalize) await finalizeRound(holes)
    },
    [syncHoles, finalizeRound]
  )

  const retrySync = useCallback(
    async () => {
      const shotsToRetry = [
        ...completedHoles.map((hole) => [hole.holeNumber, hole.shots] as const),
        [currentHole, currentShots] as const,
      ]
      for (const [holeNumber, shots] of shotsToRetry) {
        if (!(await syncShotEvents(holeNumber, shots))) return
      }
      await syncAndMaybeFinalize(completedHoles, isRoundComplete)
    },
    [syncShotEvents, syncAndMaybeFinalize, completedHoles, currentHole, currentShots, isRoundComplete]
  )

  // ---------- 초기 복구 (최초 1회) ----------
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const applyDraft = (d: Draft) => {
      setRoundId(d.roundId)
      setGolfClubName(d.golfClubName)
      setCourseName(d.courseName)
      setPlayMode(d.playMode ?? null)
      setCourseId(d.courseId ?? null)
      setRouteIds(d.routeIds ?? [])
      setTeeCode(d.teeCode ?? null)
      setTeeName(d.teeName ?? null)
      setRouteDistances(d.routeDistances ?? [])
      setGreenCodes(d.greenCodes ?? [])
      setGreenNames(d.greenNames ?? [])
      setRouteHoles(d.routeHoles ?? [])
      setHolePars(d.holePars)
      setCompletedHoles(d.completedHoles)
      setCurrentHole(d.currentHole)
      setHoleDistance(d.holeDistance)
      setCurrentShots(d.currentShots)

      const stats = buildClubStats(
        [...d.completedHoles.flatMap((h) => h.shots), ...d.currentShots],
        isPutter
      )
      const last = d.currentShots[d.currentShots.length - 1]
      if (last) {
        setNextInputs(last.distanceToPinAfter, last.ballLie, stats, last.club)
      } else {
        prepareHole(d.currentHole, d.holePars, d.completedHoles, d.routeDistances ?? [])
        setHoleDistance(d.holeDistance)
      }
      const targetHoleCount = d.routeDistances?.length === 9 ? 9 : 18
      if (d.completedHoles.length >= targetHoleCount) {
        setIsRoundComplete(true)
        void syncAndMaybeFinalize(d.completedHoles, true)
      } else if (d.completedHoles.length > 0) {
        void syncHoles(d.completedHoles)
      }
    }

    const resumeFromDb = async (round: RoundRow) => {
      const [{ data: holes, error }, { data: shotRows, error: shotsError }] = await Promise.all([
        supabase
        .from('round_holes')
        .select('*')
        .eq('round_id', round.id)
        .order('hole_number', { ascending: true }),
        supabase
          .from('round_shots')
          .select('*')
          .eq('round_id', round.id)
          .order('hole_number', { ascending: true })
          .order('shot_number', { ascending: true }),
      ])
      if (error) throw error
      if (shotsError) throw shotsError

      let routeRows: GolfCourseRoute[] = []
      if (round.route_ids?.length) {
        const { data, error: routeError } = await supabase
          .from('golf_course_routes')
          .select('id,course_id,route_code,display_name,hole_count,pars,distances_m')
          .in('id', round.route_ids)
        if (routeError) throw routeError
        const routeMap = new Map(((data ?? []) as GolfCourseRoute[]).map((route) => [route.id, route]))
        routeRows = round.route_ids.flatMap((id) => routeMap.get(id) ? [routeMap.get(id)!] : [])
        const { data: holeData, error: courseHolesError } = await supabase
          .from('golf_course_holes')
          .select('id,route_id,hole_number,par,handicap_index')
          .in('route_id', round.route_ids)
          .order('hole_number')
        if (courseHolesError) throw courseHolesError
        const courseHoles = (holeData ?? []) as { id: string; route_id: string; hole_number: number; par: number; handicap_index: number | null }[]
        const { data: teeData, error: courseTeesError } = courseHoles.length
          ? await supabase.from('golf_course_hole_tees')
            .select('hole_id,tee_code,display_name,tee_color,distance_m,distance_m_source,source_distance,source_unit,green_code,green_name')
            .in('hole_id', courseHoles.map((hole) => hole.id))
          : { data: [], error: null }
        if (courseTeesError) throw courseTeesError
        const teesByHole = new Map<string, GolfCourseTee[]>()
        for (const tee of teeData ?? []) {
          const row = tee as GolfCourseTee & { hole_id: string }
          teesByHole.set(row.hole_id, [...(teesByHole.get(row.hole_id) ?? []), {
            tee_code: row.tee_code, display_name: row.display_name, tee_color: row.tee_color, distance_m: row.distance_m,
            distance_m_source: row.distance_m_source, source_distance: row.source_distance, source_unit: row.source_unit,
            green_code: row.green_code ?? 'standard', green_name: row.green_name ?? '기본 그린',
          }])
        }
        routeRows = routeRows.map((route) => ({
          ...route,
          holes: courseHoles.filter((hole) => hole.route_id === route.id).map((hole) => ({ ...hole, tees: teesByHole.get(hole.id) ?? [] })),
        }))
        routeRows = (round.route_ids ?? []).map((routeId) => routeRows.find((route) => route.id === routeId)).filter((route): route is GolfCourseRoute => !!route)
      }
      const routePars = routeRows.flatMap((route) => route.holes?.length === route.hole_count ? route.holes.map((hole) => hole.par) : route.pars)
      const savedTeeAvailableOnAllHoles = !!round.tee_code && routeRows.length > 0 && routeRows.every((route) =>
        route.holes?.length === route.hole_count && route.holes.every((hole) => hole.tees.some((tee) => tee.tee_code === round.tee_code)),
      )
      const teeVariants = savedTeeAvailableOnAllHoles
        ? routeRows.flatMap((route) => route.holes!.map((hole) => hole.tees.filter((tee) => tee.tee_code === round.tee_code)))
        : []
      const persistedHoles = (holes ?? []) as HoleRow[]
      const restoredGreenCodes = teeVariants.map((variants, index) => {
        const oldRecord = persistedHoles.find((hole) => hole.hole_number === index + 1)
        const savedCode = oldRecord && 'green_code' in oldRecord ? oldRecord.green_code : null
        return variants.find((tee) => tee.green_code === savedCode)?.green_code ?? variants.find((tee) => tee.green_code === 'standard')?.green_code ?? variants[0]?.green_code ?? 'standard'
      })
      const restoredGreenNames = teeVariants.map((variants, index) => variants.find((tee) => tee.green_code === restoredGreenCodes[index])?.green_name ?? '기본 그린')
      const routeDistancesForRound = savedTeeAvailableOnAllHoles
        ? teeVariants.map((variants, index) => variants.find((tee) => tee.green_code === restoredGreenCodes[index])?.distance_m ?? variants[0]?.distance_m ?? 0)
        : routeRows.flatMap((route) => route.distances_m)
      const hasFullRouteLayout = [9, 18].includes(routePars.length) && routeDistancesForRound.length === routePars.length &&
        routeDistancesForRound.every((distance) => distance > 0 && distance <= 800)
      const pars = hasFullRouteLayout ? [...routePars] : [...INITIAL_HOLE_PARS]
      const eventsByHole = new Map<number, ShotRecord[]>()
      for (const row of (shotRows ?? []) as RoundShotRow[]) {
        const holeNumber = row.hole_number
        const shot: ShotRecord = {
          shotNumber: row.shot_number,
          club: row.club,
          distanceToPinBefore: row.distance_to_pin_before,
          distanceToPinAfter: row.distance_to_pin_after,
          shotDistance: row.shot_distance,
          ballLie: row.ball_lie,
          penalty: row.penalty,
        }
        eventsByHole.set(holeNumber, [...(eventsByHole.get(holeNumber) ?? []), shot])
      }
      const restored: HoleRecord[] = ((holes ?? []) as HoleRow[]).map((h) => {
        pars[h.hole_number - 1] = h.par
        return {
          holeNumber: h.hole_number,
          greenCode: h.green_code ?? 'standard',
          greenName: h.green_name ?? '기본 그린',
          par: h.par,
          totalDistance: h.total_distance ?? defaultDistanceForPar(h.par),
          shots: eventsByHole.get(h.hole_number) ?? (Array.isArray(h.shots) ? h.shots : []),
          score: h.score,
          scoreDiff: h.score - h.par,
          putts: h.putts,
          fairwayHit: h.fairway_hit,
          gir: h.gir,
        }
      })

      setRoundId(round.id)
      setGolfClubName(round.club_name || round.golf_club || '')
      setCourseName(round.course_name || 'OUT/IN')
      setPlayMode(round.play_mode === 'field' || round.play_mode === 'screen' ? round.play_mode : null)
      setCourseId(round.course_id ?? null)
      setRouteIds(round.route_ids ?? [])
      setTeeCode(round.tee_code ?? null)
      setTeeName(round.tee_name ?? null)
      setHolePars(pars)
      setRouteDistances(hasFullRouteLayout ? routeDistancesForRound : [])
      setGreenCodes(restoredGreenCodes)
      setGreenNames(restoredGreenNames)
      setRouteHoles(routeRows.flatMap((route) => route.holes ?? []))
      setCompletedHoles(restored)
      const targetHoleCount = hasFullRouteLayout ? routePars.length : 18
      const next = restored.length ? Math.min(targetHoleCount, Math.max(...restored.map((h) => h.holeNumber)) + 1) : 1
      prepareHole(next, pars, restored, hasFullRouteLayout ? routeDistancesForRound : [])
      const partialShots = eventsByHole.get(next) ?? []
      if (partialShots.length > 0) {
        setCurrentShots(partialShots)
        const last = partialShots[partialShots.length - 1]
        setHoleDistance((hasFullRouteLayout ? routeDistancesForRound[next - 1] : undefined) ?? defaultDistanceForPar(pars[next - 1] ?? 4))
        setNextInputs(last.distanceToPinAfter, last.ballLie, buildClubStats([...restored.flatMap((h) => h.shots), ...partialShots], isPutter), last.club)
      }
      if (restored.length >= targetHoleCount) {
        setIsRoundComplete(true)
        void syncAndMaybeFinalize(restored, true)
      }
    }

    ;(async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.user) return
        const userId = session.user.id
        userIdRef.current = userId
        const draft = readDraft(userId)

        // 이미 이 페이지 세션에서 확인을 마친 경우(탭 이동 등으로 재마운트):
        // 다시 묻지 않고, 로컬 백업이 있으면 조용히 복구한다.
        if (promptedUserId === userId) {
          if (draft) applyDraft(draft)
          return
        }
        promptedUserId = userId

        // 1) 로컬 백업 (아직 서버에 못 올린 샷까지 포함)
        if (draft) {
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
          .eq('user_id', session.user.id)
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
          const { error: delError } = await supabase.from('rounds').delete().eq('id', round.id)
          if (delError) throw delError
        }
      } catch (err) {
        console.error('진행 중 라운드 확인 실패:', err)
        setSaveError('이전 라운드를 불러오지 못했습니다.')
      } finally {
        setReady(true)
      }
    })()
    // 최초 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- 입력 핸들러 ----------
  const handleClubSelect = (clubName: string) => {
    setSelectedClub(clubName)
    let lie = selectedLie
    if ((lie === '페어웨이' || lie === '그린') && !isPutter(clubName)) {
      lie = isWedge(clubName) ? '그린' : '페어웨이'
      setSelectedLie(lie)
    }
    // 웨지로 그린 온을 노리는 경우: 평균 비거리를 빼지 않고 5m 남는 것으로 표시
    if (isWedge(clubName) && lie === '그린') {
      setRemainingDistance(Math.min(WEDGE_GREEN_REMAINING, currentPrevDistance))
      return
    }
    const diff = currentPrevDistance - expectedDistance(clubName)
    setRemainingDistance(isPutter(clubName) || lie === '그린' ? Math.max(0, Math.round(diff)) : roundTo10(diff))
  }

  const changeHolePar = (holeIndex: number, newPar: number) =>
    setHolePars((prev) => prev.map((p, i) => (i === holeIndex ? newPar : p)))

  const configureCourseRoutes = useCallback((routes: GolfCourseRoute[], selectedTeeCode: string | null, selectedTeeName: string | null) => {
    if (currentRoundId || completedHoles.length > 0 || currentShots.length > 0) return false
    setRouteIds(routes.map((route) => route.id))
    setCourseName(routes.map((route) => route.display_name).join(' → '))
    setTeeCode(selectedTeeCode)
    setTeeName(selectedTeeName)
    const pars = routes.flatMap((route) => route.holes?.length === route.hole_count ? route.holes.map((hole) => hole.par) : route.pars)
    const variantsByHole = selectedTeeCode ? routes.flatMap((route) => route.holes?.length === route.hole_count
      ? route.holes.map((hole) => hole.tees.filter((tee) => tee.tee_code === selectedTeeCode))
      : []) : []
    const selectedGreens = variantsByHole.map((variants) => variants.find((tee) => tee.green_code === 'standard') ?? variants[0])
    const greenCodesForRoutes = selectedGreens.map((tee) => tee?.green_code ?? 'standard')
    const greenNamesForRoutes = selectedGreens.map((tee) => tee?.green_name ?? '기본 그린')
    const distances = selectedGreens.map((tee) => tee?.distance_m ?? 0)
    const validCourseLayout = [9, 18].includes(pars.length) && distances.length === pars.length &&
      pars.every((par) => par >= 3 && par <= 6) && distances.every((distance) => distance > 0 && distance <= 800)
    setRouteHoles(routes.flatMap((route) => route.holes ?? []))
    if (!validCourseLayout) {
      const hasValidPars = [9, 18].includes(pars.length) && pars.every((par) => par >= 3 && par <= 6)
      setHolePars(hasValidPars ? pars : INITIAL_HOLE_PARS)
      setRouteDistances([])
      setGreenCodes([])
      setGreenNames([])
      prepareHole(1, hasValidPars ? pars : INITIAL_HOLE_PARS, [], [])
      return false
    }
    const configuredPars = routes.flatMap((route) => route.holes?.length === route.hole_count
      ? route.holes.map((hole) => {
        const variants = hole.tees.filter((tee) => tee.tee_code === selectedTeeCode)
        const selected = variants.find((tee) => tee.green_code === 'standard') ?? variants[0]
        return selected?.par ?? hole.par
      })
      : route.pars)
    setHolePars(configuredPars)
    setRouteDistances(distances)
    setGreenCodes(greenCodesForRoutes)
    setGreenNames(greenNamesForRoutes)
    prepareHole(1, configuredPars, [], distances)
    return true
  }, [currentRoundId, completedHoles.length, currentShots.length, prepareHole])

  const currentGreenOptions = useMemo(() => {
    const hole = routeHoles?.[currentHole - 1]
    return hole?.tees.filter((tee) => tee.tee_code === teeCode) ?? []
  }, [routeHoles, currentHole, teeCode])

  const changeGreen = useCallback((greenCode: string, greenName: string, distance: number, par?: number | null) => {
    if (currentShots.length > 0 || completedHoles.some((hole) => hole.holeNumber === currentHole)) return
    setGreenCodes((previous) => previous.map((value, index) => index === currentHole - 1 ? greenCode : value))
    setGreenNames((previous) => previous.map((value, index) => index === currentHole - 1 ? greenName : value))
    const basePar = routeHoles?.[currentHole - 1]?.par
    setHolePars((previous) => previous.map((value, index) => index === currentHole - 1 ? (par ?? basePar ?? value) : value))
    const safeDistance = clamp(Math.round(distance), 0, 800)
    setRouteDistances((previous) => previous.map((value, index) => index === currentHole - 1 ? safeDistance : value))
    setHoleDistance(safeDistance)
    setRemainingDistance(roundTo10(safeDistance - expectedDistance(selectedClub)))
  }, [currentShots.length, completedHoles, currentHole, expectedDistance, selectedClub, routeHoles])

  const changeHoleDistance = (raw: number) => {
    const val = clamp(Math.round(raw), 0, 800)
    setHoleDistance(val)
    if (currentShots.length === 0) setRemainingDistance(roundTo10(val - expectedDistance(selectedClub)))
  }

  const changeRemaining = (v: number) => setRemainingDistance(clamp(Math.round(v), 0, 800))

  const completeHole = (shots: ShotRecord[]) => {
    void syncShotEvents(currentHole, shots)
    const finalScore = calcHoleScore(shots)
    const record: HoleRecord = {
      holeNumber: currentHole,
      greenCode: greenCodes[currentHole - 1] ?? 'standard',
      greenName: greenNames[currentHole - 1] ?? '기본 그린',
      par: currentPar,
      totalDistance: holeDistance,
      shots,
      score: finalScore,
      scoreDiff: finalScore - currentPar,
      putts: countPutts(shots, isPutter),
      fairwayHit: isFairwayHit(shots, currentPar),
      gir: isGreenInRegulation(shots, currentPar),
    }

    const updated = [...completedHoles.filter((h) => h.holeNumber !== currentHole), record].sort(
      (a, b) => a.holeNumber - b.holeNumber
    )
    setCompletedHoles(updated)

    const targetHoleCount = [9, 18].includes(routeDistances.length) ? routeDistances.length : 18
    if (currentHole < targetHoleCount) {
      prepareHole(currentHole + 1, holePars, updated)
      void syncHoles(updated)
    } else {
      setCurrentShots([])
      setIsRoundComplete(true)
      setShowRoundReport(true)
      void syncAndMaybeFinalize(updated, true)
    }
  }

  /**
   * 퍼트 N번을 한 번에 입력하고 홀아웃 처리.
   * 중간 퍼트의 남은 거리는 처음 거리를 N등분한 추정값입니다.
   */
  const quickPutt = (count: number) => {
    if (!putterName || !isOnGreen || count < 1) return
    const base = currentPrevDistance
    const putts: ShotRecord[] = []
    let before = base
    for (let i = 1; i <= count; i++) {
      const last = i === count
      const after = last ? 0 : Math.max(1, Math.round((base * (count - i)) / count))
      putts.push({
        shotNumber: currentShots.length + i,
        club: putterName,
        distanceToPinBefore: before,
        distanceToPinAfter: after,
        shotDistance: Math.max(0, before - after),
        ballLie: last ? '홀아웃' : '그린',
        penalty: 0,
      })
      before = after
    }
    completeHole([...currentShots, ...putts])
  }

  const saveShot = (isHoleOut = false) => {
    if (!selectedClub) return
    const prevShot = currentShots[currentShots.length - 1]
    const finalLie: BallLie = isHoleOut ? '홀아웃' : selectedLie
    // 그린 위 홀아웃은 퍼터로 기록 (퍼트 수 정확도)
    const club = isHoleOut && prevShot?.ballLie === '그린' && putterName ? putterName : selectedClub
    const isOb = finalLie === 'OB' // 원위치 재타: 거리 유지, 비거리 통계 제외
    const finalRemaining = isHoleOut ? 0 : isOb ? currentPrevDistance : remainingDistance

    const newShot: ShotRecord = {
      shotNumber: currentShots.length + 1,
      club,
      distanceToPinBefore: currentPrevDistance,
      distanceToPinAfter: finalRemaining,
      shotDistance: isOb ? 0 : calcShotDistance(currentPrevDistance, finalRemaining, isPinOver && !isHoleOut),
      ballLie: finalLie,
      penalty: getPenaltyByLie(finalLie),
    }
    const updatedShots = [...currentShots, newShot]

    if (isHoleOut) {
      void syncShotEvents(currentHole, updatedShots)
      completeHole(updatedShots)
      return
    }
    setCurrentShots(updatedShots)
    void syncShotEvents(currentHole, updatedShots)
    setNextInputs(finalRemaining, finalLie, buildClubStats([...allShots, newShot], isPutter), club)
  }

  const undoLastShot = () => {
    const removed = currentShots[currentShots.length - 1]
    if (!removed) return
    setCurrentShots(currentShots.slice(0, -1))
    void syncShotEvents(currentHole, currentShots.slice(0, -1))
    // 취소한 샷의 입력값을 되살려 바로 수정 가능하게
    setSelectedClub(removed.club)
    setSelectedLie(removed.ballLie)
    setRemainingDistance(removed.distanceToPinAfter)
    setIsPinOver(false)
  }

  const undoPreviousHole = async () => {
    if (completedHoles.length === 0) return
    const last = completedHoles[completedHoles.length - 1]
    const ok = await confirm(`${last.holeNumber}번 홀 기록을 삭제하고 다시 입력하시겠습니까?`, '삭제 후 다시 입력', 'danger')
    if (!ok) return

    const remaining = completedHoles.filter((h) => h.holeNumber !== last.holeNumber)
    const shots = [...last.shots]
    const removed = shots.pop()
    const prev = shots[shots.length - 1]

    setCompletedHoles(remaining)
    setIsRoundComplete(false)
    setShowRoundReport(false)
    setCurrentHole(last.holeNumber)
    setHoleDistance(last.totalDistance)
    setCurrentShots(shots)
    void syncShotEvents(last.holeNumber, shots)
    setIsPinOver(false)
    if (removed) {
      setSelectedClub(removed.club)
      setSelectedLie(prev?.ballLie === '그린' ? '그린' : '페어웨이')
      setRemainingDistance(0)
    }

    const roundId = roundIdRef.current
    if (!roundId) return
    try {
      await track(async () => {
        const { error } = await supabase
          .from('round_holes')
          .delete()
          .eq('round_id', roundId)
          .eq('hole_number', last.holeNumber)
        if (error) throw error
        const { error: updateError } = await supabase
          .from('rounds')
          .update({
            status: 'in_progress',
            total_score: sumBy(remaining, 'score'),
            total_putts: sumBy(remaining, 'putts'),
            updated_at: new Date().toISOString(),
          })
          .eq('id', roundId)
        if (updateError) throw updateError
      })
    } catch (err) {
      console.error('홀 삭제 실패:', err)
      setSaveError('서버에서 홀 기록을 삭제하지 못했습니다. 다시 입력 후 저장하면 덮어씁니다.')
    }
  }

  const clearAll = useCallback(
    (keepClubName: boolean) => {
      setRoundId(null)
      roundPromiseRef.current = null
      clearDraft()
      setCompletedHoles([])
      setHolePars(INITIAL_HOLE_PARS)
      setIsRoundComplete(false)
      setShowRoundReport(false)
      setSaveError(null)
      if (!keepClubName) {
        setGolfClubName('')
        setCourseName('OUT/IN')
        setCourseId(null)
        setRouteIds([])
        setTeeCode(null)
        setTeeName(null)
        setRouteDistances([])
        setGreenCodes([])
        setGreenNames([])
        setRouteHoles([])
        setHolePars(INITIAL_HOLE_PARS)
      }
      setPlayMode(null)
      prepareHole(1, keepClubName ? holePars : INITIAL_HOLE_PARS, [], keepClubName ? routeDistances : [])
    },
    [setRoundId, clearDraft, prepareHole, holePars, routeDistances]
  )

  const resetCurrentRound = async () => {
    const ok = await confirm(
      '현재 진행 중인 라운드를 완전히 삭제하고 처음부터 새로 시작하시겠습니까?',
      '삭제하고 새로 시작',
      'danger'
    )
    if (!ok) return
    const id = roundIdRef.current
    if (id) {
      try {
        await track(async () => {
          const { error } = await supabase.from('rounds').delete().eq('id', id)
          if (error) throw error
        })
      } catch (err) {
        console.error('라운드 초기화 실패:', err)
        setSaveError('서버에서 라운드를 삭제하지 못했습니다. 다시 시도해 주세요.')
        return
      }
    }
    clearAll(false)
  }

  const startNewRound = () => clearAll(true)

  return {
    // 메타
    golfClubName, setGolfClubName, courseName, setCourseName, playMode, setPlayMode, courseId, setCourseId, routeIds, setRouteIds, teeCode, teeName, routeDistances, greenCodes, greenNames, configureCourseRoutes,
    currentRoundId, isSaving, saveError, retrySync, ready,
    // 진행 상태
    currentHole, currentPar, holeDistance, currentShots, completedHoles,
    currentGreenOptions, currentGreenCode: greenCodes[currentHole - 1] ?? 'standard', changeGreen,
    isRoundComplete, showRoundReport, setShowRoundReport, holePars,
    // 입력 상태
    selectedClub, selectedLie, setSelectedLie, remainingDistance, isPinOver, setIsPinOver,
    // 파생값
    currentPrevDistance, calculatedShotDistance, expectedDistance, recommendedClub,
    isPutterOrGreen, summary, currentHoleScore, clubStats, clubStatsAll, clubApproach, recommendedLie, isOnGreen,
    // 액션
    handleClubSelect, changeHolePar, changeHoleDistance, changeRemaining,
    saveShot, quickPutt, undoLastShot, undoPreviousHole, resetCurrentRound, startNewRound,
  }
}

export type RoundApi = ReturnType<typeof useRound>
