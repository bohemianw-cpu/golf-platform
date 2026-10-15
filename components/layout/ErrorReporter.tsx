'use client'

import { useEffect } from 'react'
import { reportClientError } from './clientErrorReporter'

/** 화면에서 처리되지 않은 오류와 비동기 오류를 모아 서버에 보낸다. 화면에는 아무것도 그리지 않는다. */
export default function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportClientError('error', event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent) => reportClientError('unhandledrejection', event.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
