'use client'

import { color, palette } from '@/utils/theme'
import Link from 'next/link'

/** 상단바: 홈 로고와 로그인 상태(닉네임·로그아웃 또는 로그인 버튼). 스크롤하면 숨는다. */
export default function TopBar({ chromeVisible, authLoading, isLoggedIn, userNickname, handleLogout, openAuthModal }: { chromeVisible: boolean; authLoading: boolean; isLoggedIn: boolean; userNickname: string; handleLogout: () => Promise<void>; openAuthModal: () => void }) {
  return (
    <>
      <header
        aria-hidden={!chromeVisible}
        inert={!chromeVisible}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          backgroundColor: palette.white,
          borderBottom: `1px solid ${palette.slate200}`,
          padding: '12px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          transform: chromeVisible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 220ms ease',
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link
            href="/home"
            aria-label="Golf Secretary 홈으로 이동"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', textAlign: 'left' }}
          >
            <span style={{ fontSize: '24px' }}>⛳</span>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: color.brand, letterSpacing: '-0.5px' }}>
                GOLF SECRETARY
              </div>
              <div style={{ fontSize: '10px', color: palette.slate500, fontWeight: 600 }}>골프 비서 & 라운드 플랫폼</div>
            </div>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {authLoading ? (
              <span style={{ fontSize: '12px', color: palette.slate400 }}>인증 확인 중...</span>
            ) : isLoggedIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link
                  href="/my"
                  style={{ fontSize: '13px', fontWeight: 'bold', color: palette.slate900, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                >
                  <span style={{ color: color.brand }}>●</span> {userNickname}님
                </Link>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    backgroundColor: palette.slate100,
                    color: palette.slate500,
                    border: `1px solid ${palette.slate300}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backgroundColor: color.brand,
                  color: palette.white,
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
    </>
  )
}
