'use client'

import { palette } from '@/utils/theme'
import type { RoundApi } from '@/hooks/useRound'

/** 직전 샷이 그린에 올랐을 때 퍼트 수를 한 번에 입력. */
export default function QuickPuttRow({ r, disabled }: { r: RoundApi; disabled: boolean }) {
  return (
    <>
      {/* 퍼트 빠른 입력: 직전 샷이 그린에 올랐을 때만 노출 */}
      {r.isOnGreen && (
        <div style={{ marginBottom: '5px', padding: '6px', backgroundColor: palette.green50, border: `1.5px solid ${palette.green300}`, borderRadius: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: palette.green800, marginBottom: '4px' }}>
            ⛳ 퍼트 한 번에 입력 <span style={{ fontWeight: 'normal', color: palette.slate500 }}>(누르면 바로 홀아웃)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                disabled={disabled}
                onClick={() => r.quickPutt(n)}
                style={{ height: '32px', borderRadius: '8px', border: `1px solid ${palette.green300}`, backgroundColor: palette.white, color: palette.green700, fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {n}퍼트
              </button>
            ))}
          </div>
          <p style={{ margin: '5px 0 0', fontSize: '10px', lineHeight: 1.3, color: palette.slate600 }}>
            한 번에 입력하면 남은 거리를 퍼트 횟수로 나눠 추정합니다. 정확한 접근율 계산을 위해 각 퍼트 후 남은 거리를 직접 입력해 주세요.
          </p>
        </div>
      )}

    </>
  )
}
