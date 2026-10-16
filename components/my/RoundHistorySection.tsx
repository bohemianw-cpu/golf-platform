import type { RoundIntegritySummary, RoundSummary } from './myTypes'
import { formatDate, integrityLabel, roundLocation } from './myRecords'
import { CARD, muted } from './myStyles'
import { color, palette } from '@/utils/theme'

interface RoundHistorySectionProps {
  rounds: RoundSummary[]
  integrityByRound: Record<string, RoundIntegritySummary>
  openRound: (round: RoundSummary) => Promise<void>
  exportHistory: () => Promise<void>
  exporting: boolean
  /** 서버에 있는 전체 라운드 수. 모르면 null */
  totalRounds: number | null
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

export default function RoundHistorySection({ rounds, integrityByRound, openRound, exportHistory, exporting, totalRounds, hasMore, loadingMore, onLoadMore }: RoundHistorySectionProps) {
  const total = totalRounds ?? rounds.length
  return (
    <section style={CARD} aria-labelledby="history-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2 id="history-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>📚 내 라운드 전체 기록 ({total})</h2>
          <p style={{ ...muted, margin: 0 }}>서버에 저장된 라운드를 최신순으로 표시합니다.</p>
        </div>
        <button type="button" onClick={exportHistory} disabled={exporting || total === 0} style={{ padding: '9px 12px', borderRadius: '8px', border: `1px solid ${palette.slate300}`, background: palette.white, color: palette.slate700, fontWeight: 700, cursor: exporting || total === 0 ? 'not-allowed' : 'pointer' }}>{exporting ? '내보내는 중…' : '전체 기록 JSON 내보내기'}</button>
      </div>
      {rounds.length === 0 ? <p style={{ ...muted, marginBottom: 0 }}>아직 서버에 저장된 라운드가 없습니다. Score 탭에서 첫 라운드를 기록해 보세요.</p> : (
        <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
          {rounds.map((round) => <button key={round.id} type="button" onClick={() => void openRound(round)} style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', textAlign: 'left', border: `1px solid ${palette.slate200}`, borderRadius: '10px', background: palette.white, cursor: 'pointer' }}>
            <span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', color: palette.slate900, fontSize: '13px' }}>{roundLocation(round)}</strong><span style={{ display: 'block', marginTop: '4px', color: palette.slate500, fontSize: '11px', overflowWrap: 'anywhere' }}>{formatDate(round.created_at)} · {round.course_name || '코스 미입력'} · {round.tee_name ? `${round.tee_name} · ` : ''}{round.play_mode === 'field' ? '필드' : round.play_mode === 'screen' ? `스크린${round.screen_provider ? ` · ${round.screen_provider}` : ''}` : '방식 미설정'}</span></span>
            <span style={{ textAlign: 'right', maxWidth: '45%', overflowWrap: 'anywhere' }}><strong style={{ display: 'block', color: round.total_score == null ? palette.slate500 : color.brand, fontSize: '17px' }}>{round.total_score == null ? '진행 중' : `${round.total_score}타`}</strong><span style={{ display: 'block', fontSize: '10px', color: palette.slate500 }}>{round.registered_at ? '등록 완료 · 수정 불가' : round.status === 'completed' ? integrityLabel(integrityByRound[round.id]) : '기록 이어하기 가능'}</span></span>
          </button>)}
          {hasMore && <button type="button" onClick={onLoadMore} disabled={loadingMore} style={{ padding: '10px', borderRadius: '10px', border: `1px dashed ${palette.slate300}`, background: palette.slate50, color: palette.slate700, fontWeight: 700, cursor: loadingMore ? 'wait' : 'pointer' }}>{loadingMore ? '불러오는 중…' : `이전 기록 더 보기 (${rounds.length} / ${total})`}</button>}
        </div>
      )}
    </section>
  )
}
