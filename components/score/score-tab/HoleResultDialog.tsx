'use client'

import type { HoleResultNotice, RoundApi } from '@/hooks/useRound'
import { color, palette } from '@/utils/theme'
import { useModalKeyboard } from '@/components/layout/useModalKeyboard'

/** 홀아웃 직후 홀 결과(버디·파 등)와 다음 행동을 보여 주는 창. */
export default function HoleResultDialog({ round, notice }: { round: RoundApi; notice: HoleResultNotice }) {
  const resultColor = notice.scoreDiff < 0 ? color.brand : notice.scoreDiff > 0 ? palette.orange700 : palette.blue600
  const resultTint = notice.scoreDiff < 0 ? palette.emerald50 : notice.scoreDiff > 0 ? palette.orange50 : palette.blue50
  const dialogRef = useModalKeyboard<HTMLDivElement>(true, round.dismissHoleResultNotice)
  const scoreLabel = notice.scoreDiff === 0 ? '기준 파' : `${notice.scoreDiff > 0 ? '+' : ''}${notice.scoreDiff}`
  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="hole-result-title" style={{ position: 'fixed', inset: 0, zIndex: 130, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(15,23,42,.62)', backdropFilter: 'blur(3px)' }}>
    <section style={{ width: 'min(100%,360px)', overflow: 'hidden', borderRadius: 20, background: palette.white, boxShadow: '0 24px 70px rgba(15,23,42,.3)' }}>
      <div style={{ padding: '20px 20px 17px', textAlign: 'center', background: `linear-gradient(145deg, ${resultTint}, ${palette.white} 78%)` }}>
        <div style={{ color: palette.slate500, fontSize: 12, fontWeight: 700, letterSpacing: '.08em' }}>HOLE {notice.holeNumber} · PAR {notice.par}</div>
        <h2 id="hole-result-title" style={{ margin: '8px 0 12px', color: resultColor, fontSize: 30, lineHeight: 1.15, fontWeight: 900 }}>{notice.label}</h2>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderRadius: 999, background: palette.white, border: `1px solid ${resultColor}33`, color: palette.slate700, fontSize: 13 }}>
          <span>타수 <strong style={{ color: palette.slate900, fontSize: 17 }}>{notice.score}</strong></span><span aria-hidden="true" style={{ color: palette.slate300 }}>·</span><span style={{ color: resultColor, fontWeight: 800 }}>{scoreLabel}</span>
        </div>
      </div>
      <div style={{ padding: '0 18px 18px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <button type="button" onClick={() => { round.dismissHoleResultNotice(); void round.undoPreviousHole(true) }} style={{ flex: '0 0 30%', padding: '8px 4px', border: `1px solid ${palette.slate300}`, borderRadius: 11, background: palette.slate50, color: palette.slate600, fontSize: 10, fontWeight: 700, lineHeight: 1.35, cursor: 'pointer' }}>
            <span style={{ display: 'block' }}>↶ 직전 샷</span><span style={{ display: 'block' }}>취소</span>
          </button>
          <button type="button" autoFocus onClick={round.dismissHoleResultNotice} style={{ flex: 1, padding: '13px 10px', border: 0, borderRadius: 11, background: color.brand, color: palette.white, fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 10px rgba(4,120,87,.2)' }}>
            {notice.isFinalHole ? '라운드 리포트 보기' : '다음 홀로 이동'}
          </button>
        </div>
      </div>
    </section>
  </div>
}
