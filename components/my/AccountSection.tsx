'use client'

import { CARD, muted } from './myStyles'
import { AgreementDetails } from '@/components/auth/AgreementDetails'
import { palette } from '@/utils/theme'

/** 약관·개인정보 보기와 회원 탈퇴. */
export default function AccountSection({ withdrawing, withdrawAccount }: { withdrawing: boolean; withdrawAccount: () => Promise<void> }) {
  return (
    <>
      <section style={CARD} aria-labelledby="account-policy-title">
        <h2 id="account-policy-title" style={{ margin: '0 0 8px', fontSize: 16 }}>약관·개인정보·탈퇴</h2>
        <AgreementDetails kind="terms" />
        <AgreementDetails kind="privacy" />
        <p style={muted}>탈퇴 시 계정·라운드·샷 기록을 삭제합니다. 탈퇴 처리 기록은 6개월 뒤 자동 삭제됩니다.</p>
        <button type="button" disabled={withdrawing} onClick={() => void withdrawAccount()} style={{ border: `1px solid ${palette.red200}`, borderRadius: 7, padding: '8px 12px', color: palette.red700, background: palette.white }}>{withdrawing ? '탈퇴 처리 중…' : '회원 탈퇴'}</button>
      </section>
    </>
  )
}
