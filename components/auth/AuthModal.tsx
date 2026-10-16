'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getGolfLevelGroup } from '@/utils/golf/levels'
import { AI_ANALYSIS_CONSENT_VERSION, PRIVACY_NOTICE_VERSION, SHARING_CONSENT_VERSION, SIGNUP_TERMS_VERSION } from '@/utils/consent'
import { passwordProblem } from '@/utils/password-check'
import { color, palette } from '@/utils/theme'
import { useModalKeyboard } from '@/components/layout/useModalKeyboard'
import SignUpProfileFields from './signup/SignUpProfileFields'
import RequiredAgreements from './signup/RequiredAgreements'
import OptionalConsents from './signup/OptionalConsents'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [isPasswordResetRequest, setIsPasswordResetRequest] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [handicapIndex, setHandicapIndex] = useState('')
  const [allowAnonymousAggregate, setAllowAnonymousAggregate] = useState(false)
  const [allowFriendSharing, setAllowFriendSharing] = useState(false)
  const [allowAiAnalysis, setAllowAiAnalysis] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acknowledgedPrivacy, setAcknowledgedPrivacy] = useState(false)
  const [ageOver14, setAgeOver14] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [noticeMsg, setNoticeMsg] = useState('')
  const dialogRef = useModalKeyboard<HTMLDivElement>(isOpen, onClose)

  if (!isOpen) return null

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    if (isSignUp) setNoticeMsg('')

    try {
      if (isPasswordResetRequest) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setIsPasswordResetRequest(false)
        setPassword('')
        setNoticeMsg('비밀번호 재설정 메일을 요청했습니다. 메일의 링크를 요청한 브라우저에서 열어 새 비밀번호를 설정해 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요.')
      } else if (isSignUp) {
        if (!acceptedTerms || !acknowledgedPrivacy || !ageOver14) throw new Error('필수 약관·개인정보 안내·만 14세 이상 확인을 완료해 주세요.')
        const parsedHandicap = handicapIndex.trim() === '' ? null : Number(handicapIndex)
        if (parsedHandicap !== null && (!Number.isFinite(parsedHandicap) || parsedHandicap < -10 || parsedHandicap > 54)) {
          throw new Error('핸디캡은 -10부터 54 사이로 입력해 주세요.')
        }
        const skillGroup = getGolfLevelGroup(parsedHandicap)
        // Supabase 무료 요금제에는 유출 비밀번호 차단이 없어 가입 전에 앱에서 확인한다.
        const problem = await passwordProblem(password)
        if (problem) throw new Error(problem)

        // 프로필 생성 트리거에서 활용할 수 있도록 가입 메타데이터에 함께 저장
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              nickname: nickname.trim() || '골퍼',
              handicap_index: parsedHandicap,
              skill_group: skillGroup,
              skill_group_source: 'self_reported',
              allow_anonymous_aggregate: allowAnonymousAggregate,
              allow_friend_sharing: allowFriendSharing,
              allow_ai_practice_analysis: allowAiAnalysis,
              data_consent_version: SHARING_CONSENT_VERSION,
              ai_consent_version: AI_ANALYSIS_CONSENT_VERSION,
              signup_terms_version: SIGNUP_TERMS_VERSION,
              privacy_notice_version: PRIVACY_NOTICE_VERSION,
              age_over_14_confirmed: ageOver14,
            },
          },
        })
        if (error) throw error
        if (data.session) {
          onClose()
        } else {
          setPassword('')
          setIsSignUp(false)
          setNoticeMsg('가입 신청이 접수되었습니다. 이메일로 보낸 인증 링크를 확인해 주세요. 인증 후 자동으로 로그인되지 않으면 이 화면에서 로그인해 주세요.')
        }
      } else {
        // 로그인
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        setNoticeMsg('')
        onClose()
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '인증 처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" style={{
        backgroundColor: palette.white,
        borderRadius: '16px',
        width: '100%',
        maxWidth: '380px',
        maxHeight: 'calc(100dvh - 32px)',
        overflowY: 'auto',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 id="auth-modal-title" style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
            {isPasswordResetRequest ? '비밀번호 재설정' : isSignUp ? '골프 비서 회원가입' : '골프 비서 로그인'}
          </h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: palette.neutral888 }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div role="alert" style={{
            backgroundColor: palette.red100,
            color: palette.red600,
            padding: '10px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '14px'
          }}>
            {errorMsg}
          </div>
        )}

        {noticeMsg && (
          <div role="status" style={{
            backgroundColor: palette.emerald50,
            color: palette.emerald800,
            padding: '12px',
            borderRadius: '8px',
            border: `1px solid ${palette.emerald200}`,
            fontSize: '13px',
            lineHeight: 1.5,
            marginBottom: '14px',
          }}>
            {noticeMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SignUpProfileFields isSignUp={isSignUp} nickname={nickname} setNickname={setNickname} handicapIndex={handicapIndex} setHandicapIndex={setHandicapIndex} />

          <div>
            <label style={{ fontSize: '12px', color: palette.neutral666, display: 'block', marginBottom: '4px' }} htmlFor="auth-email">이메일</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@golf.com"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${palette.neutralDdd}`, boxSizing: 'border-box' }}
            />
          </div>

          {!isPasswordResetRequest && <div>
            <label style={{ fontSize: '12px', color: palette.neutral666, display: 'block', marginBottom: '4px' }} htmlFor="auth-password">비밀번호</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              minLength={isSignUp ? 8 : 6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? '8자 이상, 다른 곳에서 쓰지 않는 비밀번호' : '비밀번호 입력'}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${palette.neutralDdd}`, boxSizing: 'border-box' }}
            />
          </div>}

          <RequiredAgreements isSignUp={isSignUp} acceptedTerms={acceptedTerms} setAcceptedTerms={setAcceptedTerms} acknowledgedPrivacy={acknowledgedPrivacy} setAcknowledgedPrivacy={setAcknowledgedPrivacy} ageOver14={ageOver14} setAgeOver14={setAgeOver14} />

          <OptionalConsents isSignUp={isSignUp} allowAnonymousAggregate={allowAnonymousAggregate} setAllowAnonymousAggregate={setAllowAnonymousAggregate} allowFriendSharing={allowFriendSharing} setAllowFriendSharing={setAllowFriendSharing} allowAiAnalysis={allowAiAnalysis} setAllowAiAnalysis={setAllowAiAnalysis} />

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: palette.emerald500,
              color: palette.white,
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px'
            }}
          >
            {loading ? '처리 중...' : isPasswordResetRequest ? '재설정 메일 보내기' : isSignUp ? '가입하기' : '로그인'}
          </button>
        </form>

        {!isSignUp && !isPasswordResetRequest && <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button type="button" onClick={() => { setIsPasswordResetRequest(true); setErrorMsg(''); setNoticeMsg('') }} style={{ background: 'none', border: 0, color: color.brand, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            비밀번호를 잊으셨나요?
          </button>
        </div>}

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => { if (isPasswordResetRequest) setIsPasswordResetRequest(false); else setIsSignUp(!isSignUp); setErrorMsg(''); setNoticeMsg(''); setAllowAnonymousAggregate(false); setAllowFriendSharing(false); setAllowAiAnalysis(false); setAcceptedTerms(false); setAcknowledgedPrivacy(false); setAgeOver14(false) }}
            style={{ background: 'none', border: 'none', color: palette.gray600, fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isPasswordResetRequest ? '로그인으로 돌아가기' : isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
          </button>
        </div>
      </div>
    </div>
  )
}
