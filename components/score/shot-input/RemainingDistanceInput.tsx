'use client'

import { palette } from '@/utils/theme'
import { DistanceStepper } from './parts'
import type { RoundApi } from '@/hooks/useRound'
import type { KeyboardEvent } from 'react'

/** 샷 후 남은 거리 입력과 계산 비거리. */
export default function RemainingDistanceInput({ isOb, r, disabled, step, onKeyDownDistance, fineAdjustment, previewOnly }: { isOb: boolean; r: RoundApi; disabled: boolean; step: number; onKeyDownDistance: (e: KeyboardEvent<HTMLInputElement>) => void; fineAdjustment: boolean; previewOnly: boolean }) {
  return (
    <>
      {/* 샷 후 남은 거리 (한 줄) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3px',
          backgroundColor: isOb ? palette.slate50 : palette.blue50,
          border: isOb ? `1.5px solid ${palette.slate300}` : `2px solid ${palette.blue400}`,
          borderRadius: '10px',
          padding: '5px 6px',
          marginBottom: '5px',
          opacity: isOb ? 0.55 : 1,
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: isOb ? palette.red700 : palette.blue900, whiteSpace: 'nowrap', textAlign: 'center' }}>
          {isOb ? '📍 원위치 유지' : '📍 남은 거리 📍'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '5px' }}>
          <DistanceStepper
            value={isOb ? r.currentPrevDistance : r.remainingDistance}
            onChange={r.changeRemaining}
            disabled={disabled || isOb}
            step={step}
            onKeyDown={onKeyDownDistance}
            name="샷 후 남은 거리"
            emphasized
            fineAdjustment={fineAdjustment}
            placeholder={previewOnly ? '-' : undefined}
          />
          <button
            type="button"
            disabled={disabled || isOb}
            aria-pressed={r.isPinOver}
            onClick={() => r.setIsPinOver(!r.isPinOver)}
            style={{
              minHeight: '32px',
              padding: '3px 7px',
              fontSize: '11px',
              borderRadius: '8px',
              border: r.isPinOver ? `1px solid ${palette.amber600}` : `1px solid ${palette.blue300}`,
              backgroundColor: r.isPinOver ? palette.amber500 : palette.white,
              color: r.isPinOver ? palette.white : palette.blue700,
              fontWeight: 'bold',
              cursor: isOb ? 'not-allowed' : 'pointer',
            }}
          >
            핀 오버
          </button>
        </div>
      </div>

      {/* 계산 비거리 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          backgroundColor: r.isPinOver ? palette.amber100 : palette.green50,
          border: r.isPinOver ? `1.5px solid ${palette.amber500}` : `1.5px solid ${palette.green300}`,
          borderRadius: '10px',
          padding: '3px 8px',
          marginBottom: '5px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', minWidth: 0 }}>
          <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: r.isPinOver ? palette.amber800 : palette.green800, whiteSpace: 'nowrap' }}>🎯 계산 비거리</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: r.isPinOver ? palette.amber700 : palette.green700, whiteSpace: 'nowrap' }}>
            {previewOnly ? '-' : `${isOb ? 0 : r.calculatedShotDistance}m`}
          </span>
          <span style={{ fontSize: '10.5px', color: palette.slate500, whiteSpace: 'nowrap' }}>({r.selectedClub})</span>
        </div>
      </div>

    </>
  )
}
