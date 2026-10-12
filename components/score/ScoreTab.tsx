'use client'

import React, { useCallback, useState } from 'react'
import type { ClubItem } from '@/types/golf'
import ClubModal from './ClubModal'
import RoundReport from './RoundReport'
import ShotInputCard from './ShotInputCard'
import ShotComparison from './ShotComparison'
import ClubStatsTable from './ClubStatsTable'
import Scorecard from './Scorecard'
import { useChoiceDialog } from './ConfirmDialog'
import { useRound } from '@/hooks/useRound'
import { DEFAULT_CLUBS, sortClubs } from '@/utils/golf/clubs'
import CourseCatalogPicker, { type GolfCourseOption, type GolfRouteOption } from './CourseCatalogPicker'

// 기존 import 경로 호환 (ClubModal 등에서 './ScoreTab'으로 가져오던 것)
export { sortClubs } from '@/utils/golf/clubs'

const statLabel: React.CSSProperties = { fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap' }
const statValue: React.CSSProperties = { fontSize: '19px', fontWeight: 'bold' }
const statSub: React.CSSProperties = { fontSize: '10px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap' }

export default function ScoreTab() {
  const { choose, confirm, dialog } = useChoiceDialog()
  const [clubs, setClubs] = useState<ClubItem[]>(() => sortClubs(DEFAULT_CLUBS))
  const [isClubModalOpen, setIsClubModalOpen] = useState(false)
  const [isCourseSearchOpen, setIsCourseSearchOpen] = useState(false)
  const [courseSearchQuery, setCourseSearchQuery] = useState('')
  const [selectedCatalogCourse, setSelectedCatalogCourse] = useState<GolfCourseOption | null>(null)

  const round = useRound(clubs, { choose, confirm })
  const { completedHoles, currentHole, currentPar, currentShots, currentPrevDistance, summary, isRoundComplete, isSaving, saveError } = round
  const { setCourseId, setGolfClubName, setCourseName, playMode, setPlayMode, configureCourseRoutes } = round
  const handleCourseSelect = useCallback((course: GolfCourseOption | null) => {
    setIsCourseSearchOpen(false)
    setCourseSearchQuery('')
    setSelectedCatalogCourse(course)
    setCourseId(course?.id ?? null)
    setGolfClubName(course?.name ?? '')
    setCourseName('')
    configureCourseRoutes([], null, null)
    if (course && playMode && !(playMode === 'field' ? course.supports_field : course.supports_screen)) setPlayMode(null)
  }, [setCourseId, setGolfClubName, setCourseName, configureCourseRoutes, playMode, setPlayMode])
  const handleCourseResolved = useCallback((course: GolfCourseOption | null) => setSelectedCatalogCourse(course), [])
  const handleRoutesChange = useCallback((routes: GolfRouteOption[], teeCode: string | null, teeName: string | null) => {
    configureCourseRoutes(routes, teeCode, teeName)
  }, [configureCourseRoutes])

  if (round.showRoundReport) {
    return (
      <>
        <RoundReport
          completedHoles={completedHoles}
          holePars={round.holePars}
          clubs={clubs}
          currentCcName={round.golfClubName.trim() || undefined}
          onBackToScore={() => round.setShowRoundReport(false)}
          onStartNewRound={round.startNewRound}
        />
        {dialog}
      </>
    )
  }

  const { totalDiff } = summary
  const modeSupported = !selectedCatalogCourse || (round.playMode === 'field'
    ? selectedCatalogCourse.supports_field
    : selectedCatalogCourse.supports_screen)
  const hasCompleteCourseLayout = [9, 18].includes(round.routeDistances.length)
  const diffText = completedHoles.length === 0 || totalDiff === 0 ? '0' : totalDiff > 0 ? `+${totalDiff}` : `${totalDiff}`
  const previousHole = completedHoles.find((h) => h.holeNumber === currentHole - 1)

  return (
    <div style={{ padding: '16px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      {/* 상단 헤더: 골프장/코스 이름 + 클럽 설정 */}
      <div
        style={{
          padding: '12px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '12px',
        }}
      >
        {/* 1줄: 골프장 이름 + 코스 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>⛳</span>
          <input
            id="course-catalog-search"
            type="search"
            role="combobox"
            aria-label="골프장 이름 검색"
            aria-autocomplete="list"
            aria-controls="course-catalog-results"
            aria-expanded={isCourseSearchOpen && courseSearchQuery.trim().length >= 1}
            autoComplete="off"
            value={isCourseSearchOpen ? courseSearchQuery : round.golfClubName}
            placeholder="골프장 미지정"
            disabled={!!round.currentRoundId || completedHoles.length > 0 || currentShots.length > 0}
            onFocus={() => { setIsCourseSearchOpen(true); setCourseSearchQuery(round.golfClubName) }}
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
            onBlur={() => window.setTimeout(() => setIsCourseSearchOpen(false), 120)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setIsCourseSearchOpen(false)
                setCourseSearchQuery(round.golfClubName)
              }
            }}
            style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '8px 10px', borderRadius: '6px', border: '1.5px solid #047857', fontWeight: 'bold', fontSize: '13.5px', color: round.golfClubName ? '#0f172a' : '#64748b', backgroundColor: '#ffffff', textAlign: 'left' }}
          />
          <input
            type="text"
            value={round.courseName}
            onChange={(e) => round.setCourseName(e.target.value)}
            readOnly={!!round.courseId || !!round.currentRoundId}
            placeholder="코스"
            aria-label="코스"
            style={{ width: '84px', flexShrink: 0, boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#475569', textAlign: 'center', backgroundColor: '#ffffff' }}
          />
        </div>
        <CourseCatalogPicker
          courseId={round.courseId}
          routeIds={round.routeIds}
          teeCode={round.teeCode}
          locked={!!round.currentRoundId || completedHoles.length > 0 || currentShots.length > 0}
          searchOpen={isCourseSearchOpen}
          onSearchOpenChange={setIsCourseSearchOpen}
          searchQuery={courseSearchQuery}
          onSearchQueryChange={setCourseSearchQuery}
          onCourseSelect={handleCourseSelect}
          onCourseResolved={handleCourseResolved}
          onRoutesChange={handleRoutesChange}
        />

        <fieldset style={{ margin: '10px 0 0', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff' }}>
          <legend style={{ padding: '0 4px', fontSize: '11px', fontWeight: 700, color: '#334155' }}>이번 라운드 방식 (필수)</legend>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {(['field', 'screen'] as const).filter((mode) => !selectedCatalogCourse || (mode === 'field' ? selectedCatalogCourse.supports_field : selectedCatalogCourse.supports_screen)).map((mode) => (
              <label key={mode} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="round-play-mode"
                  value={mode}
                  checked={round.playMode === mode}
                  onChange={() => round.setPlayMode(mode)}
                  disabled={!!round.playMode && (!!round.currentRoundId || completedHoles.length > 0 || currentShots.length > 0)}
                />
                {mode === 'field' ? '필드' : '스크린'}
              </label>
            ))}
          </div>
          {(round.currentRoundId || completedHoles.length > 0 || currentShots.length > 0) && (
            <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#64748b' }}>라운드 기록이 시작되어 방식을 변경할 수 없습니다.</p>
          )}
        </fieldset>

        {/* 2줄: 저장 상태 + 버튼 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px' }}>
          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', minHeight: '16px' }}>
            {isSaving ? '● 저장중...' : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {(round.currentRoundId || completedHoles.length > 0) && (
              <button
                onClick={round.resetCurrentRound}
                disabled={isSaving}
                title="진행 중인 라운드 삭제"
                style={{ padding: '7px 11px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1 }}
              >
                🗑️ 초기화
              </button>
            )}
            <button
              onClick={() => setIsClubModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', backgroundColor: '#047857', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              <span>🎒 클럽 설정</span>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.25)', padding: '1px 6px', borderRadius: '10px', fontSize: '11px' }}>{clubs.length}</span>
            </button>
          </div>
        </div>
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

      {/* 핵심 지표 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '14px 6px',
          borderRadius: '12px',
          marginBottom: '16px',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ padding: '2px' }}>
          <div style={statLabel}>진행 홀</div>
          <div style={{ ...statValue, color: '#38bdf8' }}>{currentHole}H</div>
        </div>
        <div style={{ padding: '2px', borderLeft: '1px solid #1e293b' }}>
          <div style={statLabel}>기준파 대비</div>
          <div style={{ ...statValue, color: totalDiff <= 0 ? '#4ade80' : '#f87171' }}>{diffText}</div>
        </div>
        <div style={{ padding: '2px', borderLeft: '1px solid #1e293b' }}>
          <div style={statLabel}>페어웨이 안착률</div>
          <div style={{ ...statValue, color: '#34d399' }}>{summary.fwPercent}%</div>
          <div style={statSub}>({summary.fwHit}/{summary.fwEligible})</div>
        </div>
        <div style={{ padding: '2px', borderLeft: '1px solid #1e293b' }}>
          <div style={statLabel}>그린 적중률</div>
          <div style={{ ...statValue, color: '#fbbf24' }}>{summary.girPercent}%</div>
          <div style={statSub}>({summary.girCount}/{completedHoles.length})</div>
        </div>
      </div>

      {!isRoundComplete && round.playMode && hasCompleteCourseLayout && round.currentGreenOptions.length > 1 && (
        <fieldset style={{ margin: '0 0 12px', padding: '8px 10px', border: '1px solid #93c5fd', borderRadius: '10px', background: '#eff6ff' }}>
          <legend style={{ padding: '0 4px', fontSize: '11px', fontWeight: 700, color: '#1d4ed8' }}>현재 홀 그린 선택</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {round.currentGreenOptions.map((green) => <label key={green.green_code} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#1e3a8a' }}>
              <input type="radio" name={`green-hole-${currentHole}`} checked={round.currentGreenCode === green.green_code} disabled={currentShots.length > 0 || completedHoles.some((hole) => hole.holeNumber === currentHole)} onChange={() => round.changeGreen(green.green_code, green.green_name, green.distance_m)} />
              {green.green_name} · {green.distance_m}m
            </label>)}
          </div>
          <p style={{ margin: '5px 0 0', fontSize: '10px', color: '#475569' }}>그 홀 첫 샷을 입력하기 전까지 변경할 수 있습니다.</p>
        </fieldset>
      )}

      {/* 샷 입력 / 라운드 완료 */}
      {isRoundComplete ? (
        <div style={{ backgroundColor: '#ecfdf5', border: '1.5px solid #86efac', borderRadius: '12px', padding: '18px 16px', marginBottom: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#166534', marginBottom: '4px' }}>라운드가 끝났습니다</div>
          <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '14px' }}>리포트를 보거나 마지막 홀을 수정할 수 있어요.</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => round.setShowRoundReport(true)} style={{ padding: '10px 14px', backgroundColor: '#047857', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
              리포트 보기
            </button>
            <button onClick={round.undoPreviousHole} disabled={isSaving} style={{ padding: '10px 14px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              {completedHoles.length}번 홀 수정
            </button>
            <button onClick={round.startNewRound} style={{ padding: '10px 14px', backgroundColor: '#ffffff', color: '#047857', border: '1px solid #86efac', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
              새 라운드 시작
            </button>
          </div>
        </div>
      ) : round.playMode && modeSupported && (!round.courseId || hasCompleteCourseLayout) ? (
        <ShotInputCard round={round} clubs={clubs} />
      ) : (
        <div role="status" style={{ padding: '24px 16px', marginBottom: '16px', border: '1px dashed #94a3b8', borderRadius: '12px', background: '#fff', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
          {!round.playMode ? '라운드 방식을 선택하면 스코어와 샷을 입력할 수 있습니다.' : !modeSupported ? '선택한 구장이 지원하는 필드/스크린 방식을 확인해 주세요.' : '검증된 코스의 9홀 또는 18홀 코스와 티를 선택하면 스코어를 입력할 수 있습니다.'}
        </div>
      )}

      <ShotComparison
        previousHole={previousHole}
        currentHole={currentHole}
        currentPar={currentPar}
        currentShots={currentShots}
        currentPrevDistance={currentPrevDistance}
      />

      <ClubStatsTable clubs={clubs} clubStats={round.clubStatsAll} clubApproach={round.clubApproach} />

      <Scorecard holePars={round.holePars} completedHoles={completedHoles} routeNames={round.courseName.split(' → ')} />

      <ClubModal
        clubs={clubs}
        isOpen={isClubModalOpen}
        onClose={() => setIsClubModalOpen(false)}
        onSave={(updated) => setClubs(sortClubs(updated))}
      />

      {dialog}
    </div>
  )
}
