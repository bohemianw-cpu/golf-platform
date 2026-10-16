'use client'

import React from 'react'
import type { BallLie } from '@/types/golf'
import { MAX_GOLF_DISTANCE_M } from '@/utils/golf/scoring'
import { color, palette } from '@/utils/theme'

export const BALL_LIE_OPTIONS: { lie: BallLie; label: string; compactLabel?: string; badge: string | null; color: string }[] = [
  { lie: '페어웨이', label: '페어웨이', badge: null, color: color.brand },
  { lie: '러프', label: '러프', badge: null, color: palette.yellow600 },
  { lie: '벙커', label: '벙커', badge: null, color: palette.amber600 },
  { lie: '그린', label: '그린 (On)', badge: null, color: palette.green600 },
  { lie: '해저드', label: '해저드', badge: '+1벌타', color: palette.red600 },
  { lie: '해저드티', label: '해저드 특설티', compactLabel: '해저드T', badge: '+1벌타', color: palette.red600 },
  { lie: 'OB', label: 'OB (원위치)', compactLabel: 'OB 원위치', badge: '+1벌타', color: palette.red700 },
  { lie: 'OB티', label: 'OB 특설티', compactLabel: 'OB 특설T', badge: '+2벌타', color: palette.red800 },
]

export const distBtn: React.CSSProperties = {
  minWidth: '32px',
  height: '32px',
  padding: '0 4px',
  borderRadius: '8px',
  border: `1px solid ${palette.slate300}`,
  backgroundColor: palette.slate100,
  color: palette.slate800,
  fontSize: '12px',
  fontWeight: 'bold',
  cursor: 'pointer',
  touchAction: 'manipulation',
  flexShrink: 0,
}

export const distInput: React.CSSProperties = {
  width: '50px',
  height: '32px',
  boxSizing: 'border-box',
  padding: '0 4px',
  borderRadius: '8px',
  border: `1.5px solid ${palette.blue500}`,
  fontSize: '14px',
  fontWeight: 'bold',
  color: palette.blue700,
  textAlign: 'center',
  backgroundColor: palette.white,
  flexShrink: 0,
}

/** −5 −1 [입력] +1 +5 m  (홀 거리 / 남은 거리 공용) */
export function DistanceStepper({
  value,
  onChange,
  disabled = false,
  step = 1,
  onKeyDown,
  name,
  emphasized = false,
  fineAdjustment = false,
  placeholder,
}: {
  value: number
  onChange: (next: number) => void
  disabled?: boolean
  step?: number
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  name: string
  emphasized?: boolean
  fineAdjustment?: boolean
  placeholder?: string
}) {
  const buttonStyle = fineAdjustment ? { ...distBtn, minWidth: '30px', padding: '0 2px', fontSize: '10px' } : distBtn
  const [inputText, setInputText] = React.useState(String(value))
  React.useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) setInputText(String(value)) })
    return () => { cancelled = true }
  }, [value])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: fineAdjustment ? '2px' : '3px', maxWidth: '100%' }}>
      {(fineAdjustment ? [-5, -1, -0.1] : [-5, -1]).map((d) => (
        <button key={d} type="button" disabled={disabled} onClick={() => onChange(value + d)} style={buttonStyle} aria-label={`${name} ${d}m`}>
          −{Math.abs(d)}
        </button>
      ))}
      <input
        type="number"
        min={0}
        max={MAX_GOLF_DISTANCE_M}
        step={step}
        inputMode="decimal"
        disabled={disabled}
        value={placeholder ? '' : inputText}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          const text = e.target.value
          setInputText(text)
          if (text !== '') onChange(Number(text))
        }}
        onBlur={() => setInputText(String(value))}
        style={emphasized ? {
          ...distInput,
          width: fineAdjustment ? '58px' : '64px',
          height: '40px',
          border: `2px solid ${palette.blue600}`,
          backgroundColor: palette.blue50,
          boxShadow: `0 0 0 2px ${palette.blue100}`,
          fontSize: fineAdjustment ? '18px' : '22px',
          color: palette.blue800,
        } : distInput}
        aria-label={name}
      />
      {(fineAdjustment ? [0.1, 1, 5] : [1, 5]).map((d) => (
        <button key={d} type="button" disabled={disabled} onClick={() => onChange(value + d)} style={buttonStyle} aria-label={`${name} +${d}m`}>
          +{d}
        </button>
      ))}
      <span style={{ fontSize: '12px', color: palette.slate500, marginLeft: '1px' }}>m</span>
    </div>
  )
}
