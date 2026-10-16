'use client'

import React from 'react'
import type { ShotRecord, HoleRecord } from '@/types/golf'
import { color, palette } from '@/utils/theme'

function ShotTable({ shots }: { shots: ShotRecord[] }) {
  return (
    <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'center' }}>
      <tbody>
        {shots.map((s) => (
          <tr key={s.shotNumber} style={{ borderBottom: `1px solid ${palette.slate100}`, height: '30px' }}>
            <td>{s.shotNumber}타</td>
            <td>{s.club}</td>
            <td style={{ fontWeight: 'bold', color: s.penalty > 0 ? palette.red600 : color.brand }}>
              {s.penalty > 0 ? `${s.ballLie} +${s.penalty}` : `${s.shotDistance}m`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const empty = (text: string) => (
  <div style={{ padding: '24px 6px', textAlign: 'center', color: palette.slate500, fontSize: '11.5px' }}>{text}</div>
)

interface Props {
  previousHole: HoleRecord | undefined
  currentHole: number
  currentPar: number
  currentShots: ShotRecord[]
  currentPrevDistance: number
  courseDataKnown: boolean
}

export default function ShotComparison({ previousHole, currentHole, currentPar, currentShots, currentPrevDistance, courseDataKnown }: Props) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: palette.slate800, marginBottom: '10px' }}>📊 샷 데이터 내역</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'start' }}>
        <div style={{ backgroundColor: palette.white, border: `1px solid ${palette.slate300}`, borderRadius: '10px', padding: '10px 6px' }}>
          <div style={{ borderBottom: `1px solid ${palette.slate100}`, paddingBottom: '6px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 'bold', color: palette.slate500 }}>📋 직전 홀</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
              <span style={{ fontWeight: 'bold', color: palette.slate800, fontSize: '12.5px' }}>
                {previousHole ? `${previousHole.holeNumber}번 홀` : '기록 없음'}
              </span>
              {previousHole && (
                <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: previousHole.scoreDiff <= 0 ? palette.green700 : palette.red700 }}>
                  {previousHole.score}타
                </span>
              )}
            </div>
          </div>
          {!previousHole ? empty('기록이 없습니다.') : previousHole.shots.length === 0 ? empty('샷 상세 기록이 없습니다.') : <ShotTable shots={previousHole.shots} />}
        </div>

        <div style={{ backgroundColor: palette.white, border: `2px solid ${palette.sky400}`, borderRadius: '10px', padding: '10px 6px' }}>
          <div style={{ borderBottom: `1px solid ${palette.sky100}`, paddingBottom: '6px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 'bold', color: palette.sky700 }}>🔴 현재 홀</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
              <span style={{ fontWeight: 'bold', color: palette.slate900, fontSize: '12.5px' }}>
                {currentHole}번 홀 (Par {courseDataKnown ? currentPar : '-'})
              </span>
              <span style={{ fontSize: '11px', color: palette.sky700, fontWeight: 'bold' }}>남은거리 {courseDataKnown ? currentPrevDistance : '-'}m</span>
            </div>
          </div>
          {currentShots.length === 0 ? empty('티샷을 입력해 주세요.') : <ShotTable shots={currentShots} />}
        </div>
      </div>
    </div>
  )
}
