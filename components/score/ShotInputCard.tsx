'use client'

import React from 'react'
import type { ClubItem } from '@/types/golf'
import type { RoundApi } from '@/hooks/useRound'
import RoundMetrics from './RoundMetrics'
import { color, palette } from '@/utils/theme'
import ShotHoleHeader from './shot-input/ShotHoleHeader'
import ClubSelector from './shot-input/ClubSelector'
import BallLieSelector from './shot-input/BallLieSelector'
import RemainingDistanceInput from './shot-input/RemainingDistanceInput'
import QuickPuttRow from './shot-input/QuickPuttRow'

interface Props {
  round: RoundApi
  clubs: ClubItem[]
  onOpenClubSettings: () => void
  disabled?: boolean
  onDisabledClick?: () => void
}


export default function ShotInputCard({ round: r, clubs, onOpenClubSettings, disabled = false, onDisabledClick }: Props) {
  if (!r) {
    return (
      <div role="alert">
        라운드 정보를 전달받지 못했습니다.
      </div>
    )
  }

  const fineAdjustment = r.isPutterSelected || r.currentPrevDistance < 10 || r.remainingDistance < 10
  const previewOnly = disabled && !(r.routeDistances[r.currentHole - 1] > 0)
  const step = fineAdjustment ? 0.1 : r.isPutterOrGreen ? 1 : 5
  const isOb = r.selectedLie === 'OB'
  const onKeyDownDistance = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      r.changeRemaining(r.remainingDistance + step)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      r.changeRemaining(r.remainingDistance - step)
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: palette.white,
        borderRadius: '12px',
        border: `1px solid ${palette.slate200}`,
        overflow: 'hidden',
        marginBottom: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}
    >
      <RoundMetrics round={r} />
      <div style={{ padding: '8px 10px' }}>
      <ShotHoleHeader previewOnly={previewOnly} r={r} disabled={disabled} />
      <ClubSelector disabled={disabled} onOpenClubSettings={onOpenClubSettings} clubs={clubs} r={r} />
      <BallLieSelector r={r} disabled={disabled} />
      <RemainingDistanceInput isOb={isOb} r={r} disabled={disabled} step={step} onKeyDownDistance={onKeyDownDistance} fineAdjustment={fineAdjustment} previewOnly={previewOnly} />
      {/* 남은 거리 0m 저장은 자동으로 홀아웃 처리 */}
      <div style={{ marginBottom: '5px' }}>
        <button
          disabled={disabled}
          onClick={r.saveShot}
          style={{ width: '100%', minHeight: '38px', padding: '7px 8px', backgroundColor: r.remainingDistance === 0 && !isOb ? palette.red600 : color.brand, color: palette.white, border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}
        >
          {r.remainingDistance === 0 && !isOb ? '🏁 홀아웃 기록' : '✓ 샷 결과 저장'}
        </button>
      </div>

      <QuickPuttRow r={r} disabled={disabled} />
      {/* 서브 버튼 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
          <button
            type="button"
            onClick={r.undoPreviousShot}
            disabled={disabled || r.isSaving || (r.currentShots.length === 0 && r.completedHoles.length === 0)}
            title={r.currentShots.length === 0 ? '직전 홀의 마지막 샷 취소' : '현재 홀의 직전 샷 취소'}
            style={{ minWidth: 0, minHeight: '34px', padding: '6px 4px', backgroundColor: palette.slate100, color: palette.slate600, border: `1px solid ${palette.slate300}`, borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: r.isSaving || (r.currentShots.length === 0 && r.completedHoles.length === 0) ? 'not-allowed' : 'pointer', opacity: r.isSaving || (r.currentShots.length === 0 && r.completedHoles.length === 0) ? 0.5 : 1 }}
          >
            ↩ 직전 샷 취소
          </button>
          <button
            type="button"
            onClick={r.redoLastShot}
            disabled={disabled || !r.canRedoLastShot || r.isSaving}
            style={{ minWidth: 0, minHeight: '34px', padding: '6px 4px', backgroundColor: r.canRedoLastShot ? palette.emerald50 : palette.slate100, color: r.canRedoLastShot ? color.brand : palette.slate400, border: `1px solid ${palette.slate300}`, borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: r.canRedoLastShot && !r.isSaving ? 'pointer' : 'not-allowed' }}
          >
            ↪ 삭제한 샷 복원
          </button>
      </div>
      </div>
      {disabled && <button type="button" onClick={onDisabledClick} aria-label="코스와 티 정보를 선택한 뒤 라운드 시작을 눌러주세요." style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 0, backgroundColor: 'rgba(248,250,252,0.58)', cursor: 'pointer', zIndex: 1 }} />}
    </div>
  )
}
