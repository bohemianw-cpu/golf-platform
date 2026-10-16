'use client'

import { palette } from '@/utils/theme'
import { MAX_GOLF_PAR, MIN_GOLF_PAR } from '@/utils/golf/scoring'
import { DistanceStepper } from './parts'
import type { RoundApi } from '@/hooks/useRound'

/** 홀 안내(파·홀 거리)와 현재 핀까지 거리·추천 클럽. */
export default function ShotHoleHeader({ previewOnly, r, disabled }: { previewOnly: boolean; r: RoundApi; disabled: boolean }) {
  return (
    <>
      {/* 홀 안내 + 기준 파/거리 (한 줄) */}
      <div style={{ paddingBottom: '5px', borderBottom: `1px solid ${palette.slate100}`, marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <select
            value={previewOnly ? '' : r.currentPar}
            onChange={(e) => r.changeHolePar(r.currentHole - 1, Number(e.target.value))}
            disabled={disabled || r.isRegistered}
            aria-label="기준 파"
            style={{ height: '32px', padding: '0 4px', borderRadius: '8px', border: `1px solid ${palette.slate300}`, fontSize: '13px', fontWeight: 'bold', color: palette.slate900, flexShrink: 0, backgroundColor: r.isRegistered ? palette.slate100 : palette.white }}
          >
            {previewOnly && <option value="">Par -</option>}
            {Array.from({ length: MAX_GOLF_PAR - MIN_GOLF_PAR + 1 }, (_, index) => MIN_GOLF_PAR + index).map((p) => (
              <option key={p} value={p}>
                Par {p}
              </option>
            ))}
          </select>
          <DistanceStepper value={r.holeDistance} onChange={r.changeHoleDistance} name="홀 거리" disabled={disabled || r.isRegistered || r.currentShots.length > 0} placeholder={previewOnly ? '-' : undefined} />
        </div>
      </div>

      {/* 현재 핀까지 + 추천 클럽 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          backgroundColor: palette.green50,
          border: `1.5px solid ${palette.green300}`,
          borderRadius: '10px',
          padding: '4px 8px',
          marginBottom: '5px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: palette.green800, whiteSpace: 'nowrap' }}>🚩 현재 핀까지</span>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: palette.green700, whiteSpace: 'nowrap' }}>{previewOnly ? '-' : `${r.currentPrevDistance}m`}</span>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: palette.white,
            padding: '3px 9px',
            borderRadius: '20px',
            border: `1px solid ${palette.green200}`,
            fontSize: '11.5px',
            fontWeight: 'bold',
            color: palette.green800,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: palette.emerald600 }}>💡 추천:</span>
          <span>{previewOnly ? '-' : r.recommendedClub}</span>
        </div>
      </div>

    </>
  )
}
