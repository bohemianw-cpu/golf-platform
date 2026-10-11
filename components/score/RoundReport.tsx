'use client'

import type { CSSProperties } from 'react'
import type { ClubItem, HoleRecord } from '@/types/golf'

interface RoundReportProps {
  completedHoles?: HoleRecord[]
  holePars?: number[]
  clubs?: ClubItem[]
  currentCcName?: string
  onBackToScore?: () => void
  onStartNewRound?: () => void
}

const card: CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }
const muted: CSSProperties = { color: '#64748b', fontSize: '12px', lineHeight: 1.6 }

export default function RoundReport({ completedHoles = [], currentCcName, onBackToScore, onStartNewRound }: RoundReportProps) {
  const holes = completedHoles
  const totalScore = holes.reduce((sum, hole) => sum + hole.score, 0)
  const totalPar = holes.reduce((sum, hole) => sum + hole.par, 0)
  const totalPutts = holes.reduce((sum, hole) => sum + hole.putts, 0)
  const fairwayHoles = holes.filter((hole) => hole.fairwayHit !== null)
  const fairwayHits = fairwayHoles.filter((hole) => hole.fairwayHit).length
  const girHits = holes.filter((hole) => hole.gir).length
  const shots = holes.flatMap((hole) => hole.shots)
  const penalties = shots.reduce((sum, shot) => sum + shot.penalty, 0)
  const driverShots = shots.filter((shot) => shot.club === '드라이버' && shot.shotNumber === 1 && shot.shotDistance > 0)
  const averageDriverDistance = driverShots.length
    ? Math.round(driverShots.reduce((sum, shot) => sum + shot.shotDistance, 0) / driverShots.length)
    : null
  const puttsPerHole = holes.length ? totalPutts / holes.length : null
  const practiceSuggestions = [
    ...(puttsPerHole != null && puttsPerHole > 2 ? ['홀당 퍼트가 2개를 넘었습니다. 1~2m 거리의 방향·거리감 퍼팅을 10개씩 나눠 연습해 보세요.'] : []),
    ...(fairwayHoles.length >= 4 && fairwayHits / fairwayHoles.length < 0.45 ? ['페어웨이 안착률이 낮았습니다. 다음 연습에서는 드라이버 방향성부터 점검하고, 안전한 티샷 클럽도 함께 비교해 보세요.'] : []),
    ...(holes.length >= 9 && girHits / holes.length < 0.25 ? ['GIR이 낮았습니다. 핀을 직접 노리기보다 다음 샷을 치기 쉬운 넓은 구역을 겨냥하는 코스 매니지먼트를 연습해 보세요.'] : []),
    ...(penalties >= 2 ? ['벌타가 여러 번 기록됐습니다. 다음 라운드에서 벌타가 난 홀과 샷 상황을 확인하고, 위험 구역을 피하는 목표 지점을 정해 보세요.'] : []),
  ]

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '16px', display: 'grid', gap: '12px' }}>
      <header style={{ ...card, background: 'linear-gradient(120deg,#052e2b,#064e3b)', color: '#fff' }}>
        <p style={{ margin: '0 0 4px', color: '#a7f3d0', fontSize: '11px', fontWeight: 800, letterSpacing: '.1em' }}>ROUND REPORT</p>
        <h1 style={{ margin: '0 0 5px', fontSize: '22px' }}>{currentCcName || '라운드'} 분석</h1>
        <p style={{ margin: 0, color: '#d1fae5', fontSize: '12px' }}>저장된 {holes.length}홀과 샷 기록만으로 계산했습니다. 비교 표본이 없는 통계나 예상 수치는 표시하지 않습니다.</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '8px' }} aria-label="라운드 요약">
        {[
          ['스코어', holes.length ? `${totalScore}타` : '기록 없음', holes.length ? `${totalScore - totalPar >= 0 ? '+' : ''}${totalScore - totalPar} · Par ${totalPar}` : '완료된 홀이 없습니다'],
          ['퍼트', holes.length ? `${totalPutts}개` : '기록 없음', puttsPerHole == null ? '—' : `홀당 ${puttsPerHole.toFixed(2)}개`],
          ['페어웨이', fairwayHoles.length ? `${Math.round(fairwayHits / fairwayHoles.length * 100)}%` : '기록 없음', `${fairwayHits}/${fairwayHoles.length} 기회`],
          ['GIR', holes.length ? `${Math.round(girHits / holes.length * 100)}%` : '기록 없음', `${girHits}/${holes.length}홀`],
          ['벌타', `${penalties}개`, averageDriverDistance == null ? '드라이버 거리 기록 없음' : `드라이버 평균 ${averageDriverDistance}m`],
        ].map(([label, value, detail]) => <article key={label} style={card}><div style={muted}>{label}</div><strong style={{ display: 'block', margin: '5px 0', color: '#047857', fontSize: '20px' }}>{value}</strong><div style={muted}>{detail}</div></article>)}
      </section>

      <section style={card} aria-labelledby="report-holes-title">
        <h2 id="report-holes-title" style={{ margin: '0 0 10px', fontSize: '16px' }}>홀별 기록과 샷</h2>
        {holes.length === 0 ? <p style={muted}>저장된 홀 기록이 없습니다.</p> : <div style={{ display: 'grid', gap: '8px' }}>
          {holes.map((hole) => <article key={hole.holeNumber} style={{ border: '1px solid #e2e8f0', borderRadius: '9px', padding: '10px', background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}><strong>{hole.holeNumber}번 홀 · Par {hole.par}</strong><span>{hole.score}타 · 퍼트 {hole.putts} · {hole.gir ? 'GIR' : 'GIR 미달'}</span></div>
            <ol style={{ margin: '7px 0 0', paddingLeft: '20px', display: 'grid', gap: '4px', color: '#475569', fontSize: '11px' }}>
              {hole.shots.map((shot) => <li key={`${hole.holeNumber}-${shot.shotNumber}`}>{shot.club} · {shot.shotDistance}m · {shot.ballLie}{shot.penalty ? ` · 벌타 ${shot.penalty}` : ''}</li>)}
              {hole.shots.length === 0 && <li style={{ color: '#94a3b8' }}>샷 상세가 저장되지 않았습니다.</li>}
            </ol>
          </article>)}
        </div>}
      </section>

      <section style={{ ...card, borderColor: '#bbf7d0', background: '#f0fdf4' }} aria-labelledby="practice-title">
        <h2 id="practice-title" style={{ margin: '0 0 7px', fontSize: '16px' }}>다음 연습 제안</h2>
        {practiceSuggestions.length ? <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '7px', color: '#166534', fontSize: '12px', lineHeight: 1.6 }}>{practiceSuggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul> : <p style={{ ...muted, margin: 0 }}>현재 입력된 데이터에서 우선 보완 항목이 뚜렷하지 않습니다. 라운드와 샷이 더 쌓이면 개인 기록의 변화에 맞춘 제안을 보여드릴게요.</p>}
        <p style={{ ...muted, margin: '8px 0 0', fontSize: '10px' }}>기록 기반의 연습 아이디어이며, 레슨 전문가의 진단을 대체하지 않습니다.</p>
      </section>

      <footer style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {onBackToScore && <button type="button" onClick={onBackToScore} style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>스코어로 돌아가기</button>}
        {onStartNewRound && <button type="button" onClick={onStartNewRound} style={{ padding: '10px 14px', border: 0, borderRadius: '8px', background: '#047857', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>새 라운드 시작</button>}
      </footer>
    </main>
  )
}
