'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { ClubItem } from '@/types/golf'
import ClubModal from './ClubModal'
import RoundReport from './RoundReport'
import ShotInputCard from './ShotInputCard'
import RoundMetrics from './RoundMetrics'
import ShotComparison from './ShotComparison'
import ClubStatsTable from './ClubStatsTable'
import Scorecard from './Scorecard'
import { useChoiceDialog } from './ConfirmDialog'
import { useRound } from '@/hooks/useRound'
import { DEFAULT_CLUBS, MAX_CLUBS, sortClubs } from '@/utils/golf/clubs'
import CourseCatalogPicker, { type GolfCourseOption, type GolfRouteOption } from './CourseCatalogPicker'
import ScoreGuideTour from '@/components/onboarding/ScoreGuideTour'
import { createClient } from '@/utils/supabase/client'
import { color, palette } from '@/utils/theme'
import ShotFlowNotice from './score-tab/ShotFlowNotice'
import HoleResultDialog from './score-tab/HoleResultDialog'
import GreenSelector from './score-tab/GreenSelector'
import RoundCompletePanel from './score-tab/RoundCompletePanel'
import PlayModeSelector from './score-tab/PlayModeSelector'

// 기존 import 경로 호환 (ClubModal 등에서 './ScoreTab'으로 가져오던 것)
export { sortClubs } from '@/utils/golf/clubs'

const SCORE_GUIDE_SEEN_KEY = 'golf-score-guide-seen:'
const CLUB_CATEGORIES = new Set(['driver', 'wood', 'utility', 'iron', 'wedge', 'putter'])

const isSavedClubBag = (value: unknown): value is ClubItem[] =>
  Array.isArray(value) && value.length <= MAX_CLUBS && value.every((item) =>
    item !== null && typeof item === 'object' &&
    typeof item.id === 'string' && typeof item.name === 'string' &&
    CLUB_CATEGORIES.has(item.category) &&
    (item.preferredApproach === undefined || typeof item.preferredApproach === 'boolean'),
  )

export default function ScoreTab({ bottomNavVisible, sampleSessionId = null, onExitSample }: { bottomNavVisible: boolean; sampleSessionId?: string | null; onExitSample?: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const { choose, confirm, dialog } = useChoiceDialog()
  const [clubs, setClubs] = useState<ClubItem[]>(() => sortClubs(DEFAULT_CLUBS))
  const [clubBagUserId, setClubBagUserId] = useState<string | null>(null)
  const [clubBagLoaded, setClubBagLoaded] = useState(false)
  const [clubBagError, setClubBagError] = useState<string | null>(null)
  const [clubBagLoadAttempt, setClubBagLoadAttempt] = useState(0)
  const [isClubModalOpen, setIsClubModalOpen] = useState(false)
  const [isCourseSearchOpen, setIsCourseSearchOpen] = useState(false)
  const [courseSearchQuery, setCourseSearchQuery] = useState('')
  const [selectedCatalogCourse, setSelectedCatalogCourse] = useState<GolfCourseOption | null>(null)
  const [screenProviders, setScreenProviders] = useState<string[]>([])
  const [screenProvidersLoading, setScreenProvidersLoading] = useState(false)
  const [screenProvidersError, setScreenProvidersError] = useState(false)
  const [scoreGuideEnabled, setScoreGuideEnabled] = useState(true)
  const [scoreGuideCompletedAt, setScoreGuideCompletedAt] = useState<string | null>(null)
  const [scoreGuidePreferencesLoaded, setScoreGuidePreferencesLoaded] = useState(false)
  const [scoreGuideUserId, setScoreGuideUserId] = useState<string | null>(null)
  const [showEntryInfo, setShowEntryInfo] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw authError ?? new Error('로그인 정보가 없습니다.')
        const { data, error } = await supabase.from('user_club_bags')
          .select('clubs')
          .eq('user_id', user.id)
          .maybeSingle()
        if (error) throw error
        if (data && !isSavedClubBag(data.clubs)) throw new Error('저장된 클럽 설정 형식이 올바르지 않습니다.')
        if (cancelled) return
        setClubBagUserId(user.id)
        if (data) setClubs(sortClubs(data.clubs))
        setClubBagError(null)
      } catch {
        if (cancelled) return
        setClubBagError('클럽 설정을 불러오지 못했습니다. 다시 시도해 주세요.')
      } finally {
        if (!cancelled) setClubBagLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [supabase, clubBagLoadAttempt])

  const saveClubBag = useCallback(async (updated: ClubItem[]) => {
    if (!clubBagUserId) throw new Error('로그인 정보가 없습니다.')
    const nextClubs = sortClubs(updated)
    const { error } = await supabase.from('user_club_bags').upsert({
      user_id: clubBagUserId,
      clubs: nextClubs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) throw error
    setClubs(nextClubs)
  }, [clubBagUserId, supabase])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) { setScoreGuideEnabled(false); setScoreGuidePreferencesLoaded(true) }
        return
      }
      let seenOnThisDevice: string | null = null
      try { seenOnThisDevice = window.localStorage.getItem(`${SCORE_GUIDE_SEEN_KEY}${user.id}`) } catch { /* Storage may be unavailable. */ }
      const { data } = await supabase.from('user_data_preferences')
        .select('score_guide_enabled,score_guide_completed_at')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      setScoreGuideUserId(user.id)
      setScoreGuideEnabled(data?.score_guide_enabled ?? true)
      setScoreGuideCompletedAt(data?.score_guide_completed_at ?? seenOnThisDevice)
      setScoreGuidePreferencesLoaded(true)
    })()
    return () => { cancelled = true }
  }, [supabase])

  const markScoreGuideSeen = useCallback(() => {
    if (scoreGuideCompletedAt) return
    const seenAt = new Date().toISOString()
    setScoreGuideCompletedAt(seenAt)
    if (scoreGuideUserId) {
      try { window.localStorage.setItem(`${SCORE_GUIDE_SEEN_KEY}${scoreGuideUserId}`, seenAt) } catch { /* The account preference still persists. */ }
    }
    void supabase.rpc('set_my_score_guide_preference', { p_enabled: scoreGuideEnabled, p_completed: true })
  }, [scoreGuideCompletedAt, scoreGuideEnabled, scoreGuideUserId, supabase])

  const round = useRound(clubs, { choose, confirm }, sampleSessionId)
  useEffect(() => {
    if (round.playMode !== 'screen') return
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) setScreenProvidersLoading(true) })
    void supabase.rpc('list_verified_screen_providers').then(({ data, error }) => {
      if (cancelled) return
      setScreenProviders(error ? [] : (data ?? []).map((row: { provider: string }) => row.provider))
      setScreenProvidersError(!!error)
      setScreenProvidersLoading(false)
    })
    return () => { cancelled = true }
  }, [round.playMode, supabase])
  useEffect(() => {
    if (!clubBagLoaded || !clubBagUserId) return
    let cancelled = false
    const noticeKey = `golf-shot-flow-info:${clubBagUserId}:${sampleSessionId ?? 'real'}`
    try {
      if (!localStorage.getItem(noticeKey)) queueMicrotask(() => { if (!cancelled) setShowEntryInfo(true) })
    } catch { queueMicrotask(() => { if (!cancelled) setShowEntryInfo(true) }) }
    return () => { cancelled = true }
  }, [clubBagLoaded, clubBagUserId, sampleSessionId])
  const closeEntryInfo = () => {
    if (clubBagUserId) {
      try { localStorage.setItem(`golf-shot-flow-info:${clubBagUserId}:${sampleSessionId ?? 'real'}`, 'seen') } catch { /* The notice can be dismissed for this visit. */ }
    }
    setShowEntryInfo(false)
  }
  const entryInfoPopup = showEntryInfo ? <ShotFlowNotice onClose={closeEntryInfo} /> : null
  const resultNotice = round.holeResultNotice ? <HoleResultDialog round={round} notice={round.holeResultNotice} /> : null
  const { completedHoles, currentHole, currentPar, currentShots, currentPrevDistance, isRoundComplete, isSaving, saveError } = round
  const { setCourseId, setGolfClubName, setCourseName, playMode, setPlayMode, configureCourseRoutes } = round
  const requestCourseFirst = useCallback(() => {
    void choose('골프장을 먼저 선택해 주세요.', [{ label: '확인', value: 'ok', tone: 'primary' }])
  }, [choose])
  const requestRoundStart = useCallback(() => {
    void choose('코스와 티 정보를 선택한 뒤 라운드 시작을 눌러주세요.', [{ label: '확인', value: 'ok', tone: 'primary' }])
  }, [choose])
  const startRoundWithCourseLock = useCallback(async () => {
    if (round.isRegistered || round.courseInfoLocked) return
    if (!round.playMode || (round.playMode === 'screen' && !round.screenProvider)) return
    const ok = await confirm('샷 데이터 입력 후 코스정보 변경이 불가능합니다. 코스정보가 정확한가요?', '확인', 'primary')
    if (ok) round.setCourseInfoLocked(true)
  }, [confirm, round])
  const unlockCourseAndClearShots = useCallback(async () => {
    if (round.isRegistered) return
    const ok = await confirm('입력한 샷 데이터가 모두 삭제되고 골프장·코스·티 선택이 초기화됩니다.', '초기화', 'danger')
    if (!ok) return
    const cleared = await round.clearShotsAndUnlockCourse()
    if (cleared) {
      setSelectedCatalogCourse(null)
      setCourseSearchQuery('')
      setIsCourseSearchOpen(false)
    }
  }, [confirm, round])
  const handleCourseSelect = useCallback((course: GolfCourseOption | null) => {
    setIsCourseSearchOpen(false)
    setCourseSearchQuery('')
    setSelectedCatalogCourse(course)
    setCourseId(course?.id ?? null)
    setGolfClubName(course?.name ?? '')
    setCourseName('')
    configureCourseRoutes([], null, null)
  }, [setCourseId, setGolfClubName, setCourseName, configureCourseRoutes])
  const handleCourseResolved = useCallback((course: GolfCourseOption | null) => setSelectedCatalogCourse(course), [])
  const handleRoutesChange = useCallback((routes: GolfRouteOption[], teeCode: string | null, teeName: string | null) => {
    configureCourseRoutes(routes, teeCode, teeName)
  }, [configureCourseRoutes])

  if (!clubBagLoaded || clubBagError) {
    return <div role={clubBagError ? 'alert' : 'status'} style={{ margin: '24px auto', padding: '20px 16px', maxWidth: 440, textAlign: 'center', color: palette.slate600 }}>
      <p>{clubBagError ?? '클럽 설정을 불러오는 중입니다.'}</p>
      {clubBagError && <button type="button" onClick={() => { setClubBagLoaded(false); setClubBagError(null); setClubBagLoadAttempt((count) => count + 1) }} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${palette.slate300}`, background: palette.white, cursor: 'pointer' }}>다시 시도</button>}
    </div>
  }

  if (round.showRoundReport) {
    return (
      <>
        <RoundReport
          completedHoles={completedHoles}
          holePars={round.holePars}
          courseHoleNumbers={round.routeHoles?.map((hole) => hole.hole_number)}
          clubs={clubs}
          currentCcName={round.golfClubName.trim() || undefined}
          roundId={round.currentRoundId}
          onBackToScore={() => round.setShowRoundReport(false)}
          onStartNewRound={round.startNewRound}
          onUndoLastShot={() => void round.undoPreviousHole()}
          onRegisterRound={() => void (async () => {
            const ok = await confirm('스코어를 등록하면 샷 데이터를 수정하거나 취소할 수 없습니다. 등록하시겠습니까?', '스코어 등록', 'primary')
            if (ok) await round.registerRound()
          })()}
          isSample={round.isSample}
          isRegistered={round.isRegistered}
          isRegistering={round.isSaving}
          saveError={round.saveError}
        />
        {round.isSample && onExitSample && <button type="button" onClick={onExitSample} style={{ position: 'fixed', left: 12, bottom: bottomNavVisible ? 74 : 12, zIndex: 60, padding: '8px 11px', border: `1px solid ${palette.blue300}`, borderRadius: 999, background: palette.blue50, color: palette.blue700, fontWeight: 700 }}>샘플 종료</button>}
        {entryInfoPopup}
        {dialog}
        {resultNotice}
      </>
    )
  }

  const modeSupported = !selectedCatalogCourse || !round.playMode || (round.playMode === 'field'
    ? selectedCatalogCourse.supports_field
    : selectedCatalogCourse.supports_screen)
  const hasCompleteCourseLayout = round.routeDistances.length >= 1 && round.routeDistances.length <= 18
  const courseInfoLocked = round.courseInfoLocked || !!round.currentRoundId || completedHoles.length > 0 || currentShots.length > 0
  const showShotCard = !isRoundComplete && modeSupported
  const previousHole = completedHoles.find((h) => h.holeNumber === currentHole - 1)

  return (
    <div style={{ padding: '16px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      {round.isSample && <div role="status" style={{ marginBottom: 10, padding: '9px 12px', border: `1px solid ${palette.blue300}`, borderRadius: 9, background: palette.blue50, color: palette.blue800, fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><span>샘플 입력 중 · 평균·배지·트로피 제외</span><button type="button" onClick={onExitSample} style={{ border: 0, background: 'transparent', color: palette.blue700, fontWeight: 700 }}>종료</button></div>}
      {/* 상단 헤더: 골프장/코스 이름 */}
      <div
        data-score-guide-target="course"
        style={{
          padding: '12px',
          backgroundColor: palette.slate50,
          borderRadius: '12px',
          border: `1px solid ${palette.slate200}`,
          marginBottom: '12px',
        }}
      >
        <PlayModeSelector courseInfoLocked={courseInfoLocked} playMode={playMode} round={round} handleCourseSelect={handleCourseSelect} setPlayMode={setPlayMode} screenProviders={screenProviders} screenProvidersLoading={screenProvidersLoading} screenProvidersError={screenProvidersError} />
        {/* 1줄: 골프장 이름 + 코스 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>⛳</span>
          <input
            id="course-catalog-search"
            type="search"
            aria-label="골프장 이름 검색"
            autoComplete="off"
            value={isCourseSearchOpen ? courseSearchQuery : round.golfClubName}
            placeholder={!playMode ? '라운드 방식을 먼저 선택해 주세요' : playMode === 'screen' && !round.screenProvider ? '스크린 서비스를 먼저 선택해 주세요' : '골프장을 선택해 주세요'}
            disabled={courseInfoLocked || round.isRegistered || !playMode || (playMode === 'screen' && !round.screenProvider)}
            onFocus={() => {
              const input = document.getElementById('course-catalog-search')
              if (input?.dataset.skipOpenOnFocus === 'true') {
                delete input.dataset.skipOpenOnFocus
                return
              }
              if (!isCourseSearchOpen) setCourseSearchQuery('')
              setIsCourseSearchOpen(true)
            }}
            onChange={(event) => {
              const query = event.target.value
              setCourseSearchQuery(query)
              setIsCourseSearchOpen(true)
              setGolfClubName(query)
              if (round.courseId) {
                setCourseId(null)
                setSelectedCatalogCourse(null)
                configureCourseRoutes([], null, null)
              }
            }}
            onBlur={(event) => {
              const nextTarget = event.relatedTarget
              window.setTimeout(() => {
                if (nextTarget instanceof HTMLElement && nextTarget.closest('#course-catalog-results')) return
                setIsCourseSearchOpen(false)
              }, 120)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                const firstOption = document.querySelector<HTMLButtonElement>('[data-course-option="true"]:not(:disabled)')
                if (firstOption) {
                  event.preventDefault()
                  firstOption.focus()
                }
              }
              if (event.key === 'Escape') {
                setIsCourseSearchOpen(false)
                setCourseSearchQuery(round.golfClubName)
              }
            }}
            style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '8px 10px', borderRadius: '6px', border: `1.5px solid ${color.brand}`, fontWeight: 'bold', fontSize: '13.5px', color: round.golfClubName ? palette.slate900 : palette.slate500, backgroundColor: palette.white, textAlign: 'left' }}
          />
          <ScoreGuideTour
            enabled={scoreGuideEnabled}
            bottomNavVisible={bottomNavVisible}
            startAutomatically={scoreGuidePreferencesLoaded && scoreGuideEnabled && !scoreGuideCompletedAt}
            onAutoStart={markScoreGuideSeen}
            onComplete={markScoreGuideSeen}
          />
        </div>
        <CourseCatalogPicker
          courseId={round.courseId}
          playMode={playMode}
          screenProvider={round.screenProvider}
          routeIds={round.routeIds}
          teeCode={round.teeCode}
          locked={courseInfoLocked || round.isRegistered}
          searchOpen={isCourseSearchOpen}
          onSearchOpenChange={setIsCourseSearchOpen}
          searchQuery={courseSearchQuery}
          onSearchQueryChange={setCourseSearchQuery}
          onCourseSelect={handleCourseSelect}
          onCourseResolved={handleCourseResolved}
          onRoutesChange={handleRoutesChange}
          onNeedCourse={requestCourseFirst}
          onStartRound={startRoundWithCourseLock}
          onUnlockCourse={unlockCourseAndClearShots}
          courseInfoLocked={courseInfoLocked}
          canUnlockCourse={!round.isRegistered && !!(round.golfClubName.trim() || round.routeIds.length > 0 || round.teeCode)}
          isSaving={isSaving}
        />
      </div>

      {/* 저장 오류 배너 */}
      {saveError && (
        <div
          role="alert"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', marginBottom: '12px', backgroundColor: palette.red50, border: `1px solid ${palette.red200}`, borderRadius: '10px', color: palette.red700, fontSize: '12.5px' }}
        >
          <span>{saveError}</span>
          <button
            onClick={round.retrySync}
            disabled={isSaving}
            style={{ flexShrink: 0, padding: '6px 10px', backgroundColor: palette.red600, color: palette.white, border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            다시 시도
          </button>
        </div>
      )}

      {!showShotCard && <RoundMetrics round={round} standalone />}

      <GreenSelector isRoundComplete={isRoundComplete} round={round} hasCompleteCourseLayout={hasCompleteCourseLayout} currentHole={currentHole} currentShots={currentShots} completedHoles={completedHoles} />

      {/* 샷 입력 / 라운드 완료 */}
      <div data-score-guide-target="shot-entry">
      {isRoundComplete ? (
        <RoundCompletePanel round={round} isSaving={isSaving} completedHoles={completedHoles} />
      ) : showShotCard ? (
        <ShotInputCard round={round} clubs={clubs} onOpenClubSettings={() => setIsClubModalOpen(true)} disabled={!courseInfoLocked} onDisabledClick={requestRoundStart} />
      ) : (
        <div role="status" style={{ padding: '24px 16px', marginBottom: '16px', border: `1px dashed ${palette.slate400}`, borderRadius: '12px', background: palette.white, textAlign: 'center', color: palette.slate600, fontSize: '13px' }}>
          선택한 구장이 지원하는 필드/스크린 방식을 확인해 주세요.
        </div>
      )}
      </div>

      <div aria-disabled={!courseInfoLocked} style={{ opacity: courseInfoLocked ? 1 : 0.45, filter: courseInfoLocked ? 'none' : 'grayscale(0.35)', pointerEvents: courseInfoLocked ? 'auto' : 'none', transition: 'opacity 0.2s ease, filter 0.2s ease' }}>
        <ShotComparison
          previousHole={previousHole}
          currentHole={currentHole}
          currentPar={currentPar}
          currentShots={currentShots}
          currentPrevDistance={currentPrevDistance}
          courseDataKnown={courseInfoLocked || hasCompleteCourseLayout}
        />

        <ClubStatsTable clubs={clubs} clubStats={round.clubStatsAll} clubApproach={round.clubApproach} />

        <Scorecard holePars={round.holePars} showPars={round.courseParsAvailable} completedHoles={completedHoles} routeNames={round.golfClubName.trim() ? round.courseName.split(' → ') : []} courseHoleNumbers={round.routeHoles?.map((hole) => hole.hole_number)} />
      </div>

      {isClubModalOpen && <ClubModal
        clubs={clubs}
        onClose={() => setIsClubModalOpen(false)}
        onSave={saveClubBag}
      />}

      {dialog}
      {entryInfoPopup}
      {resultNotice}
    </div>
  )
}
