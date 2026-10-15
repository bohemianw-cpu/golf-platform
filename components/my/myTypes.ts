import type { BallLie, HoleRecord } from '@/types/golf'
import type { GolfLevelGroup } from '@/utils/golf/levels'

export interface RoundSummary {
  id: string
  created_at: string
  registered_at?: string | null
  status: string
  total_score: number | null
  total_putts: number | null
  club_name: string | null
  golf_club: string | null
  course_name: string | null
  course_id: string | null
  play_mode: 'field' | 'screen' | null
  screen_provider?: string | null
  entry_mode?: 'live' | 'backfill'
  route_ids: string[]
  tee_code: string | null
  tee_name: string | null
  visibility: 'private' | 'friends' | 'aggregate'
}

export interface RoundDetail extends RoundSummary {
  holes: HoleRecord[]
}

export interface RoundIntegritySummary {
  round_id: string
  status: 'in_progress' | 'self_reported' | 'time_plausible' | 'review_required'
  observed_seconds: number | null
  minimum_seconds: number | null
  reason_codes: string[]
}

export interface SampleRoundSession {
  id: string
  created_at: string
  updated_at: string
  payload: Record<string, unknown> | null
}

export interface ProfileSummary {
  nickname: string | null
  handicap_index: number | null
  skill_group: GolfLevelGroup | null
}

export interface UserDataPreferences {
  user_id: string
  allow_anonymous_aggregate: boolean
  allow_friend_sharing: boolean
  allow_ai_practice_analysis: boolean
  score_guide_enabled: boolean
  score_guide_completed_at: string | null
}

export interface CourseAggregate {
  sample_size: number
  average_score: number
  average_putts: number
  fairway_hit_percent: number | null
  gir_percent: number | null
}

export interface FriendConnection {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'rejected'
}

export interface FriendAggregate {
  sample_size: number
  average_score: number | null
  average_putts: number | null
}

export interface HoleRow {
  hole_number: number
  par: number
  score: number
  putts: number
  fairway_hit: boolean | null
  gir: boolean
  total_distance: number | null
  green_code?: string | null
  green_name?: string | null
}

export interface ShotRow {
  hole_number: number
  shot_number: number
  club: string
  distance_to_pin_before: number
  distance_to_pin_after: number
  shot_distance: number
  ball_lie: BallLie
  penalty: number
}

export interface AchievementHoleRow {
  round_id: string
  hole_number: number
  par: number
  score: number
  putts: number
  fairway_hit: boolean | null
  gir: boolean
}

export interface AchievementShotRow {
  round_id: string
  club: string
  shot_distance: number
  penalty: number
}

export interface TrophyItem {
  id: string
  title: string
  description: string
  icon: string
  earned: boolean
  category: string
  evidence: string
}
