import type { TrophyItem } from './myTypes'
import { GOLF_LEVELS } from './myRecords'
import { CARD, muted } from './myStyles'
import { color, palette } from '@/utils/theme'

interface TrophySectionProps {
  trophies: TrophyItem[]
  earnedTrophies: TrophyItem[]
  achievementRoundCount: number
  currentLevel: number
  currentLevelIndex: number
  nextLevel: (typeof GOLF_LEVELS)[number] | undefined
  levelProgress: number
  achievementsError: string | null
  achievementsLoading: boolean
  /** 인정 라운드를 확인하지 못했을 때 */
  eligibilityError: boolean
}

export default function TrophySection({ trophies, earnedTrophies, achievementRoundCount, currentLevel, currentLevelIndex, nextLevel, levelProgress, achievementsError, achievementsLoading, eligibilityError }: TrophySectionProps) {
  return (
    <section style={{ ...CARD, borderColor: palette.emerald200, background: `linear-gradient(180deg,${palette.green50},${palette.white} 48%)` }} aria-labelledby="trophy-collection-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start', flexWrap: 'wrap' }}>
        <div>
          <h2 id="trophy-collection-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>🏆 레벨 & 트로피 컬렉션</h2>
          <p style={{ ...muted, margin: 0 }}>등록 후 시간 검증을 통과한 라운드만 레벨과 트로피에 반영됩니다. MY에서 언제든 확인할 수 있습니다.</p>
        </div>
        <strong style={{ color: color.brand, fontSize: 12 }}>🏅 {earnedTrophies.length} / {trophies.length} 획득</strong>
      </div>
      <div style={{ marginTop: 14, padding: 14, borderRadius: 12, color: palette.white, background: `linear-gradient(120deg,${palette.emerald900},${color.brand})` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <div><div style={{ color: palette.emerald200, fontSize: 11, fontWeight: 700 }}>MY GOLF LEVEL</div><strong style={{ display: 'block', marginTop: 3, fontSize: 20 }}>Lv.{currentLevel} · {currentLevelIndex >= 0 ? GOLF_LEVELS[currentLevelIndex].label : '첫 라운드 전'}</strong></div>
          <div style={{ textAlign: 'right', fontSize: 12 }}>{achievementRoundCount}회 인정</div>
        </div>
        <div role="progressbar" aria-label="다음 레벨 진행도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={levelProgress} style={{ height: 8, marginTop: 11, overflow: 'hidden', borderRadius: 99, background: palette.whiteA25 }}><div style={{ height: '100%', width: `${levelProgress}%`, borderRadius: 99, background: palette.amber200, transition: 'width .25s ease' }} /></div>
        <p style={{ margin: '6px 0 0', color: palette.emerald100, fontSize: 11 }}>{nextLevel ? `다음 레벨까지 ${Math.max(0, nextLevel.rounds - achievementRoundCount)}회 · ${nextLevel.label}` : '최고 레벨에 도달했어요. 새로운 기록 트로피에 도전해 보세요!'}</p>
      </div>
      {achievementsError && <p role="status" style={{ ...muted, color: palette.amber700, margin: '10px 0 0' }}>{achievementsError} 다시 불러오면 획득 여부가 갱신됩니다.</p>}
      {eligibilityError && <p role="alert" style={{ ...muted, color: palette.red700, margin: '10px 0 0' }}>기록 검증 결과를 불러오지 못해 레벨과 트로피를 잠시 표시할 수 없습니다.</p>}
      {achievementsLoading && <p role="status" style={{ ...muted, margin: '10px 0 0' }}>홀·샷 기록으로 트로피를 확인하고 있습니다…</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,210px),1fr))', gap: 8, marginTop: 12 }}>
        {trophies.map((trophy) => <article key={trophy.id} style={{ minWidth: 0, padding: 10, display: 'flex', gap: 9, alignItems: 'center', border: `1px solid ${trophy.earned ? palette.emerald200 : palette.slate200}`, borderRadius: 10, background: trophy.earned ? palette.green50 : palette.slate50, opacity: trophy.earned ? 1 : .82 }}>
          <span aria-hidden="true" style={{ flex: '0 0 34px', width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 10, background: trophy.earned ? palette.green100 : palette.slate200, fontSize: 19, filter: trophy.earned ? 'none' : 'grayscale(1)' }}>{trophy.earned ? trophy.icon : '🔒'}</span>
          <div style={{ minWidth: 0, flex: 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, alignItems: 'center' }}><strong style={{ color: palette.slate900, fontSize: 12 }}>{trophy.title}</strong><span style={{ color: palette.slate500, fontSize: 9, whiteSpace: 'nowrap' }}>{trophy.category}</span></div><p style={{ margin: '3px 0', color: palette.slate600, fontSize: 10, lineHeight: 1.4 }}>{trophy.description}</p><span style={{ color: trophy.earned ? color.brand : palette.slate500, fontSize: 10, fontWeight: 700 }}>{trophy.earned ? '획득 · ' : '진행 · '}{trophy.evidence}</span></div>
        </article>)}
      </div>
      <p style={{ ...muted, margin: '10px 0 0', fontSize: 10 }}>재미를 위한 개인 기록 배지이며 핸디캡이나 공식 자격에 영향을 주지 않습니다. 9홀 라운드도 기록 가능한 항목에 반영됩니다.</p>
    </section>
  )
}
