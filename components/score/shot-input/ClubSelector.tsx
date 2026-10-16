'use client'

import { color, palette } from '@/utils/theme'
import { clubButtonLabel } from '@/utils/golf/clubs'
import type { RoundApi } from '@/hooks/useRound'
import type { ClubItem } from '@/types/golf'

/** 이번 샷에 사용한 클럽 선택. */
export default function ClubSelector({ disabled, onOpenClubSettings, clubs, r }: { disabled: boolean; onOpenClubSettings: () => void; clubs: ClubItem[]; r: RoundApi }) {
  return (
    <>
      {/* 사용 클럽 */}
      <div style={{ marginBottom: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: palette.slate800 }}>🏌️ 사용한 클럽</span>
            <button
              type="button"
              disabled={disabled}
              onClick={onOpenClubSettings}
              data-score-guide-target="clubs"
              aria-label={`클럽 설정, 등록된 클럽 ${clubs.length}개`}
              style={{ padding: '2px 6px', border: `1px solid ${palette.emerald200}`, borderRadius: '5px', backgroundColor: palette.emerald50, color: color.brand, fontSize: '10px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ⚙️ 클럽 설정 {clubs.length}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: color.brand }}>{r.selectedClub}</span>
            <span style={{ fontSize: '10.5px', color: palette.emerald800, backgroundColor: palette.emerald50, padding: '1px 7px', borderRadius: '12px' }}>
              평균 {r.expectedDistance(r.selectedClub)}m
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '3px' }}>
          {clubs.map((c) => {
            const on = r.selectedClub === c.name
            return (
              <button
                key={c.id}
                disabled={disabled}
                title={c.name}
                aria-label={c.name}
                onClick={() => r.handleClubSelect(c.name)}
                style={{
                  height: '30px',
                  borderRadius: '6px',
                  border: on ? `1.5px solid ${color.brand}` : `1px solid ${palette.slate300}`,
                  backgroundColor: on ? palette.emerald50 : palette.white,
                  color: on ? color.brand : palette.slate700,
                  fontWeight: on ? 'bold' : 'normal',
                  fontSize: '10px',
                  cursor: 'pointer',
                  padding: '0 1px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{clubButtonLabel(c)}</span>
              </button>
            )
          })}
        </div>
      </div>

    </>
  )
}
