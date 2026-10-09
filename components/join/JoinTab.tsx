'use client'

import React, { useState, useEffect } from 'react'

export interface JoinPost {
  id: string
  category: 'field' | 'screen' // 필드 라운딩 vs 스크린 벙개
  title: string
  location: string // 골프장명 또는 스크린 매장명
  region: string // 지역
  date: string // 일시
  teeTime: string // 티오프 시간
  currentMembers: number // 현재 인원
  targetMembers: number // 모집 총 인원
  cost: string // 그린피/참가비
  targetHandicap: string // 희망 타수
  gender: string // 성별 조건
  author: string // 작성자 닉네임
  description: string
  status: 'recruiting' | 'closed'
}

const DEFAULT_POSTS: JoinPost[] = [
  {
    id: '1',
    category: 'field',
    title: '이번 주말 오전 동래베네스트CC 2분 모십니다 (90타대 환영)',
    location: '동래베네스트CC',
    region: '부산/경남',
    date: '10월 12일 (토)',
    teeTime: '07:28',
    currentMembers: 2,
    targetMembers: 4,
    cost: '그린피 21만원 (카/캐 별도)',
    targetHandicap: '90~100타',
    gender: '남녀 무관',
    author: '명랑골퍼',
    description: '매너 좋고 유쾌하게 라운드하실 동반자 2분 구합니다. 초보분들도 부담 없이 오세요!',
    status: 'recruiting',
  },
  {
    id: '2',
    category: 'screen',
    title: '오늘 저녁 7시반 골프존파크 해운대센텀점 4인 배틀 벙개!',
    location: '골프존파크 센텀점',
    region: '부산/경남',
    date: '오늘',
    teeTime: '19:30',
    currentMembers: 3,
    targetMembers: 4,
    cost: '게임비 N분의 1 (약 2.5만)',
    targetHandicap: '핸디 80~90타',
    gender: '남녀 무관',
    author: '버디천재',
    description: '퇴근 후 시원하게 스크린 한 판 치실 마지막 1분 모십니다! 방 예약 완료되었습니다.',
    status: 'recruiting',
  },
  {
    id: '3',
    category: 'field',
    title: '수도권 안양/용인권 주중 레이크사이드CC 1분 급구',
    location: '레이크사이드CC',
    region: '서울/경기',
    date: '10월 15일 (화)',
    teeTime: '08:14',
    currentMembers: 3,
    targetMembers: 4,
    cost: '그린피 18만원',
    targetHandicap: '80~90타',
    gender: '남성 우대',
    author: '드라이버230m',
    description: '동반자 한 분이 급한 사정으로 취소되어 1분 충원합니다. 빠른 확정 부탁드립니다.',
    status: 'recruiting',
  },
  {
    id: '4',
    category: 'screen',
    title: '주말 오후 강남역 카카오VX 초보자 스크린 모임 (치킨 내기)',
    location: '프렌즈스크린 강남점',
    region: '서울/경기',
    date: '10월 13일 (일)',
    teeTime: '16:00',
    currentMembers: 2,
    targetMembers: 4,
    cost: '게임비 2만원선',
    targetHandicap: '100돌이/초보',
    gender: '2030 골퍼',
    author: '골린이탈출',
    description: '구력 1년 미만 골린이분들끼리 편하게 즐기는 스크린 벙개입니다.',
    status: 'recruiting',
  },
]

export default function JoinTab() {
  const [category, setCategory] = useState<'field' | 'screen'>('field')
  const [selectedRegion, setSelectedRegion] = useState<string>('전체')
  const [posts, setPosts] = useState<JoinPost[]>(DEFAULT_POSTS)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

  // 신규 글 작성 폼 상태
  const [newTitle, setNewTitle] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newRegion, setNewRegion] = useState('부산/경남')
  const [newDate, setNewDate] = useState('')
  const [newTeeTime, setNewTeeTime] = useState('')
  const [newTargetMembers, setNewTargetMembers] = useState(4)
  const [newCurrentMembers, setNewCurrentMembers] = useState(1)
  const [newCost, setNewCost] = useState('')
  const [newHandicap, setNewHandicap] = useState('무관')
  const [newDescription, setNewDescription] = useState('')

  // 로컬 저장소 연동
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('golf_join_posts')
      if (saved) {
        try {
          setPosts(JSON.parse(saved))
        } catch (e) {}
      }
    }
  }, [])

  const handleSavePost = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newLocation.trim()) {
      alert('제목과 장소를 입력해주세요.')
      return
    }

    const user = typeof window !== 'undefined' ? localStorage.getItem('golf_user') || '골퍼' : '골퍼'
    const authorNick = user.split('@')[0]

    const newPost: JoinPost = {
      id: `join_${Date.now()}`,
      category: category,
      title: newTitle.trim(),
      location: newLocation.trim(),
      region: newRegion,
      date: newDate || '날짜 미정',
      teeTime: newTeeTime || '시간 협의',
      currentMembers: Number(newCurrentMembers) || 1,
      targetMembers: Number(newTargetMembers) || 4,
      cost: newCost || '협의',
      targetHandicap: newHandicap,
      gender: '남녀 무관',
      author: authorNick,
      description: newDescription.trim(),
      status: 'recruiting',
    }

    const updated = [newPost, ...posts]
    setPosts(updated)
    localStorage.setItem('golf_join_posts', JSON.stringify(updated))
    setIsModalOpen(false)

    // 폼 초기화
    setNewTitle('')
    setNewLocation('')
    setNewDate('')
    setNewTeeTime('')
    setNewCost('')
    setNewDescription('')
  }

  const handleJoinApply = (post: JoinPost) => {
    if (post.currentMembers >= post.targetMembers) {
      alert('이미 모집 정원이 마감되었습니다.')
      return
    }
    const confirmJoin = window.confirm(`[${post.title}]\n조인 모임에 참여 신청하시겠습니까?`)
    if (confirmJoin) {
      const updated = posts.map((p) => {
        if (p.id === post.id) {
          const nextCount = p.currentMembers + 1
          return {
            ...p,
            currentMembers: nextCount,
            status: nextCount >= p.targetMembers ? ('closed' as const) : ('recruiting' as const),
          }
        }
        return p
      })
      setPosts(updated)
      localStorage.setItem('golf_join_posts', JSON.stringify(updated))
      alert('신청이 완료되었습니다! 호스트와 연결되었습니다.')
    }
  }

  // 필터링된 게시글 목록
  const filteredPosts = posts.filter((p) => {
    const matchCategory = p.category === category
    const matchRegion = selectedRegion === '전체' || p.region === selectedRegion
    return matchCategory && matchRegion
  })

  return (
    <div style={{ padding: '16px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* 1. 상단 타이틀 & 조인 등록 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>
            👥 골프 조인 & 동반자 모집
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            필드 라운딩 조인과 퇴근 후 스크린 벙개 모임을 찾아보세요.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '10px 18px',
            backgroundColor: '#047857',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          + {category === 'field' ? '필드 조인 등록' : '스크린 벙개 등록'}
        </button>
      </div>

      {/* 2. [필드 vs 스크린] 2대 메인 모드 선택 바 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setCategory('field')}
          style={{
            padding: '14px',
            borderRadius: '10px',
            border: category === 'field' ? '2px solid #047857' : '1px solid #cbd5e1',
            backgroundColor: category === 'field' ? '#ecfdf5' : '#ffffff',
            color: category === 'field' ? '#047857' : '#475569',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>⛳</span> 필드 라운딩 조인
        </button>

        <button
          onClick={() => setCategory('screen')}
          style={{
            padding: '14px',
            borderRadius: '10px',
            border: category === 'screen' ? '2px solid #2563eb' : '1px solid #cbd5e1',
            backgroundColor: category === 'screen' ? '#eff6ff' : '#ffffff',
            color: category === 'screen' ? '#2563eb' : '#475569',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🖥️</span> 스크린 골프 벙개
        </button>
      </div>

      {/* 3. 지역 필터 바 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {['전체', '서울/경기', '부산/경남', '대구/경북', '충청/대전', '전라/광주', '강원/제주'].map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRegion(r)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: selectedRegion === r ? '1px solid #0f172a' : '1px solid #cbd5e1',
              backgroundColor: selectedRegion === r ? '#0f172a' : '#ffffff',
              color: selectedRegion === r ? '#ffffff' : '#475569',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* 4. 조인 카드 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredPosts.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#94a3b8' }}>
            해당 조건의 모집글이 없습니다.<br />첫 번째 조인/벙개 글을 등록해보세요!
          </div>
        ) : (
          filteredPosts.map((post) => {
            const isFull = post.currentMembers >= post.targetMembers
            return (
              <div
                key={post.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '18px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* 상단 뱃지 & 상태 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        backgroundColor: post.category === 'field' ? '#ecfdf5' : '#eff6ff',
                        color: post.category === 'field' ? '#047857' : '#2563eb',
                      }}
                    >
                      {post.category === 'field' ? '⛳ 필드' : '🖥️ 스크린'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{post.region}</span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>· {post.location}</span>
                  </div>

                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: isFull ? '#f1f5f9' : '#fee2e2',
                      color: isFull ? '#64748b' : '#dc2626',
                    }}
                  >
                    {isFull ? '마감됨' : `모집중 (${post.currentMembers}/${post.targetMembers}명)`}
                  </span>
                </div>

                {/* 제목 */}
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                  {post.title}
                </h3>

                {/* 주요 일정 및 조건 그리드 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '8px',
                    backgroundColor: '#f8fafc',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                >
                  <div>📅 일시: <strong>{post.date} {post.teeTime}</strong></div>
                  <div>💰 비용: <strong>{post.cost}</strong></div>
                  <div>🎯 타수: <strong>{post.targetHandicap}</strong></div>
                  <div>👤 작성자: <strong>{post.author}</strong></div>
                </div>

                {/* 설명 및 하단 액션 버튼 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ fontSize: '13px', color: '#475569', flex: 1, minWidth: '240px' }}>
                    {post.description}
                  </div>

                  <button
                    onClick={() => handleJoinApply(post)}
                    disabled={isFull}
                    style={{
                      padding: '9px 18px',
                      backgroundColor: isFull ? '#cbd5e1' : post.category === 'field' ? '#047857' : '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: isFull ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isFull ? '모집 완료' : '참여 신청하기 →'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 5. 조인/벙개 등록 모달 */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
              📝 {category === 'field' ? '필드 라운딩 조인 등록' : '스크린 벙개 모임 등록'}
            </h3>

            <form onSubmit={handleSavePost} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>모집 글 제목</label>
                <input
                  type="text"
                  placeholder="예: 이번 주말 오전 동반자 2분 모십니다"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>지역</label>
                  <select
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px' }}
                  >
                    <option value="서울/경기">서울/경기</option>
                    <option value="부산/경남">부산/경남</option>
                    <option value="대구/경북">대구/경북</option>
                    <option value="충청/대전">충청/대전</option>
                    <option value="전라/광주">전라/광주</option>
                    <option value="강원/제주">강원/제주</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    {category === 'field' ? '골프장명' : '스크린 매장명'}
                  </label>
                  <input
                    type="text"
                    placeholder={category === 'field' ? '예: 동래베네스트CC' : '예: 골프존파크 센텀점'}
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>일시</label>
                  <input
                    type="text"
                    placeholder="예: 10월 12일 (토)"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>티오프 / 시작 시간</label>
                  <input
                    type="text"
                    placeholder="예: 07:28 또는 19:30"
                    value={newTeeTime}
                    onChange={(e) => setNewTeeTime(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>현재 인원</label>
                  <input
                    type="number"
                    value={newCurrentMembers}
                    onChange={(e) => setNewCurrentMembers(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>총 모집 정원</label>
                  <input
                    type="number"
                    value={newTargetMembers}
                    onChange={(e) => setNewTargetMembers(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>비용 안내 (그린피 / 게임비)</label>
                <input
                  type="text"
                  placeholder="예: 그린피 18만원 / 스크린 2.5만"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>상세 소개 및 당부 말씀</label>
                <textarea
                  rows={3}
                  placeholder="매너 있고 즐겁게 함께하실 동반자 환영합니다!"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ flex: 1, padding: '10px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', backgroundColor: '#047857', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}