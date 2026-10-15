'use client'

import { useEffect } from 'react'
import { reportClientError } from '@/components/layout/clientErrorReporter'

// 탭 화면을 그리다 오류가 나면 이 화면을 보여 주고 오류를 서버에 보낸다. 상단바와 하단 메뉴는 그대로 남는다.
export default function TabError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportClientError('render', error, error.digest)
  }, [error])

  return (
    <section role="alert" style={{ maxWidth: '520px', margin: '48px auto', padding: '28px 22px', textAlign: 'center', background: '#fff', border: '1px solid #fecaca', borderRadius: '16px' }}>
      <h1 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '20px' }}>화면을 불러오지 못했습니다</h1>
      <p style={{ margin: '0 0 18px', color: '#64748b', fontSize: '13px', lineHeight: 1.6 }}>
        잠시 후 다시 시도해 주세요. 입력 중이던 스코어는 이 기기에 보관되어 있습니다.
      </p>
      <button type="button" onClick={() => retry()} style={{ padding: '10px 18px', border: 0, borderRadius: '8px', background: '#047857', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
        다시 시도
      </button>
    </section>
  )
}
