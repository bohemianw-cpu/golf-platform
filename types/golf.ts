export type ClubCategory = 'driver' | 'wood' | 'utility' | 'iron' | 'wedge' | 'putter'

export interface ClubItem {
  id: string
  name: string
  category: ClubCategory
}

export type BallLie =
  | '티'
  | '페어웨이'
  | '러프'
  | '벙커'
  | '그린'
  | '해저드'
  | 'OB'
  | '해저드티'
  | 'OB티'
  | '홀아웃'

export interface ShotRecord {
  shotNumber: number
  club: string
  distanceToPinBefore: number
  distanceToPinAfter: number
  shotDistance: number
  ballLie: BallLie
  penalty: number
}

export interface HoleRecord {
  holeNumber: number
  par: number
  totalDistance: number
  shots: ShotRecord[]
  score: number // 총 타수 (샷 + 벌타)
  scoreDiff: number // 파 대비 (+1, 0, -1)
  putts: number
  fairwayHit: boolean | null
  gir: boolean
}