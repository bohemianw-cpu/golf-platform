'use client'

import { CARD, muted } from './myStyles'
import { GOLF_LEVEL_GROUPS } from '@/utils/golf/levels'
import { color, palette } from '@/utils/theme'
import type { GolfLevelGroup } from '@/utils/golf/levels'
import type { Dispatch, SetStateAction } from 'react'

/** 핸디캡 지수를 입력해 비교 그룹을 정한다. */
export default function HandicapSection({ currentGroup, handicapInput, setHandicapInput, setProfileSaved, saveHandicap, savingHandicap, profileSaved }: { currentGroup: GolfLevelGroup; handicapInput: string; setHandicapInput: Dispatch<SetStateAction<string>>; setProfileSaved: Dispatch<SetStateAction<boolean>>; saveHandicap: () => Promise<void>; savingHandicap: boolean; profileSaved: boolean }) {
  return (
    <>
      <section style={CARD} aria-labelledby="level-progress-title">
        <h2 id="level-progress-title" style={{ margin: '0 0 4px', fontSize: '16px' }}>⛳ 내 핸디캡 그룹</h2>
        <p style={{ ...muted, margin: '0 0 12px' }}>현재 비교 그룹: {GOLF_LEVEL_GROUPS[currentGroup].label}. 핸디캡 지수를 직접 입력해 비교에 사용할 그룹을 설정할 수 있습니다.</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label htmlFor="my-handicap-index" style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: palette.slate600, fontWeight: 700 }}>내 핸디캡 지수</label>
            <input id="my-handicap-index" type="number" min="-10" max="54" step="0.1" inputMode="decimal" value={handicapInput} onChange={(event) => { setHandicapInput(event.target.value); setProfileSaved(false) }} placeholder="모르면 비워 두세요" style={{ width: '100%', boxSizing: 'border-box', padding: '8px', border: `1px solid ${palette.slate300}`, borderRadius: '7px' }} />
          </div>
          <button type="button" onClick={() => void saveHandicap()} disabled={savingHandicap} style={{ padding: '9px 12px', border: 0, borderRadius: '7px', background: color.brand, color: palette.white, fontWeight: 700, cursor: savingHandicap ? 'wait' : 'pointer' }}>{savingHandicap ? '저장 중…' : '핸디캡 그룹 저장'}</button>
          {profileSaved && <span role="status" style={{ ...muted, color: color.brand }}>비교 그룹을 업데이트했습니다.</span>}
        </div>
      </section>
    </>
  )
}
