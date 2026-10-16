'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import AuthModal from '@/components/auth/AuthModal'
import PasswordRecoveryModal from '@/components/auth/PasswordRecoveryModal'
import ErrorReporter from '@/components/layout/ErrorReporter'
import { createClient } from '@/utils/supabase/client'
import { palette } from '@/utils/theme'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import { useAutoHideChrome } from './useAutoHideChrome'
import { useAuthSession } from './useAuthSession'

export { TAB_ITEMS } from './tabs'

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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false)
  const [isPasswordRecoveryOpen, setIsPasswordRecoveryOpen] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const openPasswordRecovery = useCallback(() => {
    setIsAuthModalOpen(false)
    setIsPasswordRecoveryOpen(true)
  }, [])
  const { isLoggedIn, authLoading, userNickname } = useAuthSession(supabase, openPasswordRecovery)
  const { chromeVisible, mainRef } = useAutoHideChrome(`${pathname}|${isLoggedIn}|${authLoading}|${isAuthModalOpen}`)

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
      <ErrorReporter />
      <div style={{ minHeight: '100vh', backgroundColor: palette.slate50, color: palette.slate900, paddingBottom: '80px', fontFamily: 'sans-serif' }}>

        {/* 1. 상단 글로벌 탑바 */}
        <TopBar chromeVisible={chromeVisible} authLoading={authLoading} isLoggedIn={isLoggedIn} userNickname={userNickname} handleLogout={handleLogout} openAuthModal={openAuthModal} />

        {/* 2. 메인 컨텐츠 영역 */}
        <main ref={mainRef} style={{ maxWidth: '1000px', margin: '0 auto', paddingTop: '80px' }}>
          {children}
        </main>

        {/* 3. 하단 고정 메인 네비게이션 바 */}
        <BottomNav chromeVisible={chromeVisible} pathname={pathname} />

        {/* 4. Supabase AuthModal (실제 로그인 / 회원가입) */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
        {isPasswordRecoveryOpen && <PasswordRecoveryModal onClose={() => setIsPasswordRecoveryOpen(false)} />}

      </div>
    </AppShellContext.Provider>
  )
}
