'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getGolfLevelGroup, GOLF_LEVEL_GROUPS } from '@/utils/golf/levels'
import { AgreementDetails } from './AgreementDetails'
import { AI_ANALYSIS_CONSENT_VERSION, PRIVACY_NOTICE_VERSION, SHARING_CONSENT_VERSION, SIGNUP_TERMS_VERSION } from '@/utils/consent'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false)
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

  if (!isOpen) return null

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      if (isSignUp) {
        if (!acceptedTerms || !acknowledgedPrivacy || !ageOver14) throw new Error('필수 약관·개인정보 안내·만 14세 이상 확인을 완료해 주세요.')
        const parsedHandicap = handicapIndex.trim() === '' ? null : Number(handicapIndex)
        if (parsedHandicap !== null && (!Number.isFinite(parsedHandicap) || parsedHandicap < -10 || parsedHandicap > 54)) {
          throw new Error('핸디캡은 -10부터 54 사이로 입력해 주세요.')
        }
        const skillGroup = getGolfLevelGroup(parsedHandicap)

        // 프로필 생성 트리거에서 활용할 수 있도록 가입 메타데이터에 함께 저장
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
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
        alert('회원가입이 완료되었습니다!')
        onClose()
      } else {
        // 로그인
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
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
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '380px',
        maxHeight: 'calc(100dvh - 32px)',
        overflowY: 'auto',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
            {isSignUp ? '골프 비서 회원가입' : '골프 비서 로그인'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '14px'
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isSignUp && (
            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>닉네임</label>
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="사용할 닉네임"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>
          )}

          {isSignUp && (
            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <label htmlFor="signup-handicap" style={{ fontSize: '12px', color: '#166534', display: 'block', marginBottom: '6px', fontWeight: 700 }}>
                핸디캡 지수 (선택)
              </label>
              <input
                id="signup-handicap"
                type="number"
                min="-10"
                max="54"
                step="0.1"
                inputMode="decimal"
                value={handicapIndex}
                onChange={(e) => setHandicapIndex(e.target.value)}
                placeholder="예: 24.0"
                aria-describedby="signup-handicap-help signup-level-preview"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #bbf7d0', boxSizing: 'border-box' }}
              />
              <div id="signup-handicap-help" style={{ marginTop: '6px', fontSize: '11px', lineHeight: 1.5, color: '#4b5563' }}>
                모르면 비워 두세요. 우선 초보 그룹으로 시작하고, 라운드 기록이 쌓이면 조정할 수 있습니다.
              </div>
              <div id="signup-level-preview" aria-live="polite" style={{ marginTop: '8px', fontSize: '12px', color: '#166534', fontWeight: 700 }}>
                비교 그룹: {GOLF_LEVEL_GROUPS[getGolfLevelGroup(handicapIndex.trim() ? Number(handicapIndex) : null)].label}
                <span style={{ display: 'block', marginTop: '3px', fontSize: '11px', fontWeight: 400, color: '#4b5563' }}>
                  {GOLF_LEVEL_GROUPS[getGolfLevelGroup(handicapIndex.trim() ? Number(handicapIndex) : null)].range}
                  {' · 프로 자격 인증이 아닌 실력 비교용 분류입니다.'}
                </span>
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@golf.com"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>비밀번호</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상 입력"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>

          {isSignUp && <fieldset style={{ display: 'grid', gap: 10, margin: 0, padding: 12, border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff' }}>
            <legend style={{ padding: '0 4px', fontSize: 12, fontWeight: 800 }}>가입에 필요한 확인</legend>
            <label><input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} /> [필수] 서비스 이용약관 동의</label>
            <AgreementDetails kind="terms" />
            <label><input type="checkbox" checked={acknowledgedPrivacy} onChange={e => setAcknowledgedPrivacy(e.target.checked)} /> [필수] 개인정보 처리 안내 확인</label>
            <AgreementDetails kind="privacy" />
            <label><input type="checkbox" checked={ageOver14} onChange={e => setAgeOver14(e.target.checked)} /> [필수] 만 14세 이상입니다</label>
          </fieldset>}

          {isSignUp && <fieldset style={{ display: 'grid', gap: 10, margin: 0, padding: 12, border: '1px solid #cbd5e1', borderRadius: 10, background: '#f8fafc' }}>
            <legend style={{ padding: '0 4px', color: '#0f172a', fontSize: 12, fontWeight: 800 }}>선택 동의 · 동의하지 않아도 가입할 수 있습니다</legend>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#334155', fontSize: 12, lineHeight: 1.5 }}>
              <input type="checkbox" checked={allowAnonymousAggregate} onChange={(event) => setAllowAnonymousAggregate(event.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
              <span><strong>라운드 통계의 익명 평균 분석 참여</strong><br />구장·플레이 방식·실력 그룹별 스코어, 퍼트, 페어웨이·그린 적중 통계를 비교 평균에 포함합니다. 이름·이메일·계정 ID는 비교 화면에 표시하지 않으며 5명 이상 표본에서만 결과를 제공합니다. 동의를 끄면 내 라운드는 평균 계산에서 제외됩니다.</span>
            </label>
            <details style={{ margin: '-5px 0 0 24px', color: '#475569', fontSize: 11, lineHeight: 1.55 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>통계 분석 항목과 이용 목적</summary>
              <p style={{ margin: '5px 0 0' }}>선택한 라운드의 구장, 필드/스크린 방식, 실력 그룹, 총 스코어·퍼트 및 홀별 페어웨이·그린 적중 정보를 서버에서 합산해 이용자 비교와 연습 분석을 제공합니다. 이름·이메일·계정 ID·샷별 목록은 평균 결과에 공개하지 않습니다. 설정을 철회하면 이후 평균 계산에서 제외됩니다.</p>
            </details>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#334155', fontSize: 12, lineHeight: 1.5 }}>
              <input type="checkbox" checked={allowFriendSharing} onChange={(event) => setAllowFriendSharing(event.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
              <span><strong>친구 비교 데이터 공유 동의</strong><br />상호 친구로 수락한 회원에게 내가 개별 라운드를 ‘친구 공개’로 지정한 경우에만 해당 라운드의 스코어·퍼트 평균을 제공합니다. 샷별 기록과 연락처는 공개하지 않습니다.</span>
            </label>
            <details style={{ margin: '-5px 0 0 24px', color: '#475569', fontSize: 11, lineHeight: 1.55 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>제공 대상·항목·철회 방법</summary>
              <p style={{ margin: '5px 0 0' }}>제공받는 사람은 서로 친구 요청을 수락한 서비스 회원이며 목적은 친구 간 라운드 평균 비교입니다. 공개 대상으로 지정한 완료 라운드의 스코어와 퍼트 집계만 제공합니다. 동의를 끄면 친구 공개 중인 라운드도 비공개로 바뀌며 다시 공개하려면 라운드별로 지정해야 합니다. 동의 거부 시 기본 스코어 기록은 계속 이용할 수 있습니다.</p>
            </details>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}><input type="checkbox" checked={allowAiAnalysis} onChange={e => setAllowAiAnalysis(e.target.checked)} /><span><strong>AI 연습 제안 분석</strong><br />샷 기록을 OpenAI API에 보내 개인 연습 제안을 받습니다.</span></label>
            <AgreementDetails kind="ai" />
            <p style={{ margin: 0, color: '#64748b', fontSize: 10, lineHeight: 1.5 }}>선택 동의는 언제든 MY에서 변경할 수 있습니다.</p>
          </fieldset>}

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px'
            }}
          >
            {loading ? '처리 중...' : isSignUp ? '가입하기' : '로그인'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); setAllowAnonymousAggregate(false); setAllowFriendSharing(false); setAllowAiAnalysis(false); setAcceptedTerms(false); setAcknowledgedPrivacy(false); setAgeOver14(false) }}
            style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
          </button>
        </div>
      </div>
    </div>
  )
}
