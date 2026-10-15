import type { ClubItem, ClubCategory } from '@/types/golf'

export const MAX_CLUBS = 14

/** Keep shot-entry buttons short while retaining the user's saved club name for records. */
export function clubButtonLabel(club: ClubItem): string {
  const name = club.name.normalize('NFKC').trim()
  const compact = name.toUpperCase().replace(/[\s._-]/g, '').replace(/번/g, '')
  const number = compact.match(/\d{1,2}/)?.[0]

  if (/드라이버|DRIVER|^DR?$/.test(compact) || club.category === 'driver') return '드라이버'
  if (/퍼터|PUTTER|^PT$/.test(compact) || club.category === 'putter') return '퍼터'

  if (/피칭|PITCHING|^PW$|^P$/.test(compact)) return 'PW'
  if (/어프로치|APPROACH|^AW$/.test(compact)) return 'AW'
  if (/갭|GAP|^GW$/.test(compact)) return 'GW'
  if (/샌드|SAND|^SW$/.test(compact)) return 'SW'
  if (/로브|LOB|^LW$/.test(compact)) return 'LW'

  if (number) {
    if (/아이언|IRON|\dI$|^I\d/.test(compact)) return `${number}I`
    if (/유틸|UTILITY|HYBRID|RESCUE|\d[UH]$|^[UH]\d/.test(compact)) return `${number}U`
    if (club.category === 'wedge' && (/웨지|WEDGE|도|°|DEG/.test(compact) || (/\dW$/.test(compact) && Number(number) >= 40))) return `${number}°`
    if (/우드|WOOD|FAIRWAY|\dW$|^W\d/.test(compact)) return `${number}W`
    if (/웨지|WEDGE|도|°|DEG/.test(compact)) return `${number}°`
    if (club.category === 'iron') return `${number}I`
    if (club.category === 'utility') return `${number}U`
    if (club.category === 'wood') return `${number}W`
    if (club.category === 'wedge') return `${number}°`
  }

  return name
}

/** Normalize newly registered clubs so common name variants share one saved name. */
export function normalizeClubEntry(name: string, category: ClubCategory): Pick<ClubItem, 'name' | 'category'> {
  const label = clubButtonLabel({ id: '', name, category })
  if (label === '드라이버') return { name: label, category: 'driver' }
  if (label === '퍼터') return { name: label, category: 'putter' }
  if (/^\d+W$/.test(label)) return { name: label, category: 'wood' }
  if (/^\d+U$/.test(label)) return { name: label, category: 'utility' }
  if (/^\d+I$/.test(label)) return { name: label, category: 'iron' }
  if (/^(PW|AW|GW|SW|LW|\d+°)$/.test(label)) return { name: label, category: 'wedge' }
  return { name: label, category }
}

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
  '3W': 190,
  '4번 유틸': 180,
  '4U': 180,
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
