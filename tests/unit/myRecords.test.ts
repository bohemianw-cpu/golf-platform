import { describe, expect, it } from 'vitest'
import { buildLevelProgress, GOLF_LEVELS } from '@/components/my/myRecords'

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
