'use client'

import { color, palette } from '@/utils/theme'
import type { RoundApi } from '@/hooks/useRound'
import type { HoleRecord } from '@/types/golf'

/** 마지막 홀을 마친 뒤 리포트 보기·홀 수정·새 라운드 시작을 고르는 안내. */
export default function RoundCompletePanel({ round, isSaving, completedHoles }: { round: RoundApi; isSaving: boolean; completedHoles: HoleRecord[] }) {
  return (
    <>
      <div style={{ backgroundColor: palette.emerald50, border: `1.5px solid ${palette.green300}`, borderRadius: '12px', padding: '18px 16px', marginBottom: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: palette.green800, marginBottom: '4px' }}>라운드가 끝났습니다</div>
        <div style={{ fontSize: '12.5px', color: palette.slate600, marginBottom: '14px' }}>{round.isRegistered ? '등록된 스코어는 수정할 수 없습니다.' : '리포트를 보거나 마지막 홀을 수정할 수 있어요.'}</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => round.setShowRoundReport(true)} style={{ padding: '10px 14px', backgroundColor: color.brand, color: palette.white, border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            리포트 보기
          </button>
          {!round.isRegistered && <button onClick={() => void round.undoPreviousHole()} disabled={isSaving} style={{ padding: '10px 14px', backgroundColor: palette.white, color: palette.slate600, border: `1px solid ${palette.slate300}`, borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            {completedHoles.length}번 홀 수정
          </button>}
          {(round.isRegistered || round.isSample) && <button onClick={round.startNewRound} style={{ padding: '10px 14px', backgroundColor: palette.white, color: color.brand, border: `1px solid ${palette.green300}`, borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
            새 라운드 시작
          </button>}
        </div>
      </div>
    </>
  )
}
