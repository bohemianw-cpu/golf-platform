export interface HoleResultNotice {
  holeNumber: number
  par: number
  score: number
  scoreDiff: number
  label: string
  isFinalHole: boolean
}

export function getHoleResultLabel(score: number, par: number): string {
  if (score === 1) return '홀인원'
  const diff = score - par
  if (diff <= -5) return '오스트리치'
  if (diff === -4) return '콘도르'
  if (diff === -3) return '알바트로스'
  if (diff === -2) return '이글'
  if (diff === -1) return '버디'
  if (diff === 0) return '파'
  if (score >= par * 2 || diff >= 5) return '더블파'
  if (diff === 1) return '보기'
  if (diff === 2) return '더블보기'
  if (diff === 3) return '트리플보기'
  return '쿼트러플보기'
}
