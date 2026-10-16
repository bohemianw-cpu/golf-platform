'use client'

import { palette } from '@/utils/theme'

/** 골프장을 고르기 전에 보여 주는 코스·티 선택 안내. */
export default function CourseLayoutPlaceholder({ courseId, onNeedCourse }: { courseId: string | null; onNeedCourse: () => void }) {
  return (
    <>
      {!courseId && <div aria-disabled="true" style={{ marginTop: '8px', padding: '9px', background: palette.slate50, borderRadius: '8px', border: `1px solid ${palette.slate200}`, opacity: 0.45, filter: 'grayscale(0.35)' }}>
        <fieldset style={{ margin: 0, padding: '7px 8px', border: `1px solid ${palette.slate300}`, borderRadius: '6px', background: palette.white }}>
          <legend style={{ padding: '0 3px', fontSize: '10px', fontWeight: 700, color: palette.slate700 }}>오늘 플레이할 코스와 티 선택</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {['OUT 코스', 'IN 코스'].map((name) => <button key={name} type="button" aria-disabled="true" onClick={onNeedCourse} style={{ padding: '5px 8px', border: `1px solid ${palette.slate300}`, borderRadius: '6px', background: palette.white, color: palette.slate600, fontSize: '11px', cursor: 'pointer' }}>{name} (9홀)</button>)}
          </div>
          <div style={{ marginTop: '5px', fontSize: '10px', color: palette.slate500 }}>선택 순서: OUT → IN</div>
          <fieldset style={{ margin: '8px 0 0', padding: '6px 8px', border: `1px solid ${palette.slate300}`, borderRadius: '6px', background: palette.white }}>
            <legend style={{ padding: '0 3px', fontSize: '10px', fontWeight: 700 }}>이번 라운드 티 위치</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {[
                ['black', '블랙티', palette.gray900],
                ['white', '화이트티', palette.white],
                ['red', '레드티', palette.red500],
              ].map(([code, name, color]) => <button key={code} type="button" aria-disabled="true" onClick={onNeedCourse} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 2px', border: 0, background: 'transparent', color: palette.slate700, fontSize: '11px', cursor: 'pointer' }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', border: `1px solid ${palette.slate500}`, background: color }} />{name}
              </button>)}
            </div>
          </fieldset>
          {['OUT', 'IN'].map((routeName) => <details key={routeName} className="course-hole-preview" style={{ marginTop: '8px', border: `1px solid ${palette.slate200}`, borderRadius: '7px', background: palette.white }}>
            <summary className="course-hole-preview__summary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px', fontSize: '11px', fontWeight: 700, color: palette.slate700, cursor: 'pointer' }}>
              {routeName} 코스 홀별 정보 · 9홀
            </summary>
            <div className="course-hole-preview__content" style={{ padding: '0 6px 6px' }}>
              <table className="course-hole-preview__table" aria-label={`${routeName} 코스 홀별 정보`} style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px' }}>
                <thead><tr style={{ background: palette.slate50, color: palette.slate600 }}><th style={{ padding: 5 }}>홀</th><th style={{ padding: 5 }}>Par</th><th style={{ padding: 5 }}>블랙티</th><th style={{ padding: 5 }}>화이트티</th><th style={{ padding: 5 }}>레드티</th></tr></thead>
                <tbody>{Array.from({ length: 9 }, (_, index) => <tr key={index + 1}>
                  <th scope="row" style={{ padding: 5, borderTop: `1px solid ${palette.slate100}` }}>{index + 1}</th>
                  {Array.from({ length: 4 }, (_, column) => <td key={column} style={{ padding: 5, borderTop: `1px solid ${palette.slate100}`, color: palette.slate400 }}>-</td>)}
                </tr>)}</tbody>
              </table>
            </div>
          </details>)}
        </fieldset>
      </div>}
    </>
  )
}
