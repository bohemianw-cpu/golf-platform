import type { GolfCourseRoute, HoleRecord, ShotRecord } from '@/types/golf'

const DRAFT_KEY = 'golf-score-draft-v1'
const SAMPLE_DRAFT_KEY = 'golf-score-sample-draft-v1'

/** 아직 서버에 못 올린 샷까지 포함해 이 기기에 보관하는 진행 중 라운드. */
export interface Draft {
  userId: string
  sampleSessionId?: string | null
  roundId: string | null
  golfClubName: string
  courseName: string
  playMode?: 'field' | 'screen' | null
  screenProvider?: string | null
  entryMode?: 'live' | 'backfill'
  courseId?: string | null
  routeIds?: string[]
  teeCode?: string | null
  teeName?: string | null
  courseInfoLocked?: boolean
  courseParsAvailable?: boolean
  routeDistances?: number[]
  greenCodes?: string[]
  greenNames?: string[]
  routeHoles?: GolfCourseRoute['holes']
  holePars: number[]
  currentHole: number
  holeDistance: number
  currentShots: ShotRecord[]
  completedHoles: HoleRecord[]
}

const draftKey = (isSample: boolean) => (isSample ? SAMPLE_DRAFT_KEY : DRAFT_KEY)

export function readDraft(userId: string, isSample = false, sampleSessionId: string | null = null): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(isSample))
    const d = raw ? (JSON.parse(raw) as Draft) : null
    return d && d.userId === userId && (!isSample || d.sampleSessionId === sampleSessionId) && (d.completedHoles?.length > 0 || d.currentShots?.length > 0 || d.courseInfoLocked === true) ? d : null
  } catch {
    return null
  }
}

/** draft가 null이면 보관 기록을 지운다. 저장소를 쓸 수 없는 환경에서는 조용히 넘어간다. */
export function writeDraft(isSample: boolean, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(draftKey(isSample), JSON.stringify(draft))
    else localStorage.removeItem(draftKey(isSample))
  } catch {}
}
