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
  greenCode: string
  greenName: string
  par: number
  totalDistance: number
  shots: ShotRecord[]
  score: number // 총 타수 (샷 + 벌타)
  scoreDiff: number // 파 대비 (+1, 0, -1)
  putts: number
  fairwayHit: boolean | null
  gir: boolean
}

export interface GolfCourseTee {
  tee_code: string
  display_name: string
  tee_color: string
  tee_selection_available?: boolean
  distance_m: number
  distance_m_source?: 'official' | 'converted'
  source_distance?: number | null
  source_unit?: 'm' | 'yd' | null
  green_code: string
  green_name: string
  par?: number | null
}

export interface GolfCourseHole {
  id: string
  route_id: string
  hole_number: number
  play_order: number
  par: number
  handicap_index: number | null
  tees: GolfCourseTee[]
}

export interface GolfCourseRoute {
  id: string
  course_id: string
  route_code: string
  display_name: string
  hole_count: number
  pars: number[]
  distances_m: number[]
  source_url?: string | null
  source_data_url?: string | null
  holes?: GolfCourseHole[]
}
