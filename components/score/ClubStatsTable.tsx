'use client'

import React from 'react'
import type { ClubItem } from '@/types/golf'
import type { ClubStatsMap, ClubApproachMap } from '@/utils/golf/scoring'
import { clubButtonLabel } from '@/utils/golf/clubs'
import { color, palette } from '@/utils/theme'

interface Props {
  clubs: ClubItem[]
  clubStats: ClubStatsMap
  clubApproach: ClubApproachMap
}

const th = (width: string, color?: string): React.CSSProperties => ({
  padding: '6px 1px',
  fontWeight: 'bold',
  width,
  color,
  letterSpacing: '-0.3px',
})

export default function ClubStatsTable({ clubs, clubStats, clubApproach }: Props) {
  const usedClubs = clubs.filter((c) => clubStats[c.name])

  return (
    <div
      style={{
        backgroundColor: palette.white,
        borderRadius: '12px',
        border: `1px solid ${palette.slate200}`,
        padding: '14px 8px',
        marginBottom: '20px',
      }}
    >
      <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 'bold', color: palette.slate800 }}>
        🎯 클럽별 비거리 & 접근율 분석
      </h3>

      {usedClubs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 10px', color: palette.slate500, fontSize: '13px' }}>
          샷 데이터가 기록되면 클럽별 평균, 최저, 최대 비거리 및 접근율이 자동으로 계산되어 표시됩니다.
        </div>
      ) : (
        <>
          <table style={{ width: '100%', tableLayout: 'fixed', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr style={{ backgroundColor: palette.slate50, color: palette.slate600, borderBottom: `1.5px solid ${palette.slate200}`, height: '34px' }}>
                <th style={th('21%')}>클럽</th>
                <th style={th('11%')}>횟수</th>
                <th style={th('22%', color.brand)}>평균</th>
                <th style={th('15%', palette.slate500)}>최저</th>
                <th style={th('15%', palette.amber600)}>최대</th>
                <th style={th('16%', palette.blue600)}>접근율</th>
              </tr>
            </thead>
            <tbody>
              {usedClubs.map((c) => {
                const stat = clubStats[c.name]
                const avg = Math.round(stat.totalDist / stat.count)
                const ap = clubApproach[c.name]
                const approachRate = ap && ap.count > 0 ? Math.round(ap.totalRate / ap.count) : null

                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${palette.slate100}`, height: '42px' }}>
                    <td title={c.name} style={{ padding: '6px 1px', fontWeight: 'bold', color: palette.slate900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11.5px', letterSpacing: '-0.3px' }}>
                      {clubButtonLabel(c)}
                    </td>
                    <td style={{ padding: '6px 1px', color: palette.slate500, fontSize: '11px', whiteSpace: 'nowrap' }}>{stat.count}회</td>
                    <td style={{ padding: '6px 1px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: color.brand, letterSpacing: '-0.5px' }}>{avg}</span>
                    </td>
                    <td style={{ padding: '6px 1px', color: palette.slate600, fontSize: '11.5px', fontWeight: 500, whiteSpace: 'nowrap' }}>{stat.minDist}</td>
                    <td style={{ padding: '6px 1px', color: palette.amber600, fontSize: '11.5px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{stat.maxDist}</td>
                    <td style={{ padding: '6px 1px', color: approachRate !== null ? palette.blue600 : palette.slate400, fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {approachRate !== null ? `${approachRate}%` : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ marginTop: '8px', fontSize: '10.5px', color: palette.slate500, textAlign: 'right' }}>
            * 평균·최저·최대는 벌타 샷을 제외한 값입니다. 접근율은 남은 거리 ≤ (평균+20m) 샷 기준입니다.
          </div>
        </>
      )}
    </div>
  )
}
