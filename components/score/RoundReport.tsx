'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import type { ClubItem, HoleRecord } from '@/types/golf'
import { createClient, getSignedInUser } from '@/utils/supabase/client'
import { color, palette } from '@/utils/theme'

interface RoundReportProps {
  completedHoles?: HoleRecord[]
  holePars?: number[]
  courseHoleNumbers?: number[]
  clubs?: ClubItem[]
  currentCcName?: string
  roundId?: string | null
  onBackToScore?: () => void
  onStartNewRound?: () => void
  onUndoLastShot?: () => void
  onRegisterRound?: () => void
  isSample?: boolean
  isRegistered?: boolean
  isRegistering?: boolean
  saveError?: string | null
}

const card: CSSProperties = { background: palette.white, border: `1px solid ${palette.slate200}`, borderRadius: '12px', padding: '16px' }
const muted: CSSProperties = { color: palette.slate500, fontSize: '12px', lineHeight: 1.6 }
const suggestionCache = new Map<string, string[]>()
const suggestionRequests = new Map<string, Promise<string[]>>()

export default function RoundReport({ completedHoles = [], courseHoleNumbers, currentCcName, roundId, onBackToScore, onStartNewRound, onUndoLastShot, onRegisterRound, isSample = false, isRegistered = false, isRegistering = false, saveError }: RoundReportProps) {
  const holes = completedHoles
  const reportSnapshot = JSON.stringify(holes)
  const cacheKey = `${roundId ?? 'local'}:${reportSnapshot}`
  const [practiceSuggestions, setPracticeSuggestions] = useState<string[]>([])
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [suggestionAttempt, setSuggestionAttempt] = useState(0)
  const [aiAllowed, setAiAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    void (async () => {
      const { user } = await getSignedInUser(supabase)
      if (!user) { if (!cancelled) setAiAllowed(false); return }
      const { data, error } = await supabase.from('user_data_preferences')
        .select('allow_ai_practice_analysis').eq('user_id', user.id).maybeSingle()
      if (!cancelled) setAiAllowed(!error && data?.allow_ai_practice_analysis === true)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      if (isSample || aiAllowed !== true) {
        setSuggestionLoading(false)
        return
      }
      const reportHoles = JSON.parse(reportSnapshot) as HoleRecord[]
      const cached = suggestionCache.get(cacheKey)
      if (cached) {
        setPracticeSuggestions(cached)
        setSuggestionError(null)
        setSuggestionLoading(false)
        return
      }
      if (!reportHoles.some((hole) => hole.shots.length > 0)) {
        setPracticeSuggestions([])
        setSuggestionError(null)
        setSuggestionLoading(false)
        return
      }
      setPracticeSuggestions([])
      setSuggestionError(null)
      setSuggestionLoading(true)
      let pending = suggestionRequests.get(cacheKey)
      if (!pending) {
        pending = (async () => {
          const response = await fetch('/api/practice-suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundId, holes: reportHoles }),
          })
          const result = await response.json().catch(() => ({}))
          if (!response.ok || !Array.isArray(result.suggestions)) throw new Error(result.error || 'AI 연습 제안을 불러오지 못했습니다.')
          suggestionCache.set(cacheKey, result.suggestions)
          if (suggestionCache.size > 20) suggestionCache.delete(suggestionCache.keys().next().value!)
          return result.suggestions as string[]
        })()
        suggestionRequests.set(cacheKey, pending)
        void pending.then(() => suggestionRequests.delete(cacheKey), () => suggestionRequests.delete(cacheKey))
      }
      void pending.then(
        (suggestions) => { if (!cancelled) { setPracticeSuggestions(suggestions); setSuggestionLoading(false) } },
        (error) => { if (!cancelled) { setSuggestionError(error instanceof Error ? error.message : 'AI 연습 제안을 불러오지 못했습니다.'); setSuggestionLoading(false) } },
      )
    })()
    return () => { cancelled = true }
  }, [aiAllowed, cacheKey, reportSnapshot, roundId, suggestionAttempt, isSample])
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
  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '16px', display: 'grid', gap: '12px' }}>
      <header style={{ ...card, background: `linear-gradient(120deg,${palette.forest950},${palette.emerald900})`, color: palette.white }}>
        <p style={{ margin: '0 0 4px', color: palette.emerald200, fontSize: '11px', fontWeight: 800, letterSpacing: '.1em' }}>ROUND REPORT</p>
        <h1 style={{ margin: '0 0 5px', fontSize: '22px' }}>{currentCcName || '라운드'} 분석</h1>
        <p style={{ margin: 0, color: palette.emerald100, fontSize: '12px' }}>요약 통계는 이번 {holes.length}홀과 샷 기록으로 계산했습니다. 비교 표본이 없는 통계나 예상 수치는 표시하지 않습니다.</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '8px' }} aria-label="라운드 요약">
        {[
          ['스코어', holes.length ? `${totalScore}타` : '기록 없음', holes.length ? `${totalScore - totalPar >= 0 ? '+' : ''}${totalScore - totalPar} · Par ${totalPar}` : '완료된 홀이 없습니다'],
          ['퍼트', holes.length ? `${totalPutts}개` : '기록 없음', puttsPerHole == null ? '—' : `홀당 ${puttsPerHole.toFixed(2)}개`],
          ['페어웨이', fairwayHoles.length ? `${Math.round(fairwayHits / fairwayHoles.length * 100)}%` : '기록 없음', `${fairwayHits}/${fairwayHoles.length} 기회`],
          ['GIR', holes.length ? `${Math.round(girHits / holes.length * 100)}%` : '기록 없음', `${girHits}/${holes.length}홀`],
          ['벌타', `${penalties}개`, averageDriverDistance == null ? '드라이버 거리 기록 없음' : `드라이버 평균 ${averageDriverDistance}m`],
        ].map(([label, value, detail]) => <article key={label} style={card}><div style={muted}>{label}</div><strong style={{ display: 'block', margin: '5px 0', color: color.brand, fontSize: '20px' }}>{value}</strong><div style={muted}>{detail}</div></article>)}
      </section>

      <section style={card} aria-labelledby="report-holes-title">
        <h2 id="report-holes-title" style={{ margin: '0 0 10px', fontSize: '16px' }}>홀별 기록과 샷</h2>
        {holes.length === 0 ? <p style={muted}>저장된 홀 기록이 없습니다.</p> : <div style={{ display: 'grid', gap: '8px' }}>
          {holes.map((hole) => <article key={hole.holeNumber} style={{ border: `1px solid ${palette.slate200}`, borderRadius: '9px', padding: '10px', background: palette.slate50 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}><strong>{hole.holeNumber}번째 · 코스 {courseHoleNumbers?.[hole.holeNumber - 1] ?? hole.holeNumber}번 홀 · Par {hole.par}</strong><span>{hole.score}타 · 퍼트 {hole.putts} · {hole.gir ? 'GIR' : 'GIR 미달'}</span></div>
            <ol style={{ margin: '7px 0 0', paddingLeft: '20px', display: 'grid', gap: '4px', color: palette.slate600, fontSize: '11px' }}>
              {hole.shots.map((shot) => <li key={`${hole.holeNumber}-${shot.shotNumber}`}>{shot.club} · {shot.shotDistance}m · {shot.ballLie}{shot.penalty ? ` · 벌타 ${shot.penalty}` : ''}</li>)}
              {hole.shots.length === 0 && <li style={{ color: palette.slate400 }}>샷 상세가 저장되지 않았습니다.</li>}
            </ol>
          </article>)}
        </div>}
      </section>

      <section style={{ ...card, borderColor: palette.green200, background: palette.green50 }} aria-labelledby="practice-title">
        <h2 id="practice-title" style={{ margin: '0 0 7px', fontSize: '16px' }}>다음 연습 제안</h2>
        {isSample ? <p style={{ ...muted, margin: 0 }}>샘플 기록은 AI 연습 분석 대상에서 제외됩니다.</p>
          : aiAllowed === false ? <p style={{ ...muted, margin: 0 }}>AI 연습 제안을 받으려면 MY에서 선택 동의를 켜주세요.</p>
          : aiAllowed === null ? <p role="status" style={{ ...muted, margin: 0 }}>AI 분석 동의 상태를 확인하고 있습니다.</p>
          : suggestionLoading ? <p role="status" style={{ ...muted, margin: 0 }}>이번 라운드와 이전 샷 기록을 AI가 살펴보고 있습니다.</p>
          : suggestionError ? <div role="alert" style={{ ...muted, color: palette.red700 }}>{suggestionError} <button type="button" onClick={() => setSuggestionAttempt((value) => value + 1)} style={{ marginLeft: 6, padding: '4px 8px', border: `1px solid ${palette.slate300}`, borderRadius: 6, background: palette.white, cursor: 'pointer' }}>다시 시도</button></div>
            : practiceSuggestions.length ? <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '7px', color: palette.green800, fontSize: '12px', lineHeight: 1.6 }}>{practiceSuggestions.map((suggestion, index) => <li key={index}>{suggestion}</li>)}</ul>
              : <p style={{ ...muted, margin: 0 }}>샷 기록을 입력하면 AI가 다음 연습을 제안합니다.</p>}
        <p style={{ ...muted, margin: '8px 0 0', fontSize: '10px' }}>기록을 바탕으로 AI가 작성한 연습 아이디어입니다.</p>
      </section>

      <footer style={{ display: 'grid', gap: '8px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        {saveError && !isRegistered && <p role="alert" style={{ margin: 0, padding: '10px 12px', borderRadius: '8px', background: palette.red50, color: palette.red700, fontSize: '12px' }}>{saveError}</p>}
        {onUndoLastShot && !isRegistered && completedHoles.length > 0 && <button type="button" onClick={onUndoLastShot} disabled={isRegistering} style={{ padding: '10px 14px', border: `1px solid ${palette.red300}`, borderRadius: '8px', background: palette.rose50, color: palette.red700, fontWeight: 700, cursor: isRegistering ? 'wait' : 'pointer', opacity: isRegistering ? .55 : 1 }}>↶ 마지막 홀의 마지막 샷 취소</button>}
        {onRegisterRound && !isSample && !isRegistered && <button type="button" onClick={onRegisterRound} disabled={isRegistering} style={{ padding: '12px 14px', border: 0, borderRadius: '8px', background: isRegistering ? palette.slate400 : color.brand, color: palette.white, fontWeight: 700, cursor: isRegistering ? 'wait' : 'pointer' }}>{isRegistering ? '등록 처리 중…' : '스코어 등록 · 등록 후 수정 불가'}</button>}
        {isSample && <p style={{ ...muted, margin: 0, textAlign: 'center' }}>샘플 기록은 실제 통계·평균·트로피에 반영되지 않습니다.</p>}
        {isRegistered && <p role="status" style={{ ...muted, margin: 0, textAlign: 'center' }}>스코어 등록 완료 · 이 기록은 수정할 수 없습니다.</p>}
        {onBackToScore && !isRegistered && <button type="button" onClick={onBackToScore} style={{ padding: '10px 14px', border: `1px solid ${palette.slate300}`, borderRadius: '8px', background: palette.white, cursor: 'pointer' }}>스코어로 돌아가기</button>}
        {onStartNewRound && (isRegistered || isSample) && <button type="button" onClick={onStartNewRound} style={{ padding: '10px 14px', border: 0, borderRadius: '8px', background: color.brand, color: palette.white, fontWeight: 700, cursor: 'pointer' }}>새 라운드 시작</button>}
      </footer>
    </main>
  )
}
