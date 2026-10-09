'use client'

import React from 'react'
import type { ClubItem } from '@/types/golf'
import type { ClubStatsMap, ClubApproachMap } from '@/utils/golf/scoring'

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
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '14px 8px',
        marginBottom: '20px',
      }}
    >
      <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>
        🎯 클럽별 비거리 & 접근율 분석
      </h3>

      {usedClubs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 10px', color: '#94a3b8', fontSize: '13px' }}>
          샷 데이터가 기록되면 클럽별 평균, 최저, 최대 비거리 및 접근율이 자동으로 계산되어 표시됩니다.
        </div>
      ) : (
        <>
          <table style={{ width: '100%', tableLayout: 'fixed', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1.5px solid #e2e8f0', height: '34px' }}>
                <th style={th('21%')}>클럽</th>
                <th style={th('11%')}>횟수</th>
                <th style={th('22%', '#047857')}>평균</th>
                <th style={th('15%', '#64748b')}>최저</th>
                <th style={th('15%', '#d97706')}>최대</th>
                <th style={th('16%', '#2563eb')}>접근율</th>
              </tr>
            </thead>
            <tbody>
              {usedClubs.map((c) => {
                const stat = clubStats[c.name]
                const avg = Math.round(stat.totalDist / stat.count)
                const ap = clubApproach[c.name]
                const approachRate = ap && ap.count > 0 ? Math.round(ap.totalRate / ap.count) : null

                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', height: '42px' }}>
                    <td style={{ padding: '6px 1px', fontWeight: 'bold', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11.5px', letterSpacing: '-0.3px' }}>
                      {c.name}
                    </td>
                    <td style={{ padding: '6px 1px', color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>{stat.count}회</td>
                    <td style={{ padding: '6px 1px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#047857', letterSpacing: '-0.5px' }}>{avg}</span>
                      <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#059669', marginLeft: '1px' }}>m</span>
                    </td>
                    <td style={{ padding: '6px 1px', color: '#475569', fontSize: '11.5px', fontWeight: 500, whiteSpace: 'nowrap' }}>{stat.minDist}m</td>
                    <td style={{ padding: '6px 1px', color: '#d97706', fontSize: '11.5px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{stat.maxDist}m</td>
                    <td style={{ padding: '6px 1px', color: approachRate !== null ? '#2563eb' : '#94a3b8', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {approachRate !== null ? `${approachRate}%` : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ marginTop: '8px', fontSize: '10.5px', color: '#94a3b8', textAlign: 'right' }}>
            * 평균·최저·최대는 벌타 샷을 제외한 값입니다. 접근율은 남은 거리 ≤ (평균+20m) 샷 기준입니다.
          </div>
        </>
      )}
    </div>
  )
}
