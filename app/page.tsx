'use client'

import React, { useState, useEffect } from 'react'
import ScoreTab from '@/components/score/ScoreTab'
import MyTab from '@/components/my/MyTab'
import JoinTab from '@/components/join/JoinTab'
import AuthModal from '@/components/auth/AuthModal'
import { createClient } from '@/utils/supabase/client'

// 탭 종류 정의 (조인 탭 포함)
type TabType = 'home' | 'join' | 'score' | 'video' | 'lesson' | 'shop' | 'my'

export default function GolfPlatformPage() {
  const [activeTab, setActiveTab] = useState<TabType>('score')
  const [userNickname, setUserNickname] = useState<string>('골퍼')
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false)
  const [authLoading, setAuthLoading] = useState<boolean>(true)

  const supabase = createClient()

  // Supabase 실시간 세션 및 프로필(닉네임) 감지
  useEffect(() => {
    // 세션 상태 구독 (로그인, 로그아웃, 토큰 갱신 등)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setIsLoggedIn(true)
        try {
          // profiles 테이블에서 DB에 저장된 실제 닉네임 조회
          const { data, error } = await supabase
            .from('profiles')
            .select('nickname')
            .eq('id', session.user.id)
            .single()

          if (!error && data?.nickname) {
            setUserNickname(data.nickname)
          } else {
            // 트리거 반영 직후이거나 메타데이터에 있는 경우 대비
            setUserNickname(session.user.user_metadata?.nickname || '골퍼')
          }
        } catch (err) {
          setUserNickname('골퍼')
        }
      } else {
        setIsLoggedIn(false)
        setUserNickname('골퍼')
      }
      setAuthLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  // 실제 Supabase 로그아웃
  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await supabase.auth.signOut()
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', paddingBottom: '130px', fontFamily: 'sans-serif' }}>
      
      {/* 1. 상단 글로벌 탑바 */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '12px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            onClick={() => setActiveTab('home')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '24px' }}>⛳</span>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#047857', letterSpacing: '-0.5px' }}>
                GOLF SECRETARY
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>골프 비서 & 라운드 플랫폼</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {authLoading ? (
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>인증 확인 중...</span>
            ) : isLoggedIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  onClick={() => setActiveTab('my')}
                  style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span style={{ color: '#047857' }}>●</span> {userNickname}님
                </span>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                로그인 / 회원가입
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. 메인 컨텐츠 영역 */}
      <main style={{ maxWidth: '1000px', margin: '0 auto', paddingTop: '8px' }}>
        
        {/* ① 홈 탭 */}
        {activeTab === 'home' && (
          <div style={{ padding: '16px' }}>
            <div style={{ backgroundColor: '#0f172a', color: '#fff', padding: '24px', borderRadius: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px' }}>TODAY'S GOLF BRIEFING</div>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '22px' }}>{userNickname}님, 오늘 라운드 준비되셨나요?</h2>
              <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', lineHeight: 1.5 }}>
                동반자 조인부터 필드 샷 트래킹, 스윙 분석까지 한곳에서 관리하세요.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActiveTab('score')}
                  style={{ padding: '10px 18px', backgroundColor: '#047857', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                >
                  ⛳ 실시간 스코어 기록
                </button>
                <button
                  onClick={() => setActiveTab('join')}
                  style={{ padding: '10px 18px', backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #38bdf8', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                >
                  👥 동반자 조인 / 벙개 찾기
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div onClick={() => setActiveTab('join')} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>👥</div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>필드 조인 & 스크린 벙개</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>인원이 부족할 때 매너 있는 골프 동반자를 구해보세요.</p>
              </div>
              <div onClick={() => setActiveTab('video')} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎬</div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>골프 영상 & 레슨 피드</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>드라이버 비거리, 숏게임 원포인트 레슨 영상</p>
              </div>
              <div onClick={() => setActiveTab('shop')} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔥</div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>골프용품 공동구매</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>골프공, 장갑, 거리측정기 최저가 핫딜</p>
              </div>
            </div>
          </div>
        )}

        {/* ② 조인 탭 */}
        {activeTab === 'join' && <JoinTab />}

        {/* ③ 스코어 탭 */}
        {activeTab === 'score' && (
  authLoading ? (
    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>인증 확인 중...</div>
  ) : isLoggedIn ? (
    <ScoreTab />
  ) : (
    <div style={{ padding: '40px 16px', textAlign: 'center' }}>
      <p style={{ fontSize: '14px', color: '#475569', marginBottom: '12px' }}>
        라운드를 기록하려면 로그인이 필요합니다.
      </p>
      <button onClick={() => setIsAuthModalOpen(true)} style={{ padding: '10px 18px', backgroundColor: '#047857', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
        로그인 / 회원가입
      </button>
    </div>
  )
)}

        {/* ④ 골프 영상 탭 */}
        {activeTab === 'video' && (
          <div style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 16px 0' }}>🎬 맞춤 골프 영상 피드</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {[
                { title: '드라이버 슬라이스 10분 만에 완치하는 릴리즈 공식', pro: '김태훈 프로', view: '2.4만회' },
                { title: '아이언 정타율 200% 올려주는 하체 회전 비결', pro: '이정은 프로', view: '1.8만회' },
                { title: '3퍼트 절대 안 하는 5m 거리감 맞추기 레슨', pro: '박민수 프로', view: '3.1만회' },
              ].map((v, i) => (
                <div key={i} style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ height: '140px', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '32px' }}>
                    ▶
                  </div>
                  <div style={{ padding: '14px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 'bold' }}>{v.title}</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                      <span>{v.pro}</span>
                      <span>조회수 {v.view}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ⑤ 레슨 프로 탭 */}
        {activeTab === 'lesson' && (
          <div style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 16px 0' }}>👨‍🏫 레슨 프로 찾기 & 영상 문의</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { name: '김진우 프로', spec: 'KPGA 투어프로 / 12년 경력', loc: '부산 해운대', field: '드라이버 비거리 교정 전문' },
                { name: '이지안 프로', spec: 'KLPGA 정회원 / 국가대표 상비군 출신', loc: '서울 강남', field: '숏게임 & 퍼팅 정밀 레슨' },
              ].map((p, i) => (
                <div key={i} style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{p.name} <span style={{ fontSize: '12px', color: '#047857' }}>● 레슨 가능</span></h3>
                    <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{p.spec} · {p.loc}</div>
                    <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '2px' }}>주요 분야: {p.field}</div>
                  </div>
                  <button
                    onClick={() => alert(`${p.name} 프로에게 스윙 영상 문의 기능이 준비되었습니다.`)}
                    style={{ padding: '8px 16px', backgroundColor: '#047857', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                  >
                    📹 스윙 영상으로 문의하기
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ⑥ 쇼핑 탭 */}
        {activeTab === 'shop' && (
          <div style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 16px 0' }}>🛒 골프용품 공동구매 특가</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {[
                { name: '타이틀리스트 PRO V1 (1더즌)', price: '52,000원', original: '68,000원', participants: 184 },
                { name: '보이스캐디 프리미엄 레이저 거리측정기', price: '249,000원', original: '380,000원', participants: 92 },
              ].map((item, i) => (
                <div key={i} style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', backgroundColor: '#dc2626', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>공구 마감 D-2</span>
                  <h3 style={{ margin: '8px 0', fontSize: '16px', fontWeight: 'bold' }}>{item.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc2626' }}>{item.price}</span>
                    <span style={{ fontSize: '13px', color: '#94a3b8', textDecoration: 'line-through' }}>{item.original}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#047857', marginTop: '6px' }}>현재 {item.participants}명 참여 중!</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ⑦ MY 탭 */}
        {activeTab === 'my' && <MyTab />}

      </main>

      {/* 3. 하단 상시 노출 광고 배너 영역 */}
      <div
        style={{
          position: 'fixed',
          bottom: '64px',
          left: 0,
          right: 0,
          zIndex: 40,
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          borderBottom: '1px solid #e2e8f0',
          padding: '8px 16px',
          textAlign: 'center',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
            <span style={{ fontSize: '10px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 5px', borderRadius: '4px', color: '#64748b' }}>
              AD
            </span>
            <span>🏌️ <strong>2026 시즌 신상 비거리 드라이버 특가전</strong> (사은품 증정)</span>
          </div>
          <button
            onClick={() => setActiveTab('shop')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            자세히 보기
          </button>
        </div>
      </div>

      {/* 4. 하단 고정 메인 네비게이션 바 */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          height: '64px',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
        }}
      >
        {[
          { id: 'home', icon: '🏠', label: '홈' },
          { id: 'join', icon: '👥', label: '조인/벙개' },
          { id: 'score', icon: '⛳', label: '스코어' },
          { id: 'video', icon: '🎬', label: '영상' },
          { id: 'lesson', icon: '👨‍🏫', label: '레슨' },
          { id: 'shop', icon: '🛒', label: '쇼핑' },
          { id: 'my', icon: '👤', label: 'MY' },
        ].map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as TabType)}
              style={{
                flex: 1,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: isActive ? '#047857' : '#64748b',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '18px', filter: isActive ? 'none' : 'grayscale(40%)' }}>{item.icon}</span>
              <span style={{ fontSize: '11px', fontWeight: isActive ? 'bold' : 'normal', marginTop: '2px' }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* 5. Supabase AuthModal (실제 로그인 / 회원가입) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

    </div>
  )
}