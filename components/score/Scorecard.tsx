'use client'

import React from 'react'
import type { HoleRecord } from '@/types/golf'

interface Props {
  holePars: number[]
  showPars: boolean
  completedHoles: HoleRecord[]
  routeNames?: string[]
  courseHoleNumbers?: number[]
}

const fmt = (n: number) => (n === 0 ? '0' : n > 0 ? `+${n}` : `${n}`)

function HalfTable({
  title,
  holes,
  holePars,
  showPars,
  completedHoles,
  courseHoleNumbers,
}: {
  title: string
  holes: number[]
  holePars: number[]
  showPars: boolean
  completedHoles: HoleRecord[]
  courseHoleNumbers?: number[]
}) {
  const half = completedHoles.filter((r) => holes.includes(r.holeNumber))
  const diffTotal = half.length > 0 ? half.reduce((acc, r) => acc + r.scoreDiff, 0) : null
  const pars = holes.map((hole) => holePars[hole - 1])
  const parTotal = showPars && pars.every((par) => Number.isFinite(par))
    ? pars.reduce((sum, par) => sum + par, 0)
    : null
  const holeWidth = `${58 / Math.max(holes.length, 1)}%`
  const cellPadding = '8px 1px'

  return (
    <div style={{ marginBottom: '14px', width: '100%', containerType: 'inline-size' }}>
      <table style={{ width: '100%', tableLayout: 'fixed', fontSize: 'clamp(10px, 3cqw, 13px)', borderCollapse: 'collapse', textAlign: 'center' }}>
        <colgroup>
          <col style={{ width: '12%' }} />
          {holes.map((hole) => (
            <col key={hole} style={{ width: holeWidth }} />
          ))}
          <col style={{ width: '30%' }} />
        </colgroup>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
            <th style={{ padding: cellPadding }}>홀</th>
            {holes.map((h) => (
              <th key={h} style={{ padding: cellPadding }}>{courseHoleNumbers?.[h - 1] ?? h}</th>
            ))}
            <th style={{ padding: '8px 3px', backgroundColor: '#e2e8f0', overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.3 }}>{title}</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#475569' }}>
            <td style={{ padding: cellPadding, fontWeight: 600 }}>Par</td>
            {holes.map((h) => {
              const par = showPars ? holePars[h - 1] : null
              return <td key={h} style={{ padding: cellPadding, color: par ? '#334155' : '#cbd5e1', fontWeight: par ? 600 : 400 }}>{par ?? '-'}</td>
            })}
            <td style={{ padding: cellPadding, fontWeight: 'bold', backgroundColor: '#f1f5f9', color: parTotal === null ? '#cbd5e1' : '#334155' }}>{parTotal ?? '-'}</td>
          </tr>
          <tr>
            <td style={{ padding: cellPadding, fontWeight: 'bold' }}>Score</td>
            {holes.map((h) => {
              const record = completedHoles.find((r) => r.holeNumber === h)
              if (!record) return <td key={h} style={{ padding: cellPadding, color: '#cbd5e1' }}>-</td>
              const diff = record.scoreDiff
              return (
                <td key={h} style={{ padding: cellPadding, fontWeight: 'bold', color: diff < 0 ? '#dc2626' : diff === 0 ? '#15803d' : '#1e293b' }}>
                  {fmt(diff)}
                </td>
              )
            })}
            <td style={{ padding: cellPadding, fontWeight: 'bold', backgroundColor: '#f8fafc', color: '#0f172a' }}>
              {diffTotal === null ? '-' : fmt(diffTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function Scorecard({ holePars, showPars, completedHoles, routeNames = [], courseHoleNumbers }: Props) {
  const firstHalf = Array.from({ length: Math.min(holePars.length, 9) }, (_, index) => index + 1)
  const secondHalf = Array.from({ length: Math.max(holePars.length - 9, 0) }, (_, index) => index + 10)
  const isShortRound = holePars.length <= 9
  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', minWidth: 0, boxSizing: 'border-box' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>📋 실시간 라운드 스코어카드</h3>
      {isShortRound
        ? <HalfTable title={routeNames[0] || '전반'} holes={firstHalf} holePars={holePars} showPars={showPars} completedHoles={completedHoles} courseHoleNumbers={courseHoleNumbers} />
        : <>
          <HalfTable title={routeNames[0] || '전반'} holes={firstHalf} holePars={holePars} showPars={showPars} completedHoles={completedHoles} courseHoleNumbers={courseHoleNumbers} />
          <HalfTable title={routeNames[1] || '후반'} holes={secondHalf} holePars={holePars} showPars={showPars} completedHoles={completedHoles} courseHoleNumbers={courseHoleNumbers} />
        </>}
    </div>
  )
}
