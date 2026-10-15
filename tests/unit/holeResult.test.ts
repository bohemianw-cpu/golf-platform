import { describe, expect, it } from 'vitest'
import { getHoleResultLabel } from '@/hooks/round/holeResult'

describe('홀 결과 이름', () => {
  it.each([
    [1, 3, '홀인원'],
    [2, 5, '알바트로스'],
    [3, 5, '이글'],
    [3, 4, '버디'],
    [4, 4, '파'],
    [5, 4, '보기'],
    [6, 4, '더블보기'],
    [7, 4, '트리플보기'],
    [6, 3, '더블파'],
    [9, 4, '더블파'],
    [8, 5, '트리플보기'],
    [9, 5, '쿼트러플보기'],
  ])('%i타 / 파 %i → %s', (score, par, label) => {
    expect(getHoleResultLabel(score, par)).toBe(label)
  })
})
