'use client'

import type { Dispatch, SetStateAction } from 'react'
import { palette } from '@/utils/theme'
import { GOLF_LEVEL_GROUPS, getGolfLevelGroup } from '@/utils/golf/levels'

/** 회원가입 때만 보이는 닉네임과 핸디캡 입력. 핸디캡으로 비교 그룹을 미리 보여 준다. */
export default function SignUpProfileFields({ isSignUp, nickname, setNickname, handicapIndex, setHandicapIndex }: { isSignUp: boolean; nickname: string; setNickname: Dispatch<SetStateAction<string>>; handicapIndex: string; setHandicapIndex: Dispatch<SetStateAction<string>> }) {
  return (
    <>
      {isSignUp && (
        <div>
          <label style={{ fontSize: '12px', color: palette.neutral666, display: 'block', marginBottom: '4px' }}>닉네임</label>
          <input
            type="text"
            required
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="사용할 닉네임"
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${palette.neutralDdd}`, boxSizing: 'border-box' }}
          />
        </div>
      )}

      {isSignUp && (
        <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: palette.green50, border: `1px solid ${palette.green200}` }}>
          <label htmlFor="signup-handicap" style={{ fontSize: '12px', color: palette.green800, display: 'block', marginBottom: '6px', fontWeight: 700 }}>
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
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${palette.green200}`, boxSizing: 'border-box' }}
          />
          <div id="signup-handicap-help" style={{ marginTop: '6px', fontSize: '11px', lineHeight: 1.5, color: palette.gray600 }}>
            모르면 비워 두세요. 우선 초보 그룹으로 시작하고, 라운드 기록이 쌓이면 조정할 수 있습니다.
          </div>
          <div id="signup-level-preview" aria-live="polite" style={{ marginTop: '8px', fontSize: '12px', color: palette.green800, fontWeight: 700 }}>
            비교 그룹: {GOLF_LEVEL_GROUPS[getGolfLevelGroup(handicapIndex.trim() ? Number(handicapIndex) : null)].label}
            <span style={{ display: 'block', marginTop: '3px', fontSize: '11px', fontWeight: 400, color: palette.gray600 }}>
              {GOLF_LEVEL_GROUPS[getGolfLevelGroup(handicapIndex.trim() ? Number(handicapIndex) : null)].range}
              {' · 프로 자격 인증이 아닌 실력 비교용 분류입니다.'}
            </span>
          </div>
        </div>
      )}
    </>
  )
}
