'use client'

import type { Dispatch, SetStateAction } from 'react'
import { palette } from '@/utils/theme'
import { AgreementDetails } from '../AgreementDetails'

/** 가입에 꼭 필요한 약관·개인정보 안내·만 14세 이상 확인. */
export default function RequiredAgreements({ isSignUp, acceptedTerms, setAcceptedTerms, acknowledgedPrivacy, setAcknowledgedPrivacy, ageOver14, setAgeOver14 }: { isSignUp: boolean; acceptedTerms: boolean; setAcceptedTerms: Dispatch<SetStateAction<boolean>>; acknowledgedPrivacy: boolean; setAcknowledgedPrivacy: Dispatch<SetStateAction<boolean>>; ageOver14: boolean; setAgeOver14: Dispatch<SetStateAction<boolean>> }) {
  return (
    <>
      {isSignUp && <fieldset style={{ display: 'grid', gap: 10, margin: 0, padding: 12, border: `1px solid ${palette.slate300}`, borderRadius: 10, background: palette.white }}>
        <legend style={{ padding: '0 4px', fontSize: 12, fontWeight: 800 }}>가입에 필요한 확인</legend>
        <label><input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} /> [필수] 서비스 이용약관 동의</label>
        <AgreementDetails kind="terms" />
        <label><input type="checkbox" checked={acknowledgedPrivacy} onChange={e => setAcknowledgedPrivacy(e.target.checked)} /> [필수] 개인정보 처리 안내 확인</label>
        <AgreementDetails kind="privacy" />
        <label><input type="checkbox" checked={ageOver14} onChange={e => setAgeOver14(e.target.checked)} /> [필수] 만 14세 이상입니다</label>
      </fieldset>}
    </>
  )
}
