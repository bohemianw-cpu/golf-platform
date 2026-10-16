'use client'

import React, { useCallback, useState } from 'react'
import { color, palette } from '@/utils/theme'

export interface Choice<T extends string> {
  label: string
  value: T
  tone?: 'primary' | 'danger' | 'neutral'
}

export type ChooseFn = <T extends string>(message: string, choices: Choice<T>[]) => Promise<T>

interface DialogState {
  message: string
  choices: Choice<string>[]
  resolve: (v: string) => void
}

const TONES = {
  primary: { bg: color.brand, color: palette.white, border: color.brand },
  danger: { bg: palette.red100, color: palette.red600, border: palette.red200 },
  neutral: { bg: palette.slate100, color: palette.slate600, border: palette.slate300 },
}

/** window.confirm 대체. choose()는 선택한 value를 resolve 하는 Promise */
export function useChoiceDialog() {
  const [state, setState] = useState<DialogState | null>(null)

  const choose = useCallback(
    <T extends string>(message: string, choices: Choice<T>[]) =>
      new Promise<T>((resolve) => {
        setState({ message, choices, resolve: resolve as (v: string) => void })
      }),
    []
  ) as ChooseFn

  const confirm = useCallback(
    async (message: string, okLabel = '확인', tone: 'primary' | 'danger' = 'primary') => {
      const v = await choose(message, [
        { label: '취소', value: 'no', tone: 'neutral' },
        { label: okLabel, value: 'yes', tone },
      ])
      return v === 'yes'
    },
    [choose]
  )

  const pick = (value: string) => {
    state?.resolve(value)
    setState(null)
  }

  const dialog = state ? (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15,23,42,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '340px',
          backgroundColor: palette.white,
          borderRadius: '12px',
          padding: '18px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        }}
      >
        <p style={{ margin: '0 0 16px', fontSize: '14px', lineHeight: 1.55, color: palette.slate900, whiteSpace: 'pre-line' }}>
          {state.message}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {state.choices.map((c) => {
            const t = TONES[c.tone ?? 'neutral']
            return (
              <button
                key={c.value}
                onClick={() => pick(c.value)}
                style={{
                  padding: '11px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${t.border}`,
                  backgroundColor: t.bg,
                  color: t.color,
                  fontSize: '13.5px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  ) : null

  return { choose, confirm, dialog }
}
