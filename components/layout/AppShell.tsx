'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AuthModal from '@/components/auth/AuthModal'
import { createClient } from '@/utils/supabase/client'

export const TAB_ITEMS = [
  { href: '/home', icon: '🏠', label: '홈' },
  { href: '/join', icon: '👥', label: '조인/벙개' },
  { href: '/score', icon: '⛳', label: '스코어' },
  { href: '/video', icon: '🎬', label: '영상' },
  { href: '/lesson', icon: '👨‍🏫', label: '레슨' },
  { href: '/shop', icon: '🛒', label: '쇼핑' },
  { href: '/my', icon: '👤', label: 'MY' },
] as const

interface AppShellState {
  isLoggedIn: boolean
  authLoading: boolean
  userNickname: string
  chromeVisible: boolean
  openAuthModal: () => void
}

const AppShellContext = createContext<AppShellState | null>(null)

export function useAppShell(): AppShellState {
  const value = useContext(AppShellContext)
  if (!value) throw new Error('useAppShell은 AppShell 안에서만 사용할 수 있습니다.')
  return value
}

// 모든 탭 페이지가 함께 쓰는 상단바, 하단 메뉴, 로그인 상태. 탭을 옮겨도 다시 마운트되지 않는다.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [userNickname, setUserNickname] = useState<string>('골퍼')
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false)
  const [authLoading, setAuthLoading] = useState<boolean>(true)
  const [chromeVisible, setChromeVisible] = useState(true)
  const mainRef = useRef<HTMLElement | null>(null)
  const hasScrollableContentRef = useRef(false)
  const chromeHideTimer = useRef<number | null>(null)
  const chromeVisibleRef = useRef(true)
  const scrollPositions = useRef(new WeakMap<EventTarget, number>())
  const scrollDistance = useRef(0)

  const supabase = useMemo(() => createClient(), [])

  const showChrome = useCallback(() => {
    chromeVisibleRef.current = true
    scrollDistance.current = 0
    setChromeVisible(true)
    if (chromeHideTimer.current) window.clearTimeout(chromeHideTimer.current)
    if (!hasScrollableContentRef.current) return
    chromeHideTimer.current = window.setTimeout(() => {
      if (!hasScrollableContentRef.current) {
        chromeVisibleRef.current = true
        setChromeVisible(true)
        return
      }
      chromeVisibleRef.current = false
      scrollDistance.current = 0
      setChromeVisible(false)
    }, 2500)
  }, [])

  useEffect(() => {
    const measureScrollableContent = () => {
      const canScroll = document.documentElement.scrollHeight > window.innerHeight + 1
      const changed = hasScrollableContentRef.current !== canScroll
      hasScrollableContentRef.current = canScroll
      if (!canScroll) {
        if (chromeHideTimer.current) window.clearTimeout(chromeHideTimer.current)
        chromeVisibleRef.current = true
        setChromeVisible(true)
      } else if (changed) {
        showChrome()
      }
    }
    const onScroll = (event: Event) => {
      if (!hasScrollableContentRef.current) return
      const target = event.target
      if (!(target instanceof Document) && !(target instanceof Element)) return
      const top = target instanceof Document ? window.scrollY : target.scrollTop
      const previousTop = scrollPositions.current.get(target) ?? 0
      scrollPositions.current.set(target, top)
      const moved = Math.abs(top - previousTop)
      if (moved === 0) return
      if (chromeVisibleRef.current) {
        showChrome()
      } else {
        scrollDistance.current += moved
        if (scrollDistance.current >= 30) showChrome()
      }
    }
    measureScrollableContent()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', measureScrollableContent)
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureScrollableContent) : null
    const mutationObserver = typeof MutationObserver !== 'undefined' ? new MutationObserver(measureScrollableContent) : null
    if (mainRef.current) {
      resizeObserver?.observe(mainRef.current)
      mutationObserver?.observe(mainRef.current, { childList: true, subtree: true, attributes: true })
    }
    measureScrollableContent()
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', measureScrollableContent)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      if (chromeHideTimer.current) window.clearTimeout(chromeHideTimer.current)
    }
  }, [showChrome, pathname, isLoggedIn, authLoading, isAuthModalOpen])

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

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), [])
  const shellState = useMemo(
    () => ({ isLoggedIn, authLoading, userNickname, chromeVisible, openAuthModal }),
    [isLoggedIn, authLoading, userNickname, chromeVisible, openAuthModal]
  )

  return (
    <AppShellContext.Provider value={shellState}>
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', paddingBottom: '80px', fontFamily: 'sans-serif' }}>

        {/* 1. 상단 글로벌 탑바 */}
        <header
          aria-hidden={!chromeVisible}
          inert={!chromeVisible}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
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
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#047857', letterSpacing: '-0.5px' }}>
                  GOLF SECRETARY
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>골프 비서 & 라운드 플랫폼</div>
              </div>
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {authLoading ? (
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>인증 확인 중...</span>
              ) : isLoggedIn ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Link
                    href="/my"
                    style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                  >
                    <span style={{ color: '#047857' }}>●</span> {userNickname}님
                  </Link>
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
                  onClick={openAuthModal}
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
        <main ref={mainRef} style={{ maxWidth: '1000px', margin: '0 auto', paddingTop: '80px' }}>
          {children}
        </main>

        {/* 3. 하단 고정 메인 네비게이션 바 */}
        <nav
          aria-hidden={!chromeVisible}
          inert={!chromeVisible}
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
            transform: chromeVisible ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 220ms ease',
          }}
        >
          {TAB_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  flex: 1,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  color: isActive ? '#047857' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '18px', filter: isActive ? 'none' : 'grayscale(40%)' }}>{item.icon}</span>
                <span style={{ fontSize: '11px', fontWeight: isActive ? 'bold' : 'normal', marginTop: '2px' }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* 4. Supabase AuthModal (실제 로그인 / 회원가입) */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />

      </div>
    </AppShellContext.Provider>
  )
}
