'use client'

import { palette } from '@/utils/theme'
import { getPenaltyByLie } from '@/utils/golf/scoring'
import { BALL_LIE_OPTIONS } from './parts'
import type { RoundApi } from '@/hooks/useRound'

/** 샷 후 볼이 멈춘 위치 선택. */
export default function BallLieSelector({ r, disabled }: { r: RoundApi; disabled: boolean }) {
  return (
    <>
      {/* 볼 위치 */}
      <div style={{ marginBottom: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: palette.slate800 }}>📍 볼이 멈춘 위치</span>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: palette.blue600 }}>
            {r.selectedLie} {getPenaltyByLie(r.selectedLie) > 0 && `(+${getPenaltyByLie(r.selectedLie)}벌타)`}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '3px' }}>
          {BALL_LIE_OPTIONS.map((item) => {
            const on = r.selectedLie === item.lie
            return (
              <button
                key={item.lie}
                disabled={disabled}
                title={item.label}
                aria-label={`${item.label}${item.badge ? ` ${item.badge}` : ''}`}
                onClick={() => r.setSelectedLie(item.lie)}
                style={{
                  height: '38px',
                  borderRadius: '6px',
                  border: on ? `1.5px solid ${palette.blue600}` : `1px solid ${palette.slate300}`,
                  backgroundColor: on ? palette.blue50 : palette.white,
                  color: on ? palette.blue600 : item.color,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 2px',
                  lineHeight: 1.15,
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: on ? 'bold' : 600, whiteSpace: 'nowrap' }}>{item.compactLabel ?? item.label}</span>
                {item.badge && <span style={{ fontSize: '8px', color: palette.red600, fontWeight: 'bold' }}>{item.badge}</span>}
              </button>
            )
          })}
        </div>
      </div>

    </>
  )
}
