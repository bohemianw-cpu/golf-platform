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
import type { GolfCourseOption } from './CourseCatalogPicker'
import { createClient, getSignedInUser } from '@/utils/supabase/client'
import { palette } from '@/utils/theme'
import ShotFlowNotice from './score-tab/ShotFlowNotice'
import HoleResultDialog from './score-tab/HoleResultDialog'
import GreenSelector from './score-tab/GreenSelector'
import RoundCompletePanel from './score-tab/RoundCompletePanel'
import CourseHeader from './score-tab/CourseHeader'
import { useScoreGuide } from '@/hooks/score/useScoreGuide'
import { useScreenProviders } from '@/hooks/score/useScreenProviders'
import { useOnlineStatus } from '@/components/layout/useOnlineStatus'

// 기존 import 경로 호환 (ClubModal 등에서 './ScoreTab'으로 가져오던 것)
export { sortClubs } from '@/utils/golf/clubs'

const CLUB_CATEGORIES = new Set(['driver', 'wood', 'utility', 'iron', 'wedge', 'putter'])

const isSavedClubBag = (value: unknown): value is ClubItem[] =>
  Array.isArray(value) && value.length <= MAX_CLUBS && value.every((item) =>
    item !== null && typeof item === 'object' &&
    typeof item.id === 'string' && typeof item.name === 'string' &&
    CLUB_CATEGORIES.has(item.category) &&
    (item.preferredApproach === undefined || typeof item.preferredApproach === 'boolean'),
  )

// 연결이 없을 때 쓰도록 마지막으로 불러온 클럽 설정을 이 기기에 남겨 둔다.
const CLUB_BAG_COPY_KEY = 'golf-club-bag-copy:'
const readClubBagCopy = (userId: string): ClubItem[] | null => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(`${CLUB_BAG_COPY_KEY}${userId}`) ?? 'null')
    return isSavedClubBag(value) ? value : null
  } catch {
    return null
  }
}
const writeClubBagCopy = (userId: string, clubs: ClubItem[]) => {
  try { window.localStorage.setItem(`${CLUB_BAG_COPY_KEY}${userId}`, JSON.stringify(clubs)) } catch { /* Storage may be unavailable. */ }
}

export default function ScoreTab({ bottomNavVisible, sampleSessionId = null, onExitSample }: { bottomNavVisible: boolean; sampleSessionId?: string | null; onExitSample?: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const { choose, confirm, dialog } = useChoiceDialog()
  const [clubs, setClubs] = useState<ClubItem[]>(() => sortClubs(DEFAULT_CLUBS))
  const [clubBagUserId, setClubBagUserId] = useState<string | null>(null)
  const [clubBagLoaded, setClubBagLoaded] = useState(false)
  const [clubBagError, setClubBagError] = useState<string | null>(null)
  const [clubBagLoadAttempt, setClubBagLoadAttempt] = useState(0)
  const [isClubModalOpen, setIsClubModalOpen] = useState(false)
  const [selectedCatalogCourse, setSelectedCatalogCourse] = useState<GolfCourseOption | null>(null)
  const [showEntryInfo, setShowEntryInfo] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { user, error: authError } = await getSignedInUser(supabase)
        if (authError || !user) throw authError ?? new Error('로그인 정보가 없습니다.')
        const { data, error } = await supabase.from('user_club_bags')
          .select('clubs')
          .eq('user_id', user.id)
          .maybeSingle()
        let savedClubs: ClubItem[] | null
        if (error) {
          // 연결이 없으면 이 기기에 남겨 둔 마지막 클럽 설정으로 기록을 이어 간다.
          savedClubs = readClubBagCopy(user.id)
          if (!savedClubs) throw error
        } else {
          if (data && !isSavedClubBag(data.clubs)) throw new Error('저장된 클럽 설정 형식이 올바르지 않습니다.')
          savedClubs = data ? data.clubs : null
          // 서버에 저장한 적이 없으면 기본 클럽을 쓰므로, 사본도 기본 클럽으로 남긴다.
          writeClubBagCopy(user.id, savedClubs ?? DEFAULT_CLUBS)
        }
        if (cancelled) return
        setClubBagUserId(user.id)
        if (savedClubs) setClubs(sortClubs(savedClubs))
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
    writeClubBagCopy(clubBagUserId, nextClubs)
    setClubs(nextClubs)
  }, [clubBagUserId, supabase])

  const scoreGuide = useScoreGuide(supabase)
  const round = useRound(clubs, { choose, confirm }, sampleSessionId)
  const screenProviders = useScreenProviders(supabase, round.playMode)
  const online = useOnlineStatus()
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
  const requestRoundStart = useCallback(() => {
    void choose('코스와 티 정보를 선택한 뒤 라운드 시작을 눌러주세요.', [{ label: '확인', value: 'ok', tone: 'primary' }])
  }, [choose])

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
      {/* 상단 헤더: 라운드 방식, 골프장·코스·티 선택 */}
      <CourseHeader round={round} courseInfoLocked={courseInfoLocked} bottomNavVisible={bottomNavVisible} choose={choose} confirm={confirm} scoreGuide={scoreGuide} screenProviders={screenProviders} onCatalogCourseChange={setSelectedCatalogCourse} />

      {/* 연결이 끊기면 저장을 시도하기 전에 미리 알린다. 기록은 이 기기에 남고 연결되면 자동으로 다시 저장된다. */}
      {!online && (
        <div role="status" style={{ padding: '10px 14px', marginBottom: '12px', backgroundColor: palette.amber50, border: `1px solid ${palette.amber300}`, borderRadius: '10px', color: palette.amber800, fontSize: '12.5px' }}>
          📡 인터넷 연결이 끊겼어요. 입력한 기록은 이 기기에 보관되고, 연결되면 자동으로 서버에 저장돼요.
        </div>
      )}

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
