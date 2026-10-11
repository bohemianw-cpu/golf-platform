export type GolfLevelGroup = 'beginner' | 'amateur' | 'pro'

export const GOLF_LEVEL_GROUPS: Record<
  GolfLevelGroup,
  { label: string; range: string; description: string }
> = {
  beginner: {
    label: '초보',
    range: '핸디캡 36 초과',
    description: '기본기와 코스 경험을 쌓는 단계',
  },
  amateur: {
    label: '아마추어',
    range: '핸디캡 0 초과 ~ 36 이하',
    description: '개인 기록을 바탕으로 실력을 다듬는 단계',
  },
  pro: {
    label: '프로 수준',
    range: '핸디캡 0 이하',
    description: '스크래치 또는 플러스 핸디캡 그룹',
  },
}

/**
 * 가입자가 입력한 핸디캡을 비교용 그룹으로 분류한다.
 * 이 그룹은 프로 자격을 인증하거나 공식 핸디캡을 산정하지 않는다.
 */
export function getGolfLevelGroup(handicapIndex: number | null | undefined): GolfLevelGroup {
  if (handicapIndex == null || !Number.isFinite(handicapIndex)) return 'beginner'
  if (handicapIndex <= 0) return 'pro'
  if (handicapIndex <= 36) return 'amateur'
  return 'beginner'
}

