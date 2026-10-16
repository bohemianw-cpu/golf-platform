import { describe, expect, it } from 'vitest'
import { buildLevelProgress, buildTrophies, EMPTY_TROPHY_STATS, GOLF_LEVELS } from '@/components/my/myRecords'

describe('골프 레벨 진행률', () => {
  it('라운드가 없으면 레벨 0, 첫 레벨까지 0%', () => {
    expect(buildLevelProgress(0)).toEqual({ currentLevelIndex: -1, currentLevel: 0, nextLevel: GOLF_LEVELS[0], levelProgress: 0 })
  })

  it('레벨 사이에서는 이전 레벨부터 다음 레벨까지의 비율', () => {
    const progress = buildLevelProgress(4)
    expect(progress.currentLevel).toBe(2)
    expect(progress.nextLevel).toBe(GOLF_LEVELS[2])
    expect(progress.levelProgress).toBe(50)
  })

  it('마지막 레벨을 넘으면 다음 레벨 없이 100%', () => {
    const progress = buildLevelProgress(80)
    expect(progress.currentLevel).toBe(GOLF_LEVELS.length)
    expect(progress.nextLevel).toBeUndefined()
    expect(progress.levelProgress).toBe(100)
  })
})

describe('트로피', () => {
  const find = (trophies: ReturnType<typeof buildTrophies>, id: string) => trophies.find((trophy) => trophy.id === id)!

  it('집계가 없으면 라운드 수 트로피만 판정하고 기록 대기로 보여 준다', () => {
    const trophies = buildTrophies(1, EMPTY_TROPHY_STATS)
    expect(trophies.filter((trophy) => trophy.earned).map((trophy) => trophy.id)).toEqual(['first-round'])
    expect(find(trophies, 'fairway-70').evidence).toBe('페어웨이 기록 대기')
    expect(find(trophies, 'under-100').evidence).toBe('목표 100타 이하')
  })

  it('18홀 최저 타수로 100·90·79타 트로피를 판정한다', () => {
    const trophies = buildTrophies(3, { ...EMPTY_TROPHY_STATS, best_full_round_score: 90 })
    expect(find(trophies, 'under-100').earned).toBe(true)
    expect(find(trophies, 'under-90').earned).toBe(true)
    expect(find(trophies, 'single').earned).toBe(false)
  })

  it('페어웨이 70%와 그린 적중 50%는 9홀 이상 기록이 있어야 인정한다', () => {
    const enough = buildTrophies(1, { ...EMPTY_TROPHY_STATS, fairway_holes: 10, fairway_hits: 7, gir_holes: 9, gir_hits: 5 })
    expect(find(enough, 'fairway-70')).toMatchObject({ earned: true, evidence: '70% · 10홀' })
    expect(find(enough, 'gir-50')).toMatchObject({ earned: true, evidence: '56% · 9홀' })
    const tooFew = buildTrophies(1, { ...EMPTY_TROPHY_STATS, fairway_holes: 8, fairway_hits: 8 })
    expect(find(tooFew, 'fairway-70').earned).toBe(false)
  })
})
