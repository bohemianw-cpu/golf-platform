import type { CourseAggregate, RoundDetail, RoundIntegritySummary, UserDataPreferences } from './myTypes'
import { formatDate, integrityLabel, integrityReasonNames, roundLocation } from './myRecords'
import { CARD, muted } from './myStyles'
import { color, palette } from '@/utils/theme'

interface RoundDetailSectionProps {
  detail: RoundDetail
  setDetail: (detail: RoundDetail | null) => void
  integrityByRound: Record<string, RoundIntegritySummary>
  dataPreferences: UserDataPreferences | null
  sharing: boolean
  updateVisibility: (round: RoundDetail, target: 'friends' | 'aggregate') => Promise<void>
  aggregate: CourseAggregate | null
  courseAllAggregate: CourseAggregate | null
}

export default function RoundDetailSection({ detail, setDetail, integrityByRound, dataPreferences, sharing, updateVisibility, aggregate, courseAllAggregate }: RoundDetailSectionProps) {
  return (
    <section style={CARD} aria-labelledby="round-detail-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'start' }}>
        <div><h2 id="round-detail-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>{roundLocation(detail)} 상세</h2><p style={{ ...muted, margin: 0 }}>{formatDate(detail.created_at)} · {detail.course_name || '코스 미입력'}{detail.tee_name ? ` · ${detail.tee_name}` : ''}{detail.play_mode === 'screen' && detail.screen_provider ? ` · ${detail.screen_provider}` : ''} · 총 {detail.total_score ?? '진행 중'}타</p></div>
        <button type="button" onClick={() => setDetail(null)} aria-label="라운드 상세 닫기" style={{ border: `1px solid ${palette.slate300}`, borderRadius: '7px', padding: '6px 9px', background: palette.white, cursor: 'pointer' }}>닫기</button>
      </div>
      {detail.registered_at && <div role="status" style={{ marginTop: 10, padding: '9px 11px', border: `1px solid ${palette.green200}`, borderRadius: 8, background: palette.green50, color: palette.green800, fontSize: 12, fontWeight: 700 }}>✓ 스코어 등록 완료 · 이 라운드는 읽기 전용이며 샷 수정·취소·삭제 기능을 제공하지 않습니다.</div>}
      {detail.status === 'completed' && <p style={{ ...muted, margin: '10px 0 0' }}>{detail.registered_at ? '스코어 등록 완료 · 샷 데이터 수정 불가. ' : ''}기록 확인: {integrityLabel(integrityByRound[detail.id])}{integrityByRound[detail.id]?.observed_seconds != null && integrityByRound[detail.id]?.minimum_seconds != null ? ` · 서버 관측 ${Math.floor((integrityByRound[detail.id]?.observed_seconds ?? 0) / 60)}분 / 최저선 ${Math.floor((integrityByRound[detail.id]?.minimum_seconds ?? 0) / 60)}분` : ''}{integrityByRound[detail.id]?.reason_codes.length ? ` · ${integrityByRound[detail.id].reason_codes.map((reason) => integrityReasonNames[reason] ?? reason).join(', ')}` : ''}. 시간 기준 통과는 실제 플레이나 현장 방문의 증명이 아닙니다.</p>}
      <div style={{ display: 'grid', gap: '9px', marginTop: '14px' }}>
        {detail.course_id && detail.play_mode && <div style={{ padding: '12px', border: `1px solid ${palette.slate300}`, borderRadius: '9px', background: palette.white }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div><strong style={{ fontSize: '12px', color: palette.slate900 }}>익명 구장 평균 비교</strong><p style={{ ...muted, margin: '4px 0 0' }}>내 이름과 샷 상세는 공유하지 않습니다. 같은 핸디캡 그룹과 플레이 방식의 라운드가 5건 이상일 때만 평균을 표시합니다.</p></div>
            {!detail.registered_at && detail.status === 'completed' && (!dataPreferences?.allow_anonymous_aggregate || !dataPreferences.allow_friend_sharing) && <p style={{ ...muted, flexBasis: '100%', margin: 0 }}>아래 라운드 공유 기능을 사용하려면 먼저 위 설정에서 해당 선택 동의를 켜 주세요.</p>}
            {!detail.registered_at && detail.status === 'completed' && <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void updateVisibility(detail, 'friends')} disabled={sharing || (!dataPreferences?.allow_friend_sharing && detail.visibility !== 'friends')} aria-pressed={detail.visibility === 'friends'} title={dataPreferences?.allow_friend_sharing ? undefined : 'MY의 공유 설정에서 친구 비교 동의를 켜 주세요'} style={{ padding: '8px 10px', border: `1px solid ${palette.slate300}`, borderRadius: '7px', background: detail.visibility === 'friends' ? palette.blue50 : palette.white, color: palette.blue700, fontSize: '11px', fontWeight: 700, cursor: sharing ? 'wait' : 'pointer', opacity: dataPreferences?.allow_friend_sharing || detail.visibility === 'friends' ? 1 : .55 }}>{sharing ? '저장 중…' : detail.visibility === 'friends' ? '친구 공개 중 · 중단' : '친구에게 공개'}</button>
              <button type="button" onClick={() => void updateVisibility(detail, 'aggregate')} disabled={sharing || (!dataPreferences?.allow_anonymous_aggregate && detail.visibility !== 'aggregate')} aria-pressed={detail.visibility === 'aggregate'} title={dataPreferences?.allow_anonymous_aggregate ? undefined : 'MY의 공유 설정에서 익명 평균 동의를 켜 주세요'} style={{ padding: '8px 10px', border: `1px solid ${palette.emerald200}`, borderRadius: '7px', background: detail.visibility === 'aggregate' ? palette.emerald50 : palette.white, color: color.brand, fontSize: '11px', fontWeight: 700, cursor: sharing ? 'wait' : 'pointer', opacity: dataPreferences?.allow_anonymous_aggregate || detail.visibility === 'aggregate' ? 1 : .55 }}>{sharing ? '저장 중…' : detail.visibility === 'aggregate' ? '익명 평균 참여 중 · 중단' : '익명 평균에 참여'}</button>
            </div>}
          </div>
          {aggregate || courseAllAggregate ? <div style={{ display: 'grid', gap: '8px', marginTop: '10px', color: palette.slate700, fontSize: '11px' }}>
            {aggregate && <div><strong>같은 핸디 그룹</strong> · 표본 {aggregate.sample_size}회 · 평균 {Number(aggregate.average_score).toFixed(1)}타 · 퍼트 {Number(aggregate.average_putts).toFixed(1)} · 페어웨이 {aggregate.fairway_hit_percent == null ? '—' : `${aggregate.fairway_hit_percent}%`} · GIR {aggregate.gir_percent == null ? '—' : `${aggregate.gir_percent}%`}</div>}
            {courseAllAggregate && <div><strong>구장 전체 그룹</strong> · 표본 {courseAllAggregate.sample_size}회 · 평균 {Number(courseAllAggregate.average_score).toFixed(1)}타 · 퍼트 {Number(courseAllAggregate.average_putts).toFixed(1)} · 페어웨이 {courseAllAggregate.fairway_hit_percent == null ? '—' : `${courseAllAggregate.fairway_hit_percent}%`} · GIR {courseAllAggregate.gir_percent == null ? '—' : `${courseAllAggregate.gir_percent}%`}</div>}
            {!aggregate && <p style={{ ...muted, margin: 0 }}>같은 핸디 그룹은 5명 이상 표본이 모이지 않았습니다.</p>}
            {!courseAllAggregate && <p style={{ ...muted, margin: 0 }}>구장 전체는 5명 이상 표본이 모이지 않았습니다.</p>}
          </div> : <p style={{ ...muted, margin: '8px 0 0' }}>현재 기준을 만족하는 익명 표본이 아직 없습니다.</p>}
        </div>}
        {detail.holes.map((hole) => <article key={hole.holeNumber} style={{ padding: '11px', border: `1px solid ${palette.slate200}`, borderRadius: '9px', background: palette.slate50 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: palette.slate900, fontSize: '12px' }}><strong>{hole.holeNumber}번 홀 · Par {hole.par} · {hole.greenName || '기본 그린'}</strong><span>{hole.score}타 · 퍼트 {hole.putts}</span></div>
          <ol style={{ margin: '8px 0 0', paddingLeft: '20px', display: 'grid', gap: '5px', color: palette.slate600, fontSize: '11px' }}>
            {hole.shots.map((shot) => <li key={`${hole.holeNumber}-${shot.shotNumber}`}>{shot.shotNumber}타 · {shot.club} · {shot.shotDistance}m · {shot.ballLie}{shot.penalty ? ` · 벌타 ${shot.penalty}` : ''}</li>)}
            {hole.shots.length === 0 && <li style={{ color: palette.slate400 }}>저장된 샷 상세가 없습니다.</li>}
          </ol>
        </article>)}
        {detail.holes.length === 0 && <p style={muted}>아직 입력된 홀이 없습니다.</p>}
      </div>
    </section>
  )
}
