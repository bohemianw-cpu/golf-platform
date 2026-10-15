import type { createClient } from '@/utils/supabase/client'
import type { HoleRow, RoundSummary, ShotRow } from './myTypes'
import { roundLocation, toHoleRecords } from './myRecords'

type SupabaseClient = ReturnType<typeof createClient>

/** 내 라운드 전체(홀·샷·기록 확인 결과·입력 이력)를 JSON 파일로 내려받는다. 100라운드씩 나눠 불러온다. */
export async function exportRoundHistory(supabase: SupabaseClient, rounds: RoundSummary[]) {
  const exported = []
  for (let from = 0; from < rounds.length; from += 100) {
    const batch = rounds.slice(from, from + 100)
    const ids = batch.map((round) => round.id)
    if (ids.length === 0) continue
    const [{ data: holes, error: holesError }, { data: shots, error: shotsError }, { data: integrity, error: integrityError }] = await Promise.all([
      supabase.from('round_holes').select('*').in('round_id', ids).order('hole_number'),
      supabase.from('round_shots').select('round_id,hole_number,shot_number,club,distance_to_pin_before,distance_to_pin_after,shot_distance,ball_lie,penalty').in('round_id', ids).order('hole_number').order('shot_number'),
      supabase.from('round_integrity').select('*').in('round_id', ids),
    ])
    if (holesError) throw holesError
    if (shotsError) throw shotsError
    if (integrityError) throw integrityError
    const inputEvents: Record<string, unknown>[] = []
    for (let eventFrom = 0; ; eventFrom += 500) {
      const { data: eventPage, error: eventError } = await supabase.from('round_input_events')
        .select('round_id,event_type,hole_number,shot_number,input_method,received_at')
        .in('round_id', ids).order('id').range(eventFrom, eventFrom + 499)
      if (eventError) throw eventError
      inputEvents.push(...(eventPage ?? []))
      if (!eventPage || eventPage.length < 500) break
    }
    const shotsByRound = new Map<string, ShotRow[]>()
    for (const row of shots ?? []) {
      const typed = row as ShotRow & { round_id: string }
      shotsByRound.set(typed.round_id, [...(shotsByRound.get(typed.round_id) ?? []), typed])
    }
    const holesByRound = new Map<string, HoleRow[]>()
    for (const row of holes ?? []) {
      const typed = row as HoleRow & { round_id: string }
      holesByRound.set(typed.round_id, [...(holesByRound.get(typed.round_id) ?? []), typed])
    }
    for (const round of batch) {
      exported.push({
        id: round.id,
        date: round.created_at,
        course: roundLocation(round),
        courseLayout: round.course_name,
        playMode: round.play_mode,
        entryMode: round.entry_mode ?? 'live',
        status: round.status,
        score: round.total_score,
        visibility: round.visibility,
        holes: toHoleRecords(holesByRound.get(round.id) ?? [], shotsByRound.get(round.id) ?? []),
        integrity: (integrity ?? []).find((item) => item.round_id === round.id) ?? null,
        inputEvents: inputEvents.filter((item) => item.round_id === round.id),
      })
    }
  }
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), rounds: exported }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'golf-round-history.json'
  link.click()
  URL.revokeObjectURL(url)
}
