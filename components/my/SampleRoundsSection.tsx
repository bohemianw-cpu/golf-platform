import type { HoleRecord, ShotRecord } from '@/types/golf'
import type { SampleRoundSession } from './myTypes'
import { formatDate } from './myRecords'
import { CARD, muted } from './myStyles'
import { palette } from '@/utils/theme'

interface SampleRoundsSectionProps {
  sampleSessions: SampleRoundSession[]
  selectedSample: SampleRoundSession | null
  setSelectedSample: (sample: SampleRoundSession | null) => void
  startSample: () => Promise<void>
  startingSample: boolean
  onStartSample: ((id: string) => void) | undefined
}

export default function SampleRoundsSection({ sampleSessions, selectedSample, setSelectedSample, startSample, startingSample, onStartSample }: SampleRoundsSectionProps) {
  return (
    <section style={{ ...CARD, borderColor: palette.blue300, background: palette.blue50 }} aria-labelledby="sample-round-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div><h2 id="sample-round-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>🧪 샘플 샷 입력</h2><p style={{ ...muted, color: palette.slate600, margin: 0 }}>가상으로 입력해 볼 수 있습니다. 실제 라운드 평균·클럽 분석·배지·트로피에서는 제외됩니다.</p></div>
        <button type="button" onClick={() => void startSample()} disabled={startingSample || !onStartSample} style={{ padding: '10px 14px', border: 0, borderRadius: '8px', background: palette.blue700, color: palette.white, fontWeight: 700, cursor: startingSample ? 'wait' : 'pointer' }}>{startingSample ? '준비 중…' : '샘플 입력 시작'}</button>
      </div>
      <div style={{ display: 'grid', gap: '6px', marginTop: '10px' }}>
        {sampleSessions.map((sample) => {
          const payload = sample.payload ?? {}
          const holes = Array.isArray(payload.completedHoles) ? payload.completedHoles as HoleRecord[] : []
          const club = typeof payload.golfClubName === 'string' && payload.golfClubName ? payload.golfClubName : '구장 미선택'
          return <button key={sample.id} type="button" onClick={() => setSelectedSample(sample)} style={{ width: '100%', padding: '10px 12px', textAlign: 'left', border: `1px solid ${palette.blue200}`, borderRadius: '8px', background: palette.white, cursor: 'pointer' }}><strong style={{ color: palette.blue900, fontSize: '12px' }}>{club}</strong><span style={{ display: 'block', color: palette.slate500, fontSize: '10px', marginTop: 3 }}>{formatDate(sample.updated_at)} · 완료 {holes.length}홀 · 샘플</span></button>
        })}
      </div>
      {selectedSample && <div style={{ marginTop: 10, padding: 12, background: palette.white, border: `1px solid ${palette.blue200}`, borderRadius: 9 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: 12 }}>{String(selectedSample.payload?.golfClubName || '샘플 기록')} · {String(selectedSample.payload?.courseName || '')}</strong><button type="button" onClick={() => setSelectedSample(null)} style={{ border: 0, background: 'transparent', color: palette.slate500 }}>닫기</button></div>
        {(Array.isArray(selectedSample.payload?.completedHoles) ? selectedSample.payload?.completedHoles as HoleRecord[] : []).map((hole) => <div key={hole.holeNumber} style={{ padding: '8px 0', borderBottom: `1px solid ${palette.slate200}`, fontSize: 11 }}><strong>{hole.holeNumber}번 홀 · Par {hole.par} · {hole.score}타</strong><div style={{ color: palette.slate500, marginTop: 3 }}>{hole.shots.map((shot) => `${shot.shotNumber}타 ${shot.club} ${shot.shotDistance}m (${shot.ballLie})`).join(' · ')}</div></div>)}
        {Array.isArray(selectedSample.payload?.currentShots) && (selectedSample.payload.currentShots as ShotRecord[]).length > 0 && <div style={{ padding: '8px 0', fontSize: 11 }}><strong>진행 중 · {String(selectedSample.payload?.currentHole ?? '')}번 홀</strong><div style={{ color: palette.slate500, marginTop: 3 }}>{(selectedSample.payload.currentShots as ShotRecord[]).map((shot) => `${shot.shotNumber}타 ${shot.club} ${shot.shotDistance}m (${shot.ballLie})`).join(' · ')}</div></div>}
        <p style={{ ...muted, margin: '8px 0 0' }}>샘플 기록은 모든 실제 평균과 배지·트로피에서 제외됩니다.</p>
      </div>}
    </section>
  )
}
