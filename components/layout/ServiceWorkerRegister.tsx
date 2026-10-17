'use client'

import { useEffect } from 'react'

/**
 * 빌드한 앱(배포·next start)에서만 서비스 워커를 등록해, 신호가 없어도 앱이 열리게 한다.
 * 개발 모드에서는 바뀐 화면 대신 저장본이 보이지 않도록 등록하지 않고, 남아 있던 등록도 지운다.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => void registration.unregister()))
      return
    }
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
  }, [])
  return null
}
