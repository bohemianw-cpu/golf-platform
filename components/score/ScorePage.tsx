'use client'

import { useRouter } from 'next/navigation'
import ScoreTab from '@/components/score/ScoreTab'
import { useAppShell } from '@/components/layout/AppShell'
import { color, palette } from '@/utils/theme'

// 로그인한 사용자만 스코어를 기록한다. 샘플 입력은 /score?sample=<id>로 들어온다.
export default function ScorePage({ sampleSessionId }: { sampleSessionId: string | null }) {
  const router = useRouter()
  const { authLoading, isLoggedIn, chromeVisible, openAuthModal } = useAppShell()

  if (authLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: palette.slate400, fontSize: '13px' }}>인증 확인 중...</div>
  }
  if (!isLoggedIn) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: palette.slate600, marginBottom: '12px' }}>
          라운드를 기록하려면 로그인이 필요합니다.
        </p>
        <button onClick={openAuthModal} style={{ padding: '10px 18px', backgroundColor: color.brand, color: palette.white, border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
          로그인 / 회원가입
        </button>
      </div>
    )
  }
  // 실제 기록과 샘플 기록은 서로 다른 라운드 상태를 쓰므로 전환할 때 새로 마운트한다.
  return (
    <ScoreTab
      key={sampleSessionId ?? 'real'}
      bottomNavVisible={chromeVisible}
      sampleSessionId={sampleSessionId}
      onExitSample={() => router.push('/my')}
    />
  )
}
