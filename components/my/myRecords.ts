import type { HoleRecord, ShotRecord } from '@/types/golf'
import type { HoleRow, RoundIntegritySummary, RoundSummary, ShotRow, TrophyItem, TrophyStats } from './myTypes'

export const integrityLabel = (value?: RoundIntegritySummary) => {
  if (!value) return '시간 확인 자료 없음'
  if (value.status === 'time_plausible') return '소요시간 기준 통과 · 현장 미확인'
  if (value.status === 'review_required') return '기록 확인 필요'
  if (value.status === 'self_reported') return '자가 기록'
  return '기록 진행 중'
}

export const integrityReasonNames: Record<string, string> = {
  legacy_without_audit: '기존 기록이라 입력 시간 자료가 없음',
  backfilled: '지난 라운드 입력',
  incomplete_event_evidence: '홀·샷 입력 이력이 완전하지 않음',
  below_minimum_duration: '최저 소요시간보다 짧음',
  rapid_input: '짧은 시간에 많은 샷이 입력됨',
  post_completion_correction: '완료 후 기록 수정',
}

export const GOLF_LEVELS = [
  { rounds: 1, label: '첫 티샷' },
  { rounds: 3, label: '라운드 수집가' },
  { rounds: 5, label: '꾸준한 골퍼' },
  { rounds: 10, label: '코스 탐험가' },
  { rounds: 25, label: '클럽하우스 단골' },
  { rounds: 50, label: '골프 라이프' },
]

/** 기준을 통과한 라운드 수로 골프 레벨과 다음 레벨까지의 진행률(%)을 구한다. */
export function buildLevelProgress(roundCount: number) {
  const currentLevelIndex = GOLF_LEVELS.reduce((index, level, i) => roundCount >= level.rounds ? i : index, -1)
  const nextLevel = GOLF_LEVELS[currentLevelIndex + 1]
  const previousLevelRounds = currentLevelIndex < 0 ? 0 : GOLF_LEVELS[currentLevelIndex].rounds
  const levelProgress = nextLevel ? Math.max(0, Math.min(100, ((roundCount - previousLevelRounds) / (nextLevel.rounds - previousLevelRounds)) * 100)) : 100
  return { currentLevelIndex, currentLevel: currentLevelIndex + 1, nextLevel, levelProgress }
}

/** 집계를 아직 못 불러왔거나 인정 라운드가 없을 때의 값. */
export const EMPTY_TROPHY_STATS: TrophyStats = {
  birdies: 0, eagles: 0, fairway_holes: 0, fairway_hits: 0, gir_holes: 0, gir_hits: 0, best_full_round_score: null,
  has_even_par_round: false, has_under_par_round: false, has_putt_rhythm_round: false, has_long_drive: false, has_clean_round: false, has_par_or_better_nine: false,
}

/** 인정 라운드 수와 서버 집계로 트로피 목록을 만든다. */
export function buildTrophies(roundCount: number, stats: TrophyStats): TrophyItem[] {
  const { birdies, eagles } = stats
  const bestFairway = stats.fairway_holes ? stats.fairway_hits / stats.fairway_holes : 0
  const bestGir = stats.gir_holes ? stats.gir_hits / stats.gir_holes : 0
  const firstScore = (score: number) => stats.best_full_round_score != null && stats.best_full_round_score <= score
  const bestPutts = stats.has_putt_rhythm_round
  const driverLong = stats.has_long_drive
  const noPenalty = stats.has_clean_round
  const parOrBetterNine = stats.has_par_or_better_nine

  return [
    { id: 'first-round', title: '첫 라운드', description: '첫 라운드를 완료했어요.', icon: '⛳', earned: roundCount >= 1, category: '레벨업', evidence: `${roundCount} / 1회` },
    { id: 'round-3', title: '라운드 수집가', description: '완료 라운드 3회를 기록했어요.', icon: '🗺️', earned: roundCount >= 3, category: '레벨업', evidence: `${Math.min(roundCount, 3)} / 3회` },
    { id: 'round-5', title: '꾸준한 골퍼', description: '완료 라운드 5회를 기록했어요.', icon: '🌱', earned: roundCount >= 5, category: '레벨업', evidence: `${Math.min(roundCount, 5)} / 5회` },
    { id: 'round-10', title: '코스 탐험가', description: '완료 라운드 10회를 기록했어요.', icon: '🧭', earned: roundCount >= 10, category: '레벨업', evidence: `${Math.min(roundCount, 10)} / 10회` },
    { id: 'round-25', title: '클럽하우스 단골', description: '완료 라운드 25회를 기록했어요.', icon: '🏆', earned: roundCount >= 25, category: '레벨업', evidence: `${Math.min(roundCount, 25)} / 25회` },
    { id: 'round-50', title: '골프 라이프', description: '완료 라운드 50회를 기록했어요.', icon: '👑', earned: roundCount >= 50, category: '레벨업', evidence: `${Math.min(roundCount, 50)} / 50회` },
    { id: 'first-birdie', title: '첫 버디', description: '홀별 스코어에서 첫 버디 이상을 기록했어요.', icon: '🐦', earned: birdies > 0, category: '스코어', evidence: `${birdies}회` },
    { id: 'first-eagle', title: '이글 헌터', description: '홀별 스코어에서 첫 이글 이상을 기록했어요.', icon: '🦅', earned: eagles > 0, category: '스코어', evidence: `${eagles}회` },
    { id: 'under-100', title: '100타 벽 돌파', description: '100타 이하 스코어를 기록했어요.', icon: '💯', earned: firstScore(100), category: '스코어', evidence: firstScore(100) ? '달성' : '목표 100타 이하' },
    { id: 'under-90', title: '90타 벽 돌파', description: '90타 이하 스코어를 기록했어요.', icon: '🎯', earned: firstScore(90), category: '스코어', evidence: firstScore(90) ? '달성' : '목표 90타 이하' },
    { id: 'single', title: '싱글 입문', description: '79타 이하 스코어를 기록했어요.', icon: '✨', earned: firstScore(79), category: '스코어', evidence: firstScore(79) ? '달성' : '목표 79타 이하' },
    { id: 'par-nine', title: '파 세이브 행진', description: '한 라운드에서 파 또는 버디 이상을 9홀 기록했어요.', icon: '🟢', earned: parOrBetterNine, category: '코스 공략', evidence: parOrBetterNine ? '달성' : '한 라운드 9홀 목표' },
    { id: 'even-par', title: '이븐파 라운드', description: '18홀 합계 기준 이븐파를 기록했어요.', icon: '⚖️', earned: stats.has_even_par_round, category: '코스 공략', evidence: stats.has_even_par_round ? '달성' : '18홀 기록 필요' },
    { id: 'under-par', title: '언더파 라운드', description: '18홀 합계 기준 언더파를 기록했어요.', icon: '🔥', earned: stats.has_under_par_round, category: '코스 공략', evidence: stats.has_under_par_round ? '달성' : '18홀 기록 필요' },
    { id: 'fairway-70', title: '페어웨이 파인더', description: '기록된 파 4·5 홀에서 페어웨이 안착률 70%를 달성했어요.', icon: '🧭', earned: stats.fairway_holes >= 9 && bestFairway >= 0.7, category: '샷 메이커', evidence: stats.fairway_holes ? `${Math.round(bestFairway * 100)}% · ${stats.fairway_holes}홀` : '페어웨이 기록 대기' },
    { id: 'gir-50', title: '그린 공략가', description: '기록된 홀에서 GIR 50%를 달성했어요.', icon: '🎯', earned: stats.gir_holes >= 9 && bestGir >= 0.5, category: '샷 메이커', evidence: stats.gir_holes ? `${Math.round(bestGir * 100)}% · ${stats.gir_holes}홀` : '그린 적중 기록 대기' },
    { id: 'drive-250', title: '장타 기념', description: '드라이버 샷 250m 이상을 기록했어요.', icon: '🚀', earned: driverLong, category: '샷 메이커', evidence: driverLong ? '달성' : '목표 250m' },
    { id: 'putt-rhythm', title: '퍼트 리듬', description: '9홀 이상 라운드에서 홀당 평균 퍼트 1.8 이하를 기록했어요.', icon: '🏌️', earned: bestPutts, category: '샷 메이커', evidence: bestPutts ? '달성' : '9홀 평균 1.8 이하' },
    { id: 'clean-round', title: '무벌타 기록', description: '저장된 샷 기록에 벌타가 없어요.', icon: '🍀', earned: noPenalty, category: '샷 메이커', evidence: noPenalty ? '달성' : '샷별 벌타 기록 대기' },
  ]
}

export function toHoleRecords(rows: HoleRow[], shotRows: ShotRow[] = []): HoleRecord[] {
  const shotsByHole = new Map<number, ShotRecord[]>()
  for (const row of shotRows) {
    const shots = shotsByHole.get(row.hole_number) ?? []
    shots.push({
      shotNumber: row.shot_number,
      club: row.club,
      distanceToPinBefore: row.distance_to_pin_before,
      distanceToPinAfter: row.distance_to_pin_after,
      shotDistance: row.shot_distance,
      ballLie: row.ball_lie,
      penalty: row.penalty,
    })
    shotsByHole.set(row.hole_number, shots)
  }
  return rows.map((row) => ({
    holeNumber: row.hole_number,
    greenCode: row.green_code ?? 'standard',
    greenName: row.green_name ?? '기본 그린',
    par: row.par,
    score: row.score,
    scoreDiff: row.score - row.par,
    putts: row.putts,
    fairwayHit: row.fairway_hit,
    gir: row.gir,
    totalDistance: row.total_distance ?? 0,
    shots: shotsByHole.get(row.hole_number) ?? [],
  }))
}

export const roundLocation = (round: RoundSummary) => round.club_name || round.golf_club || '구장 정보 없음'
export const formatDate = (raw: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(raw))
