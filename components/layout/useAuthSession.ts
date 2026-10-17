'use client'

import { useEffect, useState } from 'react'
import { forgetLastUserId, type createClient } from '@/utils/supabase/client'

/**
 * Supabase 로그인 상태와 닉네임을 구독한다(로그인, 로그아웃, 토큰 갱신 등).
 * 비밀번호 재설정 메일 링크로 들어오면 onPasswordRecovery를 부른다. onPasswordRecovery는 바뀌지 않는 함수여야 한다.
 */
export function useAuthSession(supabase: ReturnType<typeof createClient>, onPasswordRecovery: () => void) {
  const [userNickname, setUserNickname] = useState<string>('골퍼')
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [authLoading, setAuthLoading] = useState<boolean>(true)

  useEffect(() => {
    let currentUserId: string | null = null
    // 세션 상태 구독 (로그인, 로그아웃, 토큰 갱신 등)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') onPasswordRecovery()
      if (event === 'SIGNED_OUT') forgetLastUserId()
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
  }, [supabase, onPasswordRecovery])

  return { isLoggedIn, authLoading, userNickname }
}
