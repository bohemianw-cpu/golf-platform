'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { isSelectableTee, resolveHoleTeeVariants } from '@/utils/course-tee'
import type { ClubItem, BallLie, ShotRecord, HoleRecord, GolfCourseRoute } from '@/types/golf'
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
  MAX_GOLF_DISTANCE_M,
  MAX_GOLF_PAR,
  MIN_GOLF_PAR,
  roundTo10,
  roundToTenth,
  type ClubStatsMap,
} from '@/utils/golf/scoring'
import type { ChooseFn } from '@/components/score/ConfirmDialog'
import { createClubAdvice, GREEN_APPROACH_REMAINING, isWithinGreenReach } from './round/clubAdvice'
import { buildCourseLayout } from './round/courseLayout'
import { writeDraft, type Draft } from './round/draft'
import { getHoleResultLabel, type HoleResultNotice } from './round/holeResult'
import { loadResumedRound, type RoundRow } from './round/restoreRound'
import { buildRoundSummary } from './round/roundSummary'
import { runInitialRestore } from './round/initialRestore'
import { useRoundSync, type RoundMeta } from './round/useRoundSync'
import { useDraftBackup, type DraftSnapshot } from './round/useDraftBackup'

export type { HoleResultNotice } from './round/holeResult'

interface Dialogs {
  choose: ChooseFn
  confirm: (message: string, okLabel?: string, tone?: 'primary' | 'danger') => Promise<boolean>
}

export function useRound(clubs: ClubItem[], { choose, confirm }: Dialogs, sampleSessionId: string | null = null) {
  // createClient()를 렌더마다 호출하지 않도록 고정
  const supabase = useMemo(() => createClient(), [])

  // ---------- 상태 ----------
  const [golfClubName, setGolfClubName] = useState('')
  const [courseName, setCourseName] = useState('OUT/IN')
  const [playMode, setPlayMode] = useState<'field' | 'screen' | null>('field')
  const [screenProvider, setScreenProvider] = useState<string | null>(null)
  const [entryMode, setEntryMode] = useState<'live' | 'backfill'>('live')
  const [courseId, setCourseId] = useState<string | null>(null)
  const [routeIds, setRouteIds] = useState<string[]>([])
  const [teeCode, setTeeCode] = useState<string | null>(null)
  const [teeName, setTeeName] = useState<string | null>(null)
  const [courseInfoLocked, setCourseInfoLocked] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const [currentHole, setCurrentHole] = useState(1)
  const [holePars, setHolePars] = useState<number[]>(INITIAL_HOLE_PARS)
  const [routeDistances, setRouteDistances] = useState<number[]>([])
  const [routeHoles, setRouteHoles] = useState<GolfCourseRoute['holes']>([])
  const [courseParsAvailable, setCourseParsAvailable] = useState(false)
  const [greenCodes, setGreenCodes] = useState<string[]>([])
  const [greenNames, setGreenNames] = useState<string[]>([])
  const [holeDistance, setHoleDistance] = useState(360)
  const [currentShots, setCurrentShots] = useState<ShotRecord[]>([])
  const [undoneShots, setUndoneShots] = useState<{ holeNumber: number; shot: ShotRecord }[]>([])
  const [completedHoles, setCompletedHoles] = useState<HoleRecord[]>([])

  const [selectedClubValue, setSelectedClub] = useState('')
  const [selectedLie, setSelectedLie] = useState<BallLie>('페어웨이')
  const [lieSelectedByUser, setLieSelectedByUser] = useState(false)
  const [remainingDistance, setRemainingDistance] = useState(150)
  const [isPinOver, setIsPinOver] = useState(false)

  const [isRoundComplete, setIsRoundComplete] = useState(false)
  const [showRoundReport, setShowRoundReport] = useState(false)
  const [holeResultNotice, setHoleResultNotice] = useState<HoleResultNotice | null>(null)
  const isSample = !!sampleSessionId
  const [isRegistered, setIsRegistered] = useState(false)

  // ---------- refs ----------
  const undoPreviousHoleBusyRef = useRef(false)
  const initRef = useRef(false)
  const userIdRef = useRef<string | null>(null)
  const metaRef = useRef<RoundMeta>({ club: '', course: '', playMode: null, screenProvider: null, entryMode: 'live', holeCount: 18, courseId: null, routeIds: [], teeCode: null, teeName: null })
  useEffect(() => {
    metaRef.current = { club: golfClubName, course: courseName, playMode, screenProvider, entryMode, holeCount: routeDistances.length >= 1 && routeDistances.length <= 18 ? routeDistances.length : 18, courseId, routeIds, teeCode, teeName }
  }, [golfClubName, courseName, playMode, screenProvider, entryMode, routeDistances.length, courseId, routeIds, teeCode, teeName])

  // ---------- 로컬 백업과 서버 저장 ----------
  const clearDraft = useCallback(() => writeDraft(isSample, null), [isSample])
  const markRegistered = useCallback(() => {
    clearDraft()
    setIsRegistered(true)
  }, [clearDraft])
  const {
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
    hasUnsavedChanges,
  } = useRoundSync({ supabase, isSample, metaRef, setSaveError, onRegistered: markRegistered })

  // ---------- 클럽 파생값 (이름이 아닌 category 기준) ----------
  const { teeClubName, putterName, preferredApproachWedgeName, recommendForDistance, isPutter, isDriver, greenReachDistance, suggestedRemainingForClub } =
    useMemo(() => createClubAdvice(clubs), [clubs])

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
  const isPutterSelected = isPutter(selectedClub)
  const isPutterOrGreen = selectedLie === '그린' || isPutterSelected
  const calculatedShotDistance = calcShotDistance(currentPrevDistance, remainingDistance, isPinOver)

  const recommendedClub = useMemo(() => {
    const lastShot = currentShots[currentShots.length - 1]
    const onGreen = lastShot?.ballLie === '그린'
    if (onGreen && putterName) return putterName
    if (currentPrevDistance <= 70 && preferredApproachWedgeName) return preferredApproachWedgeName
    if (currentPrevDistance <= 15 && putterName) return putterName
    // 드라이버로 친 직후에는 거리가 멀어도 드라이버 다음 채를 추천 (OB 원위치 재타는 제외)
    const afterDriver = !!lastShot && isDriver(lastShot.club) && lastShot.ballLie !== 'OB'
    return (
      recommendForDistance(
        currentPrevDistance,
        clubStats,
        afterDriver ? (c) => c.category === 'driver' : undefined
      ) ?? teeClubName
    )
  }, [currentShots, currentPrevDistance, putterName, preferredApproachWedgeName, recommendForDistance, clubStats, teeClubName, isDriver])

  // 직전에 저장한 샷이 그린에 올랐는지 (퍼트 빠른 입력 노출 조건)
  const isOnGreen = currentShots[currentShots.length - 1]?.ballLie === '그린'

  const recommendedLie: BallLie | null = selectedClub && isWithinGreenReach(currentPrevDistance, greenReachDistance(selectedClub, clubStats)) ? '그린' : null

  const summary = useMemo(
    () => buildRoundSummary({ completedHoles, currentHole, currentPar, currentShots, isRoundComplete, lieSelectedByUser, selectedLie }),
    [completedHoles, currentHole, currentPar, currentShots, isRoundComplete, lieSelectedByUser, selectedLie]
  )

  const currentHoleScore = calcHoleScore(currentShots)

  // ---------- 입력 초기화 헬퍼 ----------
  const prepareHole = useCallback(
    (holeNum: number, pars: number[], doneHoles: HoleRecord[], distances = routeDistances) => {
      const par = pars[holeNum - 1] ?? 4
      const dist = distances[holeNum - 1] ?? defaultDistanceForPar(par)
      const stats = buildClubStats(doneHoles.flatMap((h) => h.shots), isPutter)
      const club = par <= 3 ? recommendForDistance(dist, stats) ?? teeClubName : teeClubName
      setCurrentHole(holeNum)
      setCurrentShots([])
      setHoleDistance(dist)
      const greenLie = !!club && isWithinGreenReach(dist, greenReachDistance(club, stats))
      setSelectedClub(club)
      setSelectedLie(greenLie ? '그린' : '페어웨이')
      setLieSelectedByUser(false)
      setIsPinOver(false)
      setRemainingDistance(
        greenLie ? Math.min(GREEN_APPROACH_REMAINING, dist) : suggestedRemainingForClub(dist, club, stats)
      )
    },
    [isPutter, recommendForDistance, greenReachDistance, suggestedRemainingForClub, teeClubName, routeDistances]
  )

  const setNextInputs = useCallback(
    (prevDist: number, lie: BallLie, stats: ClubStatsMap, lastClub?: string) => {
      setIsPinOver(false)
      setLieSelectedByUser(false)
      if (lie === '그린' && putterName) {
        setSelectedClub(putterName)
        setSelectedLie('그린')
        setRemainingDistance(Math.max(0, roundToTenth(prevDist - getExpectedDistance(putterName, clubs, stats))))
        return
      }
      const afterDriver = !!lastClub && isDriver(lastClub) && lie !== 'OB'
      const rec =
        recommendForDistance(prevDist, stats, afterDriver ? (c) => c.category === 'driver' : undefined) ??
        teeClubName
      const greenLie = !!rec && isWithinGreenReach(prevDist, greenReachDistance(rec, stats))
      setSelectedClub(rec)
      setSelectedLie(greenLie ? '그린' : '페어웨이')
      setRemainingDistance(
        greenLie ? Math.min(GREEN_APPROACH_REMAINING, prevDist) : suggestedRemainingForClub(prevDist, rec, stats)
      )
    },
    [clubs, putterName, isDriver, recommendForDistance, greenReachDistance, suggestedRemainingForClub, teeClubName]
  )

  // ---------- 이 기기 임시 기록 ----------
  const draftSnapshot = useMemo<DraftSnapshot>(() => ({
    golfClubName, courseName, playMode, screenProvider, entryMode, courseId, routeIds, teeCode, teeName, courseInfoLocked, courseParsAvailable, routeDistances, greenCodes, greenNames, routeHoles, holePars, currentHole, holeDistance, currentShots, completedHoles,
  }), [golfClubName, courseName, playMode, screenProvider, entryMode, courseId, routeIds, teeCode, teeName, courseInfoLocked, courseParsAvailable, routeDistances, greenCodes, greenNames, routeHoles, holePars, currentHole, holeDistance, currentShots, completedHoles])
  useDraftBackup({ supabase, ready, isRegistered, isSample, sampleSessionId, userIdRef, roundIdRef, roundId: currentRoundId, snapshot: draftSnapshot, setSaveError })

  // ---------- 서버 저장 흐름 ----------
  const registerRound = useCallback(async () => {
    if (isRegistered || undoPreviousHoleBusyRef.current || !isRoundComplete || completedHoles.length === 0) return false
    return track(async () => {
      await waitForQueuedSyncs()
      for (const hole of completedHoles) {
        if (!(await syncShotEvents(hole.holeNumber, hole.shots))) return false
      }
      const holesSaved = await syncHoles(completedHoles)
      if (!holesSaved) return false
      const registered = await finalizeRound(completedHoles)
      if (registered) {
        setSaveError(null)
        setShowRoundReport(true)
      }
      return registered
    })
  }, [isRegistered, isRoundComplete, completedHoles, syncShotEvents, syncHoles, finalizeRound, track, waitForQueuedSyncs])

  const syncAndMaybeFinalize = useCallback(
    async (holes: HoleRecord[], finalize: boolean) => {
      await waitForQueuedSyncs()
      const ok = await syncHoles(holes)
      if (ok && finalize && !isSample) await finalizeRound(holes)
    },
    [syncHoles, finalizeRound, isSample, waitForQueuedSyncs]
  )

  const retrySync = useCallback(
    async () => {
      if (isRegistered) return
      const shotsToRetry = [
        ...completedHoles.map((hole) => [hole.holeNumber, hole.shots] as const),
        ...(!completedHoles.some((hole) => hole.holeNumber === currentHole)
          ? [[currentHole, currentShots] as const]
          : []),
      ]
      for (const [holeNumber, shots] of shotsToRetry) {
        if (!(await syncShotEvents(holeNumber, shots))) return
      }
      await syncAndMaybeFinalize(completedHoles, false)
    },
    [isRegistered, syncShotEvents, syncAndMaybeFinalize, completedHoles, currentHole, currentShots]
  )

  // 골프장처럼 신호가 약한 곳에서 저장에 실패했다면, 인터넷 연결이 돌아오거나 앱 화면으로 돌아오는 순간
  // 못 올린 홀과 샷을 자동으로 다시 보낸다. 직접 "다시 시도"를 누르지 않아도 된다.
  const retrySyncRef = useRef(retrySync)
  useEffect(() => { retrySyncRef.current = retrySync })
  useEffect(() => {
    const retryIfUnsaved = () => {
      if (navigator.onLine && document.visibilityState === 'visible' && hasUnsavedChanges()) void retrySyncRef.current()
    }
    window.addEventListener('online', retryIfUnsaved)
    document.addEventListener('visibilitychange', retryIfUnsaved)
    return () => {
      window.removeEventListener('online', retryIfUnsaved)
      document.removeEventListener('visibilitychange', retryIfUnsaved)
    }
  }, [hasUnsavedChanges])

  // ---------- 초기 복구 (최초 1회) ----------
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const applyDraft = (d: Draft) => {
      setRoundId(d.roundId)
      setGolfClubName(d.golfClubName)
      setCourseName(d.courseName)
      setPlayMode(d.playMode ?? 'field')
      setScreenProvider(d.screenProvider ?? null)
      setEntryMode('live')
      setCourseId(d.courseId ?? null)
      setRouteIds(d.routeIds ?? [])
      setTeeCode(d.teeCode ?? null)
      setTeeName(d.teeName ?? null)
      setCourseInfoLocked(d.courseInfoLocked ?? (!!d.roundId || d.completedHoles.length > 0 || d.currentShots.length > 0))
      setCourseParsAvailable(d.courseParsAvailable ?? !!(d.routeHoles?.length && d.routeHoles.length === d.holePars.length && d.routeHoles.every((hole) => hole.par >= MIN_GOLF_PAR && hole.par <= MAX_GOLF_PAR)))
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
      const savedHoleCount = d.routeDistances?.length ?? 0
      const targetHoleCount = savedHoleCount >= 1 && savedHoleCount <= 18 ? savedHoleCount : 18
      if (d.completedHoles.length >= targetHoleCount) {
        setIsRoundComplete(true)
        void syncAndMaybeFinalize(d.completedHoles, false)
      } else if (d.completedHoles.length > 0) {
        void syncHoles(d.completedHoles)
      }
    }

    const resumeFromDb = async (round: RoundRow) => {
      const resumed = await loadResumedRound(supabase, round)
      setRoundId(round.id)
      setGolfClubName(round.club_name || round.golf_club || '')
      setCourseName(round.course_name || 'OUT/IN')
      setPlayMode(round.play_mode === 'screen' ? 'screen' : 'field')
      setScreenProvider(round.screen_provider ?? null)
      setEntryMode('live')
      setCourseId(round.course_id ?? null)
      setRouteIds(round.route_ids ?? [])
      setTeeCode(round.tee_code ?? null)
      setTeeName(round.tee_name ?? null)
      setCourseInfoLocked(true)
      setHolePars(resumed.holePars)
      setCourseParsAvailable(resumed.courseParsAvailable)
      setRouteDistances(resumed.routeDistances)
      setGreenCodes(resumed.greenCodes)
      setGreenNames(resumed.greenNames)
      setRouteHoles(resumed.routeHoles)
      setCompletedHoles(resumed.completedHoles)
      prepareHole(resumed.nextHole, resumed.holePars, resumed.completedHoles, resumed.routeDistances)
      if (resumed.partialShots.length > 0) {
        const last = resumed.partialShots[resumed.partialShots.length - 1]
        setCurrentShots(resumed.partialShots)
        setHoleDistance(resumed.partialHoleDistance)
        setNextInputs(last.distanceToPinAfter, last.ballLie, buildClubStats([...resumed.completedHoles.flatMap((h) => h.shots), ...resumed.partialShots], isPutter), last.club)
      }
      if (resumed.completedHoles.length >= resumed.targetHoleCount) {
        setIsRoundComplete(true)
        void syncAndMaybeFinalize(resumed.completedHoles, false)
      }
    }

    void runInitialRestore({ supabase, isSample, sampleSessionId, choose, userIdRef, applyDraft, resumeFromDb, clearDraft, setSaveError, setReady })
    // 최초 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- 입력 핸들러 ----------
  const handleClubSelect = (clubName: string) => {
    setSelectedClub(clubName)
    let lie = selectedLie
    if (!lieSelectedByUser) {
      lie = isWithinGreenReach(currentPrevDistance, greenReachDistance(clubName, clubStats)) ? '그린' : '페어웨이'
      setSelectedLie(lie)
    }
    // 그린 온 가능 거리(+10m) 안이면 기본 남은 거리를 5m로 표시한다.
    if (!lieSelectedByUser && lie === '그린') {
      setRemainingDistance(Math.min(GREEN_APPROACH_REMAINING, currentPrevDistance))
      return
    }
    if (clubs.find((club) => club.name === clubName)?.category === 'wedge') {
      setRemainingDistance(suggestedRemainingForClub(currentPrevDistance, clubName, clubStats))
      return
    }
    const diff = currentPrevDistance - expectedDistance(clubName)
    setRemainingDistance(isPutter(clubName) || lie === '그린' ? Math.max(0, roundToTenth(diff)) : roundTo10(diff))
  }

  const changeHolePar = (holeIndex: number, newPar: number) => {
    if (isRegistered || holeIndex !== currentHole - 1) return
    setHolePars((prev) => prev.map((p, i) => (i === holeIndex ? newPar : p)))
  }

  const configureCourseRoutes = useCallback((routes: GolfCourseRoute[], selectedTeeCode: string | null, selectedTeeName: string | null) => {
    if (courseInfoLocked || currentRoundId || completedHoles.length > 0 || currentShots.length > 0) return false
    setUndoneShots([])
    setRouteIds(routes.map((route) => route.id))
    setCourseName(routes.map((route) => route.display_name).join(' → '))
    setTeeCode(selectedTeeCode)
    setTeeName(selectedTeeName)
    const layout = buildCourseLayout(routes, selectedTeeCode)
    setRouteHoles(layout.routeHoles)
    setCourseParsAvailable(layout.hasValidPars)
    setHolePars(layout.holePars)
    setRouteDistances(layout.distances)
    setGreenCodes(layout.greenCodes)
    setGreenNames(layout.greenNames)
    prepareHole(1, layout.holePars, [], layout.distances)
    return layout.valid
  }, [courseInfoLocked, currentRoundId, completedHoles.length, currentShots.length, prepareHole])

  const currentGreenOptions = useMemo(() => {
    const hole = routeHoles?.[currentHole - 1]
    if (!hole) return []
    const courseTees = (routeHoles ?? []).flatMap((item) => item.tees)
      .filter((tee, index, all) => isSelectableTee(tee) && all.findIndex((candidate) => candidate.tee_code === tee.tee_code) === index)
    return (teeCode
      ? resolveHoleTeeVariants(hole, teeCode, courseTees)
      : hole.tees.filter((tee) => tee.tee_selection_available === false)).sort((a, b) =>
        (a.par ?? hole?.par ?? 0) - (b.par ?? hole?.par ?? 0) || a.distance_m - b.distance_m,
      )
  }, [routeHoles, currentHole, teeCode])

  const changeGreen = useCallback((greenCode: string, greenName: string, distance: number, par?: number | null) => {
    if (isRegistered || currentShots.length > 0 || completedHoles.some((hole) => hole.holeNumber === currentHole)) return
    setGreenCodes((previous) => previous.map((value, index) => index === currentHole - 1 ? greenCode : value))
    setGreenNames((previous) => previous.map((value, index) => index === currentHole - 1 ? greenName : value))
    const basePar = routeHoles?.[currentHole - 1]?.par
    setHolePars((previous) => previous.map((value, index) => index === currentHole - 1 ? (par ?? basePar ?? value) : value))
    const safeDistance = clamp(Math.round(distance), 0, MAX_GOLF_DISTANCE_M)
    setRouteDistances((previous) => previous.map((value, index) => index === currentHole - 1 ? safeDistance : value))
    setHoleDistance(safeDistance)
    const greenLie = !!selectedClub && isWithinGreenReach(safeDistance, greenReachDistance(selectedClub, clubStats))
    if (!lieSelectedByUser) setSelectedLie(greenLie ? '그린' : '페어웨이')
    setRemainingDistance(!lieSelectedByUser && greenLie
      ? Math.min(GREEN_APPROACH_REMAINING, safeDistance)
      : suggestedRemainingForClub(safeDistance, selectedClub, clubStats))
  }, [isRegistered, currentShots.length, completedHoles, currentHole, greenReachDistance, selectedClub, lieSelectedByUser, routeHoles, suggestedRemainingForClub, clubStats])

  const changeHoleDistance = (raw: number) => {
    if (isRegistered || currentShots.length > 0) return
    const val = clamp(Math.round(raw), 0, MAX_GOLF_DISTANCE_M)
    setHoleDistance(val)
    if (currentShots.length === 0) {
      const greenLie = !!selectedClub && isWithinGreenReach(val, greenReachDistance(selectedClub, clubStats))
      if (!lieSelectedByUser) setSelectedLie(greenLie ? '그린' : '페어웨이')
      setRemainingDistance(!lieSelectedByUser && greenLie
        ? Math.min(GREEN_APPROACH_REMAINING, val)
        : suggestedRemainingForClub(val, selectedClub, clubStats))
    }
  }

  const changeRemaining = (v: number) => setRemainingDistance(clamp(roundToTenth(v), 0, MAX_GOLF_DISTANCE_M))

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

    const targetHoleCount = routeDistances.length >= 1 && routeDistances.length <= 18 ? routeDistances.length : 18
    if (currentHole < targetHoleCount) {
      prepareHole(currentHole + 1, holePars, updated)
      void syncHoles(updated)
    } else {
      setCurrentShots([])
      setIsRoundComplete(true)
      setShowRoundReport(true)
      void syncAndMaybeFinalize(updated, false)
    }
    setHoleResultNotice({
      holeNumber: currentHole,
      par: currentPar,
      score: finalScore,
      scoreDiff: finalScore - currentPar,
      label: getHoleResultLabel(finalScore, currentPar),
      isFinalHole: currentHole >= targetHoleCount,
    })
  }

  /**
   * 퍼트 N번을 한 번에 입력하고 홀아웃 처리.
   * 중간 퍼트의 남은 거리는 처음 거리를 N등분한 추정값입니다.
   */
  const quickPutt = (count: number) => {
    if (!putterName || !isOnGreen || count < 1) return
    setUndoneShots((previous) => previous.filter((entry) => entry.holeNumber > currentHole))
    const base = currentPrevDistance
    const putts: ShotRecord[] = []
    let before = base
    for (let i = 1; i <= count; i++) {
      const last = i === count
      const after = last ? 0 : Math.max(0, roundToTenth((base * (count - i)) / count))
      putts.push({
        shotNumber: currentShots.length + i,
        inputMethod: 'quick_putt',
        club: putterName,
        distanceToPinBefore: before,
        distanceToPinAfter: after,
        shotDistance: Math.max(0, roundToTenth(before - after)),
        ballLie: last ? '홀아웃' : '그린',
        penalty: 0,
      })
      before = after
    }
    completeHole([...currentShots, ...putts])
  }

  const saveShot = () => {
    if (isRegistered || isRoundComplete || !selectedClub) return
    setUndoneShots((previous) => previous.filter((entry) => entry.holeNumber > currentHole))
    const prevShot = currentShots[currentShots.length - 1]
    // 남은 거리가 0이면 저장 시 홀아웃으로 처리한다. OB는 원위치 재타이므로 예외다.
    const isHoleOut = remainingDistance === 0 && selectedLie !== 'OB'
    const finalLie: BallLie = isHoleOut ? '홀아웃' : selectedLie
    // 그린 위 홀아웃은 퍼터로 기록 (퍼트 수 정확도)
    const club = isHoleOut && prevShot?.ballLie === '그린' && putterName ? putterName : selectedClub
    const isOb = finalLie === 'OB' // 원위치 재타: 거리 유지, 비거리 통계 제외
    const finalRemaining = isHoleOut ? 0 : isOb ? currentPrevDistance : remainingDistance

    const newShot: ShotRecord = {
      shotNumber: currentShots.length + 1,
      inputMethod: 'manual',
      club,
      distanceToPinBefore: currentPrevDistance,
      distanceToPinAfter: finalRemaining,
      shotDistance: isOb ? 0 : clamp(calcShotDistance(currentPrevDistance, finalRemaining, isPinOver && !isHoleOut), 0, MAX_GOLF_DISTANCE_M),
      ballLie: finalLie,
      penalty: getPenaltyByLie(finalLie),
    }
    const updatedShots = [...currentShots, newShot]

    if (isHoleOut) {
      completeHole(updatedShots)
      return
    }
    setCurrentShots(updatedShots)
    void syncShotEvents(currentHole, updatedShots)
    setNextInputs(finalRemaining, finalLie, buildClubStats([...allShots, newShot], isPutter), club)
  }

  const undoLastShot = () => {
    if (isRegistered) return
    const removed = currentShots[currentShots.length - 1]
    if (!removed) return
    setUndoneShots((previous) => [...previous, { holeNumber: currentHole, shot: removed }])
    setCurrentShots(currentShots.slice(0, -1))
    void syncShotEvents(currentHole, currentShots.slice(0, -1))
    // 취소한 샷의 입력값을 되살려 바로 수정 가능하게
    setSelectedClub(removed.club)
    setSelectedLie(removed.ballLie)
    setLieSelectedByUser(true)
    setRemainingDistance(removed.distanceToPinAfter)
    setIsPinOver(false)
  }

  const canRedoLastShot = undoneShots.length > 0 &&
    undoneShots[undoneShots.length - 1].holeNumber === currentHole &&
    undoneShots[undoneShots.length - 1].shot.shotNumber === currentShots.length + 1

  const redoLastShot = () => {
    if (isRegistered || !canRedoLastShot) return
    const restored = undoneShots[undoneShots.length - 1].shot
    const updatedShots = [...currentShots, restored]
    setUndoneShots((previous) => previous.slice(0, -1))
    if (restored.ballLie === '홀아웃') {
      completeHole(updatedShots)
      return
    }
    setCurrentShots(updatedShots)
    void syncShotEvents(currentHole, updatedShots)
    setNextInputs(restored.distanceToPinAfter, restored.ballLie, buildClubStats([...completedHoles.flatMap((hole) => hole.shots), ...updatedShots], isPutter), restored.club)
  }

  const undoPreviousHole = async (skipConfirmation = false) => {
    if (isRegistered || undoPreviousHoleBusyRef.current || completedHoles.length === 0) return
    const last = completedHoles[completedHoles.length - 1]
    if (!skipConfirmation) {
      const ok = await confirm(`${last.holeNumber}번 홀의 마지막 샷을 취소하고 다시 입력하시겠습니까?`, '샷 취소', 'danger')
      if (!ok) return
    }
    undoPreviousHoleBusyRef.current = true
    try {
      await waitForQueuedSyncs()
      const remaining = completedHoles.filter((h) => h.holeNumber !== last.holeNumber)
      const shots = [...last.shots]
      const removed = shots.pop()
      const prev = shots[shots.length - 1]
      if (removed) setUndoneShots((previous) => [...previous, { holeNumber: last.holeNumber, shot: removed }])

      setCompletedHoles(remaining)
      setIsRoundComplete(false)
      setIsRegistered(false)
      setShowRoundReport(false)
      setCurrentHole(last.holeNumber)
      setHoleDistance(last.totalDistance)
      setCurrentShots(shots)
      setIsPinOver(false)
      if (removed) {
        setSelectedClub(removed.club)
        setSelectedLie(prev?.ballLie === '그린' ? '그린' : '페어웨이')
        setLieSelectedByUser(false)
        setRemainingDistance(0)
      }

      const shotsSaved = await syncShotEvents(last.holeNumber, shots)
      const holesSaved = await syncHoles(remaining)
      if (!shotsSaved || !holesSaved) {
        setSaveError('샷 취소를 서버에 반영하지 못했습니다. 이 기기의 임시 기록은 유지됩니다. 다시 시도해 주세요.')
      }
    } finally {
      undoPreviousHoleBusyRef.current = false
    }
  }

  const undoPreviousShot = () => {
    if (isRegistered) return
    if (currentShots.length > 0) undoLastShot()
    else if (completedHoles.length > 0) void undoPreviousHole()
  }

  const clearAll = useCallback(
    (keepClubName: boolean) => {
      resetRound()
      clearDraft()
      setCompletedHoles([])
      setUndoneShots([])
      setHolePars(INITIAL_HOLE_PARS)
      setIsRoundComplete(false)
      setIsRegistered(false)
      setShowRoundReport(false)
      setSaveError(null)
      setCourseInfoLocked(false)
      setHoleResultNotice(null)
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
        setCourseParsAvailable(false)
        setHolePars(INITIAL_HOLE_PARS)
      }
      setPlayMode('field')
      setScreenProvider(null)
      setEntryMode('live')
      prepareHole(1, keepClubName ? holePars : INITIAL_HOLE_PARS, [], keepClubName ? routeDistances : [])
    },
    [resetRound, clearDraft, prepareHole, holePars, routeDistances]
  )

  const startNewRound = () => {
    if (!isSample && !isRegistered) return
    clearAll(false)
  }

  const clearShotsAndUnlockCourse = useCallback(async () => {
    if (isRegistered) return false
    await waitForSavesToSettle()
    const id = roundIdRef.current
    if (id && !isSample) {
      try {
        await deleteServerRound(id)
      } catch (err) {
        console.error('샷 기록 해제 실패:', err)
        setSaveError('서버에서 샷 데이터를 삭제하지 못했습니다. 다시 시도해 주세요.')
        return false
      }
    }
    clearAll(false)
    return true
  }, [clearAll, isRegistered, isSample, waitForSavesToSettle, deleteServerRound, roundIdRef])

  return {
    // 메타
    golfClubName, setGolfClubName, courseName, setCourseName, playMode, setPlayMode, screenProvider, setScreenProvider, entryMode, setEntryMode, courseId, setCourseId, routeIds, setRouteIds, teeCode, teeName, routeDistances, greenCodes, greenNames, configureCourseRoutes, courseInfoLocked, setCourseInfoLocked, courseParsAvailable,
    currentRoundId, isSaving, saveError, retrySync, ready,
    // 진행 상태
    currentHole, currentPar, holeDistance, currentShots, completedHoles, routeHoles,
    currentGreenOptions, currentGreenCode: greenCodes[currentHole - 1] ?? 'standard', changeGreen,
    isRoundComplete, isRegistered, showRoundReport, setShowRoundReport, holePars, holeResultNotice, dismissHoleResultNotice: () => setHoleResultNotice(null),
    // 입력 상태
    selectedClub, selectedLie, setSelectedLie: (lie: BallLie) => { setSelectedLie(lie); setLieSelectedByUser(true) }, remainingDistance, isPinOver, setIsPinOver,
    // 파생값
    currentPrevDistance, calculatedShotDistance, expectedDistance, recommendedClub,
    isPutterSelected, isPutterOrGreen, summary, currentHoleScore, clubStats, clubStatsAll, clubApproach, recommendedLie, isOnGreen,
    // 액션
    handleClubSelect, changeHolePar, changeHoleDistance, changeRemaining, clearShotsAndUnlockCourse,
    saveShot, quickPutt, undoLastShot, undoPreviousShot, canRedoLastShot, redoLastShot, undoPreviousHole, startNewRound, registerRound, isSample,
  }
}

export type RoundApi = ReturnType<typeof useRound>
