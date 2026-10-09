'use client'

import React from 'react'
import type { ShotRecord, HoleRecord } from '@/types/golf'

function ShotTable({ shots }: { shots: ShotRecord[] }) {
  return (
    <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'center' }}>
      <tbody>
        {shots.map((s) => (
          <tr key={s.shotNumber} style={{ borderBottom: '1px solid #f1f5f9', height: '30px' }}>
            <td>{s.shotNumber}타</td>
            <td>{s.club}</td>
            <td style={{ fontWeight: 'bold', color: s.penalty > 0 ? '#dc2626' : '#047857' }}>
              {s.penalty > 0 ? `${s.ballLie} +${s.penalty}` : `${s.shotDistance}m`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const empty = (text: string) => (
  <div style={{ padding: '24px 6px', textAlign: 'center', color: '#94a3b8', fontSize: '11.5px' }}>{text}</div>
)

interface Props {
  previousHole: HoleRecord | undefined
  currentHole: number
  currentPar: number
  currentShots: ShotRecord[]
  currentPrevDistance: number
}

export default function ShotComparison({ previousHole, currentHole, currentPar, currentShots, currentPrevDistance }: Props) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', marginBottom: '10px' }}>📊 샷 데이터 비교</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'start' }}>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px 6px' }}>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#64748b' }}>📋 직전 홀</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
              <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '12.5px' }}>
                {previousHole ? `${previousHole.holeNumber}번 홀` : '기록 없음'}
              </span>
              {previousHole && (
                <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: previousHole.scoreDiff <= 0 ? '#15803d' : '#b91c1c' }}>
                  {previousHole.score}타
                </span>
              )}
            </div>
          </div>
          {!previousHole ? empty('기록이 없습니다.') : previousHole.shots.length === 0 ? empty('샷 상세 기록이 없습니다.') : <ShotTable shots={previousHole.shots} />}
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '2px solid #38bdf8', borderRadius: '10px', padding: '10px 6px' }}>
          <div style={{ borderBottom: '1px solid #e0f2fe', paddingBottom: '6px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#0284c7' }}>🔴 현재 홀</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
              <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '12.5px' }}>
                {currentHole}번 홀 (Par {currentPar})
              </span>
              <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 'bold' }}>남은거리 {currentPrevDistance}m</span>
            </div>
          </div>
          {currentShots.length === 0 ? empty('티샷을 입력해 주세요.') : <ShotTable shots={currentShots} />}
        </div>
      </div>
    </div>
  )
}
