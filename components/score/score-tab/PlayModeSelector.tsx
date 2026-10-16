'use client'

import { SCREEN_ROUNDS_ENABLED } from './parts'
import { palette } from '@/utils/theme'
import type { RoundApi } from '@/hooks/useRound'
import type { GolfCourseOption } from '../course-catalog/parts'
import type { Dispatch, SetStateAction } from 'react'

/** 라운드 시작 전 필드·스크린과 스크린 업체를 고른다. */
export default function PlayModeSelector({ courseInfoLocked, playMode, round, handleCourseSelect, setPlayMode, screenProviders, screenProvidersLoading, screenProvidersError }: { courseInfoLocked: boolean; playMode: "field" | "screen" | null; round: RoundApi; handleCourseSelect: (course: GolfCourseOption | null) => void; setPlayMode: Dispatch<SetStateAction<"field" | "screen" | null>>; screenProviders: string[]; screenProvidersLoading: boolean; screenProvidersError: boolean }) {
  return (
    <>
      {!courseInfoLocked && <fieldset data-score-guide-target="play-mode" style={{ margin: '0 0 10px', padding: '8px 10px', border: `1px solid ${palette.slate300}`, borderRadius: '8px', background: palette.white }}>
        <legend style={{ padding: '0 4px', fontSize: '11px', fontWeight: 700, color: palette.slate700 }}>이번 라운드 방식 (필드 자동선택)</legend>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {(['field', 'screen'] as const).map((mode) => (
            <label key={mode} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: mode === 'screen' ? palette.slate500 : palette.slate700, cursor: courseInfoLocked || (mode === 'screen' && !SCREEN_ROUNDS_ENABLED) ? 'not-allowed' : 'pointer' }}>
              <input
                type="radio"
                name="round-play-mode"
                value={mode}
                checked={playMode === mode}
                disabled={courseInfoLocked || round.isRegistered || (mode === 'screen' && !SCREEN_ROUNDS_ENABLED)}
                onChange={() => {
                  if (mode === 'screen' && !SCREEN_ROUNDS_ENABLED) return
                  if (mode === playMode) return
                  handleCourseSelect(null)
                  round.setScreenProvider(null)
                  setPlayMode(mode)
                }}
              />
              {mode === 'field' ? '필드' : '스크린 (협의중)'}
            </label>
          ))}
        </div>
        {playMode === 'screen' && (
          <div style={{ marginTop: 8 }}>
            <label htmlFor="round-screen-provider" style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 700, color: palette.slate700 }}>스크린 서비스 (필수)</label>
            <select
              id="round-screen-provider"
              value={round.screenProvider ?? ''}
              disabled={courseInfoLocked || round.isRegistered || screenProviders.length === 0}
              onChange={(event) => {
                handleCourseSelect(null)
                round.setScreenProvider(event.target.value || null)
              }}
              style={{ width: '100%', padding: '7px 8px', border: `1px solid ${palette.slate300}`, borderRadius: 7, background: palette.white, color: palette.slate700, fontSize: 12 }}
            >
              <option value="">{screenProvidersLoading ? '서비스 목록 불러오는 중…' : '스크린 서비스를 선택해 주세요'}</option>
              {screenProviders.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
            </select>
            {screenProvidersError && <p role="alert" style={{ margin: '5px 0 0', fontSize: 10, color: palette.red700 }}>스크린 서비스 목록을 불러오지 못했습니다.</p>}
            {!screenProvidersLoading && !screenProvidersError && screenProviders.length === 0 && <p role="status" style={{ margin: '5px 0 0', fontSize: 10, color: palette.slate500 }}>검증된 스크린 코스 거리 자료가 아직 없습니다.</p>}
          </div>
        )}
      </fieldset>}
    </>
  )
}
