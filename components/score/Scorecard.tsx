'use client'

import React from 'react'
import type { HoleRecord } from '@/types/golf'
import { palette } from '@/utils/theme'

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
          <tr style={{ backgroundColor: palette.slate100, borderBottom: `1px solid ${palette.slate300}` }}>
            <th style={{ padding: cellPadding }}>홀</th>
            {holes.map((h) => (
              <th key={h} style={{ padding: cellPadding }}>{courseHoleNumbers?.[h - 1] ?? h}</th>
            ))}
            <th style={{ padding: '8px 3px', backgroundColor: palette.slate200, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.3 }}>{title}</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: `1px solid ${palette.slate100}`, color: palette.slate600 }}>
            <td style={{ padding: cellPadding, fontWeight: 600 }}>Par</td>
            {holes.map((h) => {
              const par = showPars ? holePars[h - 1] : null
              return <td key={h} style={{ padding: cellPadding, color: par ? palette.slate700 : palette.slate300, fontWeight: par ? 600 : 400 }}>{par ?? '-'}</td>
            })}
            <td style={{ padding: cellPadding, fontWeight: 'bold', backgroundColor: palette.slate100, color: parTotal === null ? palette.slate300 : palette.slate700 }}>{parTotal ?? '-'}</td>
          </tr>
          <tr>
            <td style={{ padding: cellPadding, fontWeight: 'bold' }}>Score</td>
            {holes.map((h) => {
              const record = completedHoles.find((r) => r.holeNumber === h)
              if (!record) return <td key={h} style={{ padding: cellPadding, color: palette.slate300 }}>-</td>
              const diff = record.scoreDiff
              return (
                <td key={h} style={{ padding: cellPadding, fontWeight: 'bold', color: diff < 0 ? palette.red600 : diff === 0 ? palette.green700 : palette.slate800 }}>
                  {fmt(diff)}
                </td>
              )
            })}
            <td style={{ padding: cellPadding, fontWeight: 'bold', backgroundColor: palette.slate50, color: palette.slate900 }}>
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
    <div style={{ backgroundColor: palette.white, borderRadius: '12px', border: `1px solid ${palette.slate200}`, padding: '16px', minWidth: 0, boxSizing: 'border-box' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 'bold', color: palette.slate800 }}>📋 실시간 라운드 스코어카드</h3>
      {isShortRound
        ? <HalfTable title={routeNames[0] || '전반'} holes={firstHalf} holePars={holePars} showPars={showPars} completedHoles={completedHoles} courseHoleNumbers={courseHoleNumbers} />
        : <>
          <HalfTable title={routeNames[0] || '전반'} holes={firstHalf} holePars={holePars} showPars={showPars} completedHoles={completedHoles} courseHoleNumbers={courseHoleNumbers} />
          <HalfTable title={routeNames[1] || '후반'} holes={secondHalf} holePars={holePars} showPars={showPars} completedHoles={completedHoles} courseHoleNumbers={courseHoleNumbers} />
        </>}
    </div>
  )
}
