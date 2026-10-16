'use client'

import { useCallback, useState } from 'react'
import type { RoundApi } from '@/hooks/useRound'
import type { ScoreGuideState } from '@/hooks/score/useScoreGuide'
import type { ScreenProvidersState } from '@/hooks/score/useScreenProviders'
import type { ChooseFn } from '../ConfirmDialog'
import CourseCatalogPicker, { type GolfCourseOption, type GolfRouteOption } from '../CourseCatalogPicker'
import ScoreGuideTour from '@/components/onboarding/ScoreGuideTour'
import { color, palette } from '@/utils/theme'
import PlayModeSelector from './PlayModeSelector'

interface Props {
  round: RoundApi
  courseInfoLocked: boolean
  bottomNavVisible: boolean
  choose: ChooseFn
  confirm: (message: string, okLabel?: string, tone?: 'primary' | 'danger') => Promise<boolean>
  scoreGuide: ScoreGuideState
  screenProviders: ScreenProvidersState
  /** 고른 골프장이 바뀌면 알린다. 필드·스크린 지원 여부 확인에 쓴다. */
  onCatalogCourseChange: (course: GolfCourseOption | null) => void
}

/**
 * 스코어 탭 상단 헤더: 라운드 방식, 골프장 검색, 코스·티 선택, 라운드 시작·초기화.
 * 검색창이 열렸는지와 검색어는 이 헤더 안에서만 쓰므로 여기서 관리한다.
 */
export default function CourseHeader({ round, courseInfoLocked, bottomNavVisible, choose, confirm, scoreGuide, screenProviders, onCatalogCourseChange }: Props) {
  const [isCourseSearchOpen, setIsCourseSearchOpen] = useState(false)
  const [courseSearchQuery, setCourseSearchQuery] = useState('')
  const { setCourseId, setGolfClubName, setCourseName, playMode, setPlayMode, configureCourseRoutes, isSaving } = round

  const requestCourseFirst = useCallback(() => {
    void choose('골프장을 먼저 선택해 주세요.', [{ label: '확인', value: 'ok', tone: 'primary' }])
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
      onCatalogCourseChange(null)
      setCourseSearchQuery('')
      setIsCourseSearchOpen(false)
    }
  }, [confirm, round, onCatalogCourseChange])
  const handleCourseSelect = useCallback((course: GolfCourseOption | null) => {
    setIsCourseSearchOpen(false)
    setCourseSearchQuery('')
    onCatalogCourseChange(course)
    setCourseId(course?.id ?? null)
    setGolfClubName(course?.name ?? '')
    setCourseName('')
    configureCourseRoutes([], null, null)
  }, [onCatalogCourseChange, setCourseId, setGolfClubName, setCourseName, configureCourseRoutes])
  const handleRoutesChange = useCallback((routes: GolfRouteOption[], teeCode: string | null, teeName: string | null) => {
    configureCourseRoutes(routes, teeCode, teeName)
  }, [configureCourseRoutes])

  return (
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
      <PlayModeSelector courseInfoLocked={courseInfoLocked} playMode={playMode} round={round} handleCourseSelect={handleCourseSelect} setPlayMode={setPlayMode} screenProviders={screenProviders.providers} screenProvidersLoading={screenProviders.loading} screenProvidersError={screenProviders.error} />
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
              onCatalogCourseChange(null)
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
              // 검색창의 기본 동작(입력값 지우기)이 목록을 다시 열지 않도록 막는다.
              event.preventDefault()
              setIsCourseSearchOpen(false)
              setCourseSearchQuery(round.golfClubName)
            }
          }}
          style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '8px 10px', borderRadius: '6px', border: `1.5px solid ${color.brand}`, fontWeight: 'bold', fontSize: '13.5px', color: round.golfClubName ? palette.slate900 : palette.slate500, backgroundColor: palette.white, textAlign: 'left' }}
        />
        <ScoreGuideTour
          enabled={scoreGuide.enabled}
          bottomNavVisible={bottomNavVisible}
          startAutomatically={scoreGuide.startAutomatically}
          onAutoStart={scoreGuide.markSeen}
          onComplete={scoreGuide.markSeen}
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
        onCourseResolved={onCatalogCourseChange}
        onRoutesChange={handleRoutesChange}
        onNeedCourse={requestCourseFirst}
        onStartRound={startRoundWithCourseLock}
        onUnlockCourse={unlockCourseAndClearShots}
        courseInfoLocked={courseInfoLocked}
        canUnlockCourse={!round.isRegistered && !!(round.golfClubName.trim() || round.routeIds.length > 0 || round.teeCode)}
        isSaving={isSaving}
      />
    </div>
  )
}
