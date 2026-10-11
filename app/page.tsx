'use client'

import React, { useState, useEffect, useMemo } from 'react'
import ScoreTab from '@/components/score/ScoreTab'
import MyTab from '@/components/my/MyTab'
import ComingSoonTab from '@/components/layout/ComingSoonTab'
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

  const supabase = useMemo(() => createClient(), [])

  // Supabase 실시간 세션 및 프로필(닉네임) 감지
  useEffect(() => {
    let currentUserId: string | null = null
    // 세션 상태 구독 (로그인, 로그아웃, 토큰 갱신 등)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        currentUserId = session.user.id
        setIsLoggedIn(true)
        setUserNickname(session.user.user_metadata?.nickname || '골퍼')
        queueMicrotask(() => {
          void supabase
            .from('profiles')
            .select('nickname')
            .eq('id', session.user.id)
            .single()
            .then(({ data, error }) => {
              if (!error && data?.nickname && currentUserId === session.user.id) setUserNickname(data.nickname)
            })
        })
      } else {
        currentUserId = null
        setIsLoggedIn(false)
        setUserNickname('골퍼')
      }
      setAuthLoading(false)
    })

    return () => {
      currentUserId = null
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
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            aria-label="Golf Secretary 홈으로 이동"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: 0, padding: 0, background: 'transparent', textAlign: 'left' }}
          >
            <span style={{ fontSize: '24px' }}>⛳</span>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#047857', letterSpacing: '-0.5px' }}>
                GOLF SECRETARY
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>골프 비서 & 라운드 플랫폼</div>
            </div>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {authLoading ? (
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>인증 확인 중...</span>
            ) : isLoggedIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('my')}
                  style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', border: 0, padding: 0, background: 'transparent' }}
                >
                  <span style={{ color: '#047857' }}>●</span> {userNickname}님
                </button>
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
              <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px' }}>TODAY&apos;S GOLF BRIEFING</div>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '22px' }}>{userNickname}님, 오늘 라운드 준비되셨나요?</h2>
              <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', lineHeight: 1.5 }}>
                라운드와 모든 샷 기록을 쌓고, 내 데이터에 맞춘 분석과 연습 방향을 확인하세요.
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
                  👥 조인·벙개 (서비스 준비 중)
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <button type="button" onClick={() => setActiveTab('join')} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>👥</div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>필드 조인 & 스크린 벙개</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>곧 서비스가 시작됩니다.</p>
              </button>
              <button type="button" onClick={() => setActiveTab('video')} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎬</div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>골프 영상 & 레슨 피드</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>데이터와 연결되는 맞춤 영상 서비스를 준비하고 있습니다.</p>
              </button>
              <button type="button" onClick={() => setActiveTab('shop')} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔥</div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>골프용품 공동구매</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>곧 서비스를 시작할 예정입니다.</p>
              </button>
            </div>
          </div>
        )}

        {/* ② 조인 탭 */}
        {activeTab === 'join' && <ComingSoonTab area="join" onGoToScore={() => setActiveTab('score')} />}

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
        {activeTab === 'video' && <ComingSoonTab area="video" onGoToScore={() => setActiveTab('score')} />}

        {/* ⑤ 레슨 프로 탭 */}
        {activeTab === 'lesson' && <ComingSoonTab area="lesson" onGoToScore={() => setActiveTab('score')} />}

        {/* ⑥ 쇼핑 탭 */}
        {activeTab === 'shop' && <ComingSoonTab area="shop" onGoToScore={() => setActiveTab('score')} />}

        {/* ⑦ MY 탭 */}
        {activeTab === 'my' && <MyTab />}

      </main>

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
