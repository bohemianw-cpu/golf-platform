'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { createClient } from '@/utils/supabase/client'
import { passwordProblem } from '@/utils/password-check'
import { color, palette } from '@/utils/theme'

interface PasswordRecoveryModalProps {
  onClose: () => void
}

export default function PasswordRecoveryModal({ onClose }: PasswordRecoveryModalProps) {
  const supabase = useMemo(() => createClient(), [])
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const savePassword = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMsg('')
    if (password !== confirmation) {
      setErrorMsg('비밀번호가 일치하지 않습니다.')
      return
    }
    setSaving(true)
    try {
      const problem = await passwordProblem(password)
      if (problem) {
        setErrorMsg(problem)
        return
      }
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPassword('')
      setConfirmation('')
      setSaved(true)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '비밀번호를 변경하지 못했습니다. 링크를 다시 요청해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const cancel = async () => {
    if (saving) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      setErrorMsg('로그아웃하지 못했습니다. 다시 시도해 주세요.')
      return
    }
    onClose()
  }

  return <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.58)' }}>
    <section role="dialog" aria-modal="true" aria-labelledby="password-recovery-title" style={{ width: '100%', maxWidth: 380, padding: 24, borderRadius: 16, background: palette.white, boxShadow: '0 18px 48px rgba(15,23,42,.25)' }}>
      <h2 id="password-recovery-title" style={{ margin: '0 0 10px', fontSize: 18 }}>새 비밀번호 설정</h2>
      {saved ? <>
        <p role="status" style={{ color: palette.emerald800, fontSize: 14, lineHeight: 1.6 }}>비밀번호가 변경되었습니다. 현재 로그인 상태로 계속 이용할 수 있습니다.</p>
        <button type="button" onClick={onClose} style={{ width: '100%', padding: 12, border: 0, borderRadius: 8, background: color.brand, color: palette.white, fontWeight: 700 }}>확인</button>
      </> : <>
        <p style={{ margin: '0 0 16px', color: palette.slate600, fontSize: 13, lineHeight: 1.6 }}>인증된 계정에 사용할 새 비밀번호를 입력해 주세요.</p>
        {errorMsg && <p role="alert" style={{ padding: 10, borderRadius: 8, background: palette.red100, color: palette.red700, fontSize: 13 }}>{errorMsg}</p>}
        <form onSubmit={savePassword} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>새 비밀번호
            <input type="password" autoComplete="new-password" minLength={8} required autoFocus value={password} onChange={event => setPassword(event.target.value)} style={{ padding: 10, border: `1px solid ${palette.slate300}`, borderRadius: 8 }} />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>새 비밀번호 확인
            <input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} style={{ padding: 10, border: `1px solid ${palette.slate300}`, borderRadius: 8 }} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={() => void cancel()} disabled={saving} style={{ padding: 11, border: `1px solid ${palette.slate300}`, borderRadius: 8, background: palette.white }}>취소</button>
            <button type="submit" disabled={saving} style={{ padding: 11, border: 0, borderRadius: 8, background: color.brand, color: palette.white, fontWeight: 700 }}>{saving ? '변경 중...' : '비밀번호 변경'}</button>
          </div>
        </form>
      </>}
    </section>
  </div>
}
