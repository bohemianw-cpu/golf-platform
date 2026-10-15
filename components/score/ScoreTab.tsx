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

// 기존 import 경로 호환 (ClubModal 등에서 './ScoreTab'으로 가져오던 것)
export { sortClubs } from '@/utils/golf/clubs'

const SCORE_GUIDE_SEEN_KEY = 'golf-score-guide-seen:'
const SCREEN_ROUNDS_ENABLED = false
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
  const entryInfoPopup = showEntryInfo ? <div role="dialog" aria-modal="true" aria-labelledby="shot-flow-notice-title" style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(15,23,42,.58)', display: 'grid', placeItems: 'center', padding: 18 }}><section style={{ width: 'min(100%,420px)', padding: 20, borderRadius: 14, background: '#fff', boxShadow: '0 18px 48px rgba(15,23,42,.25)' }}><h2 id="shot-flow-notice-title" style={{ margin: '0 0 9px', fontSize: 17 }}>샷 기록 안내</h2><p style={{ margin: 0, color: '#475569', fontSize: 13, lineHeight: 1.7 }}>샘플 입력은 MY 탭에서 시작하며 가상 기록으로 저장되어 실제 평균과 배지·트로피에 반영되지 않습니다. 실제 샷 기록만 정식 라운드로 저장됩니다.</p><p style={{ margin: '8px 0 16px', color: '#92400e', fontSize: 12, lineHeight: 1.6 }}>실제 기록은 유료 이용 대상이며, 현재 포인트 결제·차감 기능은 준비 중이라 지금은 포인트가 차감되지 않습니다.</p><button type="button" onClick={closeEntryInfo} style={{ width: '100%', padding: 10, border: 0, borderRadius: 8, background: '#047857', color: '#fff', fontWeight: 700 }}>확인</button></section></div> : null
  const resultNotice = round.holeResultNotice ? (() => {
    const notice = round.holeResultNotice
    const resultColor = notice.scoreDiff < 0 ? '#047857' : notice.scoreDiff > 0 ? '#c2410c' : '#2563eb'
    const resultTint = notice.scoreDiff < 0 ? '#ecfdf5' : notice.scoreDiff > 0 ? '#fff7ed' : '#eff6ff'
    const scoreLabel = notice.scoreDiff === 0 ? '기준 파' : `${notice.scoreDiff > 0 ? '+' : ''}${notice.scoreDiff}`
    return <div role="dialog" aria-modal="true" aria-labelledby="hole-result-title" style={{ position: 'fixed', inset: 0, zIndex: 130, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(15,23,42,.62)', backdropFilter: 'blur(3px)' }}>
      <section style={{ width: 'min(100%,360px)', overflow: 'hidden', borderRadius: 20, background: '#fff', boxShadow: '0 24px 70px rgba(15,23,42,.3)' }}>
        <div style={{ padding: '20px 20px 17px', textAlign: 'center', background: `linear-gradient(145deg, ${resultTint}, #fff 78%)` }}>
          <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700, letterSpacing: '.08em' }}>HOLE {notice.holeNumber} · PAR {notice.par}</div>
          <h2 id="hole-result-title" style={{ margin: '8px 0 12px', color: resultColor, fontSize: 30, lineHeight: 1.15, fontWeight: 900 }}>{notice.label}</h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderRadius: 999, background: '#fff', border: `1px solid ${resultColor}33`, color: '#334155', fontSize: 13 }}>
            <span>타수 <strong style={{ color: '#0f172a', fontSize: 17 }}>{notice.score}</strong></span><span aria-hidden="true" style={{ color: '#cbd5e1' }}>·</span><span style={{ color: resultColor, fontWeight: 800 }}>{scoreLabel}</span>
          </div>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <button type="button" onClick={() => { round.dismissHoleResultNotice(); void round.undoPreviousHole(true) }} style={{ flex: '0 0 30%', padding: '8px 4px', border: '1px solid #cbd5e1', borderRadius: 11, background: '#f8fafc', color: '#475569', fontSize: 10, fontWeight: 700, lineHeight: 1.35, cursor: 'pointer' }}>
              <span style={{ display: 'block' }}>↶ 직전 샷</span><span style={{ display: 'block' }}>취소</span>
            </button>
            <button type="button" autoFocus onClick={round.dismissHoleResultNotice} style={{ flex: 1, padding: '13px 10px', border: 0, borderRadius: 11, background: '#047857', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 10px rgba(4,120,87,.2)' }}>
              {notice.isFinalHole ? '라운드 리포트 보기' : '다음 홀로 이동'}
            </button>
          </div>
        </div>
      </section>
    </div>
  })() : null
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
    return <div role={clubBagError ? 'alert' : 'status'} style={{ margin: '24px auto', padding: '20px 16px', maxWidth: 440, textAlign: 'center', color: '#475569' }}>
      <p>{clubBagError ?? '클럽 설정을 불러오는 중입니다.'}</p>
      {clubBagError && <button type="button" onClick={() => { setClubBagLoaded(false); setClubBagError(null); setClubBagLoadAttempt((count) => count + 1) }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>다시 시도</button>}
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
        {round.isSample && onExitSample && <button type="button" onClick={onExitSample} style={{ position: 'fixed', left: 12, bottom: bottomNavVisible ? 74 : 12, zIndex: 60, padding: '8px 11px', border: '1px solid #93c5fd', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}>샘플 종료</button>}
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
      {round.isSample && <div role="status" style={{ marginBottom: 10, padding: '9px 12px', border: '1px solid #93c5fd', borderRadius: 9, background: '#eff6ff', color: '#1e40af', fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><span>샘플 입력 중 · 평균·배지·트로피 제외</span><button type="button" onClick={onExitSample} style={{ border: 0, background: 'transparent', color: '#1d4ed8', fontWeight: 700 }}>종료</button></div>}
      {/* 상단 헤더: 골프장/코스 이름 */}
      <div
        data-score-guide-target="course"
        style={{
          padding: '12px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '12px',
        }}
      >
        {!courseInfoLocked && <fieldset data-score-guide-target="play-mode" style={{ margin: '0 0 10px', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff' }}>
          <legend style={{ padding: '0 4px', fontSize: '11px', fontWeight: 700, color: '#334155' }}>이번 라운드 방식 (필드 자동선택)</legend>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {(['field', 'screen'] as const).map((mode) => (
              <label key={mode} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: mode === 'screen' ? '#94a3b8' : '#334155', cursor: courseInfoLocked || (mode === 'screen' && !SCREEN_ROUNDS_ENABLED) ? 'not-allowed' : 'pointer' }}>
                <input
                  type="radio"
                  name="round-play-mode"
                  value={mode}
                  checked={playMode === mode}
                  disabled={courseInfoLocked || round.isRegistered || (mode === 'screen' && !SCREEN_ROUNDS_ENABLED)}
                  onChange={() => {
                    if (mode === 'screen' && !SCREEN_ROUNDS_ENABLED) return
                    if (mode === playMode) return
                    handleCourseSelect(null)
                    round.setScreenProvider(null)
                    setPlayMode(mode)
                  }}
                />
                {mode === 'field' ? '필드' : '스크린 (협의중)'}
              </label>
            ))}
          </div>
          {playMode === 'screen' && (
            <div style={{ marginTop: 8 }}>
              <label htmlFor="round-screen-provider" style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 700, color: '#334155' }}>스크린 서비스 (필수)</label>
              <select
                id="round-screen-provider"
                value={round.screenProvider ?? ''}
                disabled={courseInfoLocked || round.isRegistered || screenProviders.length === 0}
                onChange={(event) => {
                  handleCourseSelect(null)
                  round.setScreenProvider(event.target.value || null)
                }}
                style={{ width: '100%', padding: '7px 8px', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff', color: '#334155', fontSize: 12 }}
              >
                <option value="">{screenProvidersLoading ? '서비스 목록 불러오는 중…' : '스크린 서비스를 선택해 주세요'}</option>
                {screenProviders.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
              </select>
              {screenProvidersError && <p role="alert" style={{ margin: '5px 0 0', fontSize: 10, color: '#b91c1c' }}>스크린 서비스 목록을 불러오지 못했습니다.</p>}
              {!screenProvidersLoading && !screenProvidersError && screenProviders.length === 0 && <p role="status" style={{ margin: '5px 0 0', fontSize: 10, color: '#64748b' }}>검증된 스크린 코스 거리 자료가 아직 없습니다.</p>}
            </div>
          )}
        </fieldset>}
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
            style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '8px 10px', borderRadius: '6px', border: '1.5px solid #047857', fontWeight: 'bold', fontSize: '13.5px', color: round.golfClubName ? '#0f172a' : '#64748b', backgroundColor: '#ffffff', textAlign: 'left' }}
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
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', marginBottom: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#b91c1c', fontSize: '12.5px' }}
        >
          <span>{saveError}</span>
          <button
            onClick={round.retrySync}
            disabled={isSaving}
            style={{ flexShrink: 0, padding: '6px 10px', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            다시 시도
          </button>
        </div>
      )}

      {!showShotCard && <RoundMetrics round={round} standalone />}

      {!isRoundComplete && round.playMode && hasCompleteCourseLayout && round.currentGreenOptions.length > 1 && (
        <fieldset style={{ margin: '0 0 12px', padding: '8px 10px', border: '1px solid #93c5fd', borderRadius: '10px', background: '#eff6ff' }}>
          <legend style={{ padding: '0 4px', fontSize: '11px', fontWeight: 700, color: '#1d4ed8' }}>{new Set(round.currentGreenOptions.map((option) => option.par ?? round.currentPar)).size > 1 ? '현재 홀 기준 파·티 위치 선택' : round.currentGreenOptions.some((option) => option.green_name.toLowerCase().startsWith('white tee')) ? '현재 홀 WHITE 티 위치 선택' : '현재 홀 그린 선택'}</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {round.currentGreenOptions.map((green) => <label key={green.green_code} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#1e3a8a' }}>
              <input type="radio" name={`green-hole-${currentHole}`} checked={round.currentGreenCode === green.green_code} disabled={round.isRegistered || currentShots.length > 0 || completedHoles.some((hole) => hole.holeNumber === currentHole)} onChange={() => round.changeGreen(green.green_code, green.green_name, green.distance_m, green.par)} />
              {green.green_name} · {green.distance_m}m
            </label>)}
          </div>
          <p style={{ margin: '5px 0 0', fontSize: '10px', color: '#475569' }}>{new Set(round.currentGreenOptions.map((option) => option.par ?? round.currentPar)).size > 1 ? '선택한 구성에 따라 기준 파와 거리가 함께 바뀝니다. 그 홀 첫 샷 전까지 변경할 수 있습니다.' : '그 홀 첫 샷을 입력하기 전까지 변경할 수 있습니다.'}</p>
        </fieldset>
      )}

      {/* 샷 입력 / 라운드 완료 */}
      <div data-score-guide-target="shot-entry">
      {isRoundComplete ? (
        <div style={{ backgroundColor: '#ecfdf5', border: '1.5px solid #86efac', borderRadius: '12px', padding: '18px 16px', marginBottom: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#166534', marginBottom: '4px' }}>라운드가 끝났습니다</div>
          <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '14px' }}>{round.isRegistered ? '등록된 스코어는 수정할 수 없습니다.' : '리포트를 보거나 마지막 홀을 수정할 수 있어요.'}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => round.setShowRoundReport(true)} style={{ padding: '10px 14px', backgroundColor: '#047857', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
              리포트 보기
            </button>
            {!round.isRegistered && <button onClick={() => void round.undoPreviousHole()} disabled={isSaving} style={{ padding: '10px 14px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              {completedHoles.length}번 홀 수정
            </button>}
            {(round.isRegistered || round.isSample) && <button onClick={round.startNewRound} style={{ padding: '10px 14px', backgroundColor: '#ffffff', color: '#047857', border: '1px solid #86efac', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
              새 라운드 시작
            </button>}
          </div>
        </div>
      ) : showShotCard ? (
        <ShotInputCard round={round} clubs={clubs} onOpenClubSettings={() => setIsClubModalOpen(true)} disabled={!courseInfoLocked} onDisabledClick={requestRoundStart} />
      ) : (
        <div role="status" style={{ padding: '24px 16px', marginBottom: '16px', border: '1px dashed #94a3b8', borderRadius: '12px', background: '#fff', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
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
