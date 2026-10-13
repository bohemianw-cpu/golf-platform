'use client'

import React from 'react'
import type { HoleRecord } from '@/types/golf'

interface Props {
  holePars: number[]
  completedHoles: HoleRecord[]
  routeNames?: string[]
  courseHoleNumbers?: number[]
}

const fmt = (n: number) => (n === 0 ? '0' : n > 0 ? `+${n}` : `${n}`)

function HalfTable({
  title,
  holes,
  holePars,
  completedHoles,
  courseHoleNumbers,
}: {
  title: string
  holes: number[]
  holePars: number[]
  completedHoles: HoleRecord[]
  courseHoleNumbers?: number[]
}) {
  const half = completedHoles.filter((r) => holes.includes(r.holeNumber))
  const parTotal = holes.reduce((acc, h) => acc + (holePars[h - 1] ?? 4), 0)
  const diffTotal = half.length > 0 ? half.reduce((acc, r) => acc + r.scoreDiff, 0) : null
  const colWidth = `${(100 - 14) / (holes.length + 1)}%`

  return (
    <div style={{ marginBottom: '14px', width: '100%' }}>
      <table style={{ width: '100%', tableLayout: 'fixed', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'center' }}>
        <colgroup>
          <col style={{ width: '14%' }} />
          {Array.from({ length: holes.length + 1 }).map((_, i) => (
            <col key={i} style={{ width: colWidth }} />
          ))}
        </colgroup>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
            <th style={{ padding: '8px' }}>홀</th>
            {holes.map((h) => (
              <th key={h} style={{ padding: '8px' }}>{courseHoleNumbers?.[h - 1] ?? h}</th>
            ))}
            <th style={{ padding: '8px', backgroundColor: '#e2e8f0' }}>{title}</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#475569' }}>
            <td style={{ padding: '8px', fontWeight: 600 }}>Par</td>
            {holes.map((h) => (
              <td key={h} style={{ padding: '8px' }}>{holePars[h - 1]}</td>
            ))}
            <td style={{ padding: '8px', fontWeight: 'bold', backgroundColor: '#f1f5f9', color: '#0f172a' }}>{parTotal}</td>
          </tr>
          <tr>
            <td style={{ padding: '8px', fontWeight: 'bold' }}>Score</td>
            {holes.map((h) => {
              const record = completedHoles.find((r) => r.holeNumber === h)
              if (!record) return <td key={h} style={{ padding: '8px', color: '#cbd5e1' }}>-</td>
              const diff = record.scoreDiff
              return (
                <td key={h} style={{ padding: '8px', fontWeight: 'bold', color: diff < 0 ? '#dc2626' : diff === 0 ? '#15803d' : '#1e293b' }}>
                  {fmt(diff)}
                </td>
              )
            })}
            <td style={{ padding: '8px', fontWeight: 'bold', backgroundColor: '#f8fafc', color: '#0f172a' }}>
              {diffTotal === null ? '-' : fmt(diffTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function Scorecard({ holePars, completedHoles, routeNames = [], courseHoleNumbers }: Props) {
  const firstHalf = Array.from({ length: Math.min(holePars.length, 9) }, (_, index) => index + 1)
  const secondHalf = Array.from({ length: Math.max(holePars.length - 9, 0) }, (_, index) => index + 10)
  const isShortRound = holePars.length <= 9
  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', overflowX: 'auto' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>📋 실시간 라운드 스코어카드</h3>
      {isShortRound
        ? <HalfTable title={routeNames[0] || '코스'} holes={firstHalf} holePars={holePars} completedHoles={completedHoles} courseHoleNumbers={courseHoleNumbers} />
        : <>
          <HalfTable title={routeNames[0] || '전반'} holes={firstHalf} holePars={holePars} completedHoles={completedHoles} courseHoleNumbers={courseHoleNumbers} />
          <HalfTable title={routeNames[1] || '후반'} holes={secondHalf} holePars={holePars} completedHoles={completedHoles} courseHoleNumbers={courseHoleNumbers} />
        </>}
    </div>
  )
}
