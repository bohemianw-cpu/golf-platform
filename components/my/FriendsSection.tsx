import type { CourseAggregate, FriendAggregate, FriendConnection, RoundDetail } from './myTypes'
import { CARD, muted } from './myStyles'

interface FriendsSectionProps {
  userId: string | null
  friends: FriendConnection[]
  friendAggregate: Record<string, { overall: FriendAggregate | null; course: FriendAggregate | null }>
  groupAggregate: CourseAggregate | null
  detail: RoundDetail | null
  friendIdInput: string
  setFriendIdInput: (value: string) => void
  sendFriendRequest: () => Promise<void>
  respondToFriendRequest: (connection: FriendConnection, status: 'accepted' | 'rejected') => Promise<void>
  removeFriendConnection: (connection: FriendConnection) => Promise<void>
  loadFriendComparison: (friendId: string, courseId?: string | null, playMode?: 'field' | 'screen' | null) => Promise<void>
}

export default function FriendsSection({ userId, friends, friendAggregate, groupAggregate, detail, friendIdInput, setFriendIdInput, sendFriendRequest, respondToFriendRequest, removeFriendConnection, loadFriendComparison }: FriendsSectionProps) {
  return (
    <section style={CARD} aria-labelledby="compare-title">
      <h2 id="compare-title" style={{ margin: '0 0 6px', fontSize: '16px' }}>📊 비교 분석</h2>
      <p style={{ ...muted, margin: 0 }}>친구 비교는 상대가 친구 공개를 허용한 완료 기록만 사용합니다. 같은 구장/방식의 평균과 친구 전체 평균을 따로 확인할 수 있습니다. 익명 핸디캡 그룹 평균은 5명 이상 표본일 때만 표시합니다.</p>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
        <label htmlFor="friend-account-id" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)' }}>친구 계정 ID</label>
        <input id="friend-account-id" value={friendIdInput} onChange={(event) => setFriendIdInput(event.target.value)} placeholder="친구 계정 ID(UUID)" style={{ minWidth: '220px', flex: 1, padding: '9px', border: '1px solid #cbd5e1', borderRadius: '7px' }} />
        <button type="button" onClick={() => void sendFriendRequest()} style={{ padding: '9px 12px', border: 0, borderRadius: '7px', background: '#047857', color: '#fff', fontWeight: 700 }}>친구 요청</button>
      </div>
      {groupAggregate && <p style={{ ...muted, margin: '10px 0 0' }}>같은 그룹 익명 전체 평균 · 표본 {groupAggregate.sample_size}회 · {Number(groupAggregate.average_score).toFixed(1)}타 · 퍼트 {Number(groupAggregate.average_putts).toFixed(1)}</p>}
      <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
        {friends.map((connection) => {
          const incoming = connection.addressee_id === userId && connection.status === 'pending'
          const friendId = connection.requester_id === userId ? connection.addressee_id : connection.requester_id
          const comparison = friendAggregate[friendId]
          return <div key={connection.id} style={{ padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{ flex: 1, fontSize: '10px', overflowWrap: 'anywhere' }}>{friendId}</code>
            {incoming ? <><button type="button" onClick={() => void respondToFriendRequest(connection, 'accepted')}>수락</button><button type="button" onClick={() => void respondToFriendRequest(connection, 'rejected')}>거절</button></> : connection.status === 'accepted' ? <>
              <button type="button" onClick={() => void loadFriendComparison(friendId, detail?.course_id, detail?.play_mode)}>평균 비교</button>
              {comparison && <span style={muted}>전체 {comparison.overall?.average_score == null ? '공개 기록 없음' : `${comparison.overall.average_score}타 (${comparison.overall.sample_size}회)`} · 이 구장 {comparison.course?.average_score == null ? '공개 기록 없음' : `${comparison.course.average_score}타 (${comparison.course.sample_size}회)`}</span>}
              <button type="button" onClick={() => void removeFriendConnection(connection)} aria-label="친구 관계 해제" style={{ border: 0, background: 'transparent', color: '#64748b', fontSize: '10px', cursor: 'pointer' }}>친구 해제</button>
            </> : connection.status === 'rejected' ? <><span style={muted}>요청이 거절됨</span><button type="button" onClick={() => void removeFriendConnection(connection)} style={{ border: 0, background: 'transparent', color: '#64748b', fontSize: '10px', cursor: 'pointer' }}>관계 삭제</button></> : <span style={muted}>요청 대기 중</span>}
          </div>
        })}
      </div>
    </section>
  )
}
