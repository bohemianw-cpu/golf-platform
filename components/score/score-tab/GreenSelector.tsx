'use client'

import { palette } from '@/utils/theme'
import type { RoundApi } from '@/hooks/useRound'
import type { ShotRecord } from '@/types/golf'
import type { HoleRecord } from '@/types/golf'

/** 그린이 여러 개인 홀에서 이번 홀에 칠 그린을 고른다. */
export default function GreenSelector({ isRoundComplete, round, hasCompleteCourseLayout, currentHole, currentShots, completedHoles }: { isRoundComplete: boolean; round: RoundApi; hasCompleteCourseLayout: boolean; currentHole: number; currentShots: ShotRecord[]; completedHoles: HoleRecord[] }) {
  return (
    <>
      {!isRoundComplete && round.playMode && hasCompleteCourseLayout && round.currentGreenOptions.length > 1 && (
        <fieldset style={{ margin: '0 0 12px', padding: '8px 10px', border: `1px solid ${palette.blue300}`, borderRadius: '10px', background: palette.blue50 }}>
          <legend style={{ padding: '0 4px', fontSize: '11px', fontWeight: 700, color: palette.blue700 }}>{new Set(round.currentGreenOptions.map((option) => option.par ?? round.currentPar)).size > 1 ? '현재 홀 기준 파·티 위치 선택' : round.currentGreenOptions.some((option) => option.green_name.toLowerCase().startsWith('white tee')) ? '현재 홀 WHITE 티 위치 선택' : '현재 홀 그린 선택'}</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {round.currentGreenOptions.map((green) => <label key={green.green_code} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: palette.blue900 }}>
              <input type="radio" name={`green-hole-${currentHole}`} checked={round.currentGreenCode === green.green_code} disabled={round.isRegistered || currentShots.length > 0 || completedHoles.some((hole) => hole.holeNumber === currentHole)} onChange={() => round.changeGreen(green.green_code, green.green_name, green.distance_m, green.par)} />
              {green.green_name} · {green.distance_m}m
            </label>)}
          </div>
          <p style={{ margin: '5px 0 0', fontSize: '10px', color: palette.slate600 }}>{new Set(round.currentGreenOptions.map((option) => option.par ?? round.currentPar)).size > 1 ? '선택한 구성에 따라 기준 파와 거리가 함께 바뀝니다. 그 홀 첫 샷 전까지 변경할 수 있습니다.' : '그 홀 첫 샷을 입력하기 전까지 변경할 수 있습니다.'}</p>
        </fieldset>
      )}
    </>
  )
}
