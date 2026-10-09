import type { ClubItem, ClubCategory } from '@/types/golf'

const CATEGORY_ORDER: Record<ClubCategory, number> = {
  driver: 1,
  wood: 2,
  utility: 3,
  iron: 4,
  wedge: 5,
  putter: 6,
}

const getWedgeScore = (name: string): number => {
  const t = name.trim().toUpperCase()
  if (t.startsWith('PW') || t.includes('피칭') || t === 'P') return 10
  if (t.startsWith('AW') || t.startsWith('GW') || t.includes('어프로치')) return 20
  if (t.startsWith('SW') || t.includes('샌드')) return 30
  if (t.startsWith('LW') || t.includes('로브')) return 40
  const num = t.match(/\d+/)
  if (num) return 100 + parseInt(num[0], 10)
  return 500
}

const firstNumber = (name: string, fallback = 99): number => {
  const m = name.match(/\d+/)
  return m ? parseInt(m[0], 10) : fallback
}

// 클럽 정렬: PW는 웨지 중 가장 먼저
export const sortClubs = (clubs: ClubItem[]): ClubItem[] =>
  [...clubs].sort((a, b) => {
    const orderDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]
    if (orderDiff !== 0) return orderDiff

    if (a.category === 'wedge') {
      const diff = getWedgeScore(a.name) - getWedgeScore(b.name)
      return diff !== 0 ? diff : a.name.localeCompare(b.name)
    }
    if (a.category === 'iron') {
      const diff = firstNumber(a.name) - firstNumber(b.name)
      return diff !== 0 ? diff : a.name.localeCompare(b.name)
    }
    return a.name.localeCompare(b.name)
  })

export const DEFAULT_CLUB_DISTANCES: Record<string, number> = {
  '드라이버': 210,
  '3번 우드': 190,
  '4번 유틸': 180,
  '5번 아이언': 160,
  '6번 아이언': 150,
  '7번 아이언': 140,
  '8번 아이언': 130,
  '9번 아이언': 120,
  'PW': 110,
  '52도 웨지': 90,
  '56도 웨지': 70,
  '퍼터': 10,
}

/** 사용자가 이름을 바꾼 클럽도 카테고리/숫자로 추정하는 기본 비거리 */
export function fallbackClubDistance(club: ClubItem | undefined, name: string): number {
  if (DEFAULT_CLUB_DISTANCES[name] !== undefined) return DEFAULT_CLUB_DISTANCES[name]
  const n = (club?.name ?? name).trim().toUpperCase()
  switch (club?.category) {
    case 'driver':
      return 210
    case 'wood':
      return 200 - Math.max(0, firstNumber(n, 3) - 3) * 8
    case 'utility':
      return 185 - Math.max(0, firstNumber(n, 4) - 3) * 8
    case 'iron':
      return 140 - (firstNumber(n, 7) - 7) * 10
    case 'wedge': {
      const score = getWedgeScore(n)
      if (score === 10) return 110
      if (score === 20) return 100
      if (score === 30) return 80
      if (score === 40) return 60
      if (score > 100) return Math.max(40, 90 - (score - 100 - 52) * 5)
      return 80
    }
    case 'putter':
      return 10
    default:
      return 130
  }
}

export const DEFAULT_CLUBS: ClubItem[] = [
  { id: '1', name: '드라이버', category: 'driver' },
  { id: '2', name: '3번 우드', category: 'wood' },
  { id: '3', name: '4번 유틸', category: 'utility' },
  { id: '4', name: '5번 아이언', category: 'iron' },
  { id: '5', name: '6번 아이언', category: 'iron' },
  { id: '6', name: '7번 아이언', category: 'iron' },
  { id: '7', name: '8번 아이언', category: 'iron' },
  { id: '8', name: '9번 아이언', category: 'iron' },
  { id: '9', name: 'PW', category: 'wedge' },
  { id: '10', name: '52도 웨지', category: 'wedge' },
  { id: '11', name: '56도 웨지', category: 'wedge' },
  { id: '12', name: '퍼터', category: 'putter' },
]

export const INITIAL_HOLE_PARS = [4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5]
