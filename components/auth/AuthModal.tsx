'use client'

import React, { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getGolfLevelGroup, GOLF_LEVEL_GROUPS } from '@/utils/golf/levels'

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
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
            {isSignUp ? '골프 플랫폼 회원가입' : '골프 플랫폼 로그인'}
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
            onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }}
            style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
          </button>
        </div>
      </div>
    </div>
  )
}
