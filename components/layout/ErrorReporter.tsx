'use client'

import { useEffect } from 'react'
import { reportClientError } from './clientErrorReporter'
import { takeEarlyErrors } from './earlyErrorBuffer'

/**
 * 화면에서 처리되지 않은 오류와 비동기 오류를 모아 서버에 보낸다. 화면에는 아무것도 그리지 않는다.
 * 화면이 준비되기 전에 생긴 오류는 페이지 맨 앞 스크립트가 모아 두었다가 여기서 함께 보낸다.
 */
export default function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportClientError('error', event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent) => reportClientError('unhandledrejection', event.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    // 새 수집기를 붙인 뒤 앞선 수집을 멈추므로 그 사이 오류도 빠지지 않는다. 겹친 오류는 보고기가 한 번만 보낸다.
    for (const early of takeEarlyErrors()) reportClientError(early.kind, early.reason)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
