'use client'

import { GOLF_LEVEL_GROUPS } from '@/utils/golf/levels'
import { CARD, muted } from './myStyles'
import { color } from '@/utils/theme'
import type { GolfLevelGroup } from '@/utils/golf/levels'

/** 완료 라운드 수, 평균·베스트 스코어, 비교 그룹 요약. */
/** completedRoundCount가 null이면 요약을 불러오지 못한 것이다. */
export default function SummaryStatsSection({ completedRoundCount, averageScore, bestScore, currentGroup }: { completedRoundCount: number | null; averageScore: number | null; bestScore: number | null; currentGroup: GolfLevelGroup }) {
  const unavailable = completedRoundCount == null
  return (
    <>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px' }} aria-label="요약 통계">
        {[
          ['완료 라운드', unavailable ? '불러오지 못함' : `${completedRoundCount}회`],
          ['평균 스코어', unavailable ? '불러오지 못함' : averageScore == null ? '기록 없음' : `${averageScore.toFixed(1)}타`],
          ['베스트 스코어', unavailable ? '불러오지 못함' : bestScore == null ? '기록 없음' : `${bestScore}타`],
          ['비교 그룹', GOLF_LEVEL_GROUPS[currentGroup].label],
        ].map(([label, value]) => <div key={label} style={CARD}><div style={muted}>{label}</div><strong style={{ display: 'block', marginTop: '7px', color: color.brand, fontSize: '20px' }}>{value}</strong></div>)}
      </section>
    </>
  )
}
