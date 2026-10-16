'use client'

import React from 'react'
import type { BallLie, ClubItem } from '@/types/golf'
import { getPenaltyByLie, MAX_GOLF_DISTANCE_M, MAX_GOLF_PAR, MIN_GOLF_PAR } from '@/utils/golf/scoring'
import { clubButtonLabel } from '@/utils/golf/clubs'
import type { RoundApi } from '@/hooks/useRound'
import RoundMetrics from './RoundMetrics'
import { color, palette } from '@/utils/theme'

const BALL_LIE_OPTIONS: { lie: BallLie; label: string; compactLabel?: string; badge: string | null; color: string }[] = [
  { lie: '페어웨이', label: '페어웨이', badge: null, color: color.brand },
  { lie: '러프', label: '러프', badge: null, color: palette.yellow600 },
  { lie: '벙커', label: '벙커', badge: null, color: palette.amber600 },
  { lie: '그린', label: '그린 (On)', badge: null, color: palette.green600 },
  { lie: '해저드', label: '해저드', badge: '+1벌타', color: palette.red600 },
  { lie: '해저드티', label: '해저드 특설티', compactLabel: '해저드T', badge: '+1벌타', color: palette.red600 },
  { lie: 'OB', label: 'OB (원위치)', compactLabel: 'OB 원위치', badge: '+1벌타', color: palette.red700 },
  { lie: 'OB티', label: 'OB 특설티', compactLabel: 'OB 특설T', badge: '+2벌타', color: palette.red800 },
]

const distBtn: React.CSSProperties = {
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

const distInput: React.CSSProperties = {
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
function DistanceStepper({
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

interface Props {
  round: RoundApi
  clubs: ClubItem[]
  onOpenClubSettings: () => void
  disabled?: boolean
  onDisabledClick?: () => void
}


export default function ShotInputCard({ round: r, clubs, onOpenClubSettings, disabled = false, onDisabledClick }: Props) {
  if (!r) {
    return (
      <div role="alert">
        라운드 정보를 전달받지 못했습니다.
      </div>
    )
  }

  const fineAdjustment = r.isPutterSelected || r.currentPrevDistance < 10 || r.remainingDistance < 10
  const previewOnly = disabled && !(r.routeDistances[r.currentHole - 1] > 0)
  const step = fineAdjustment ? 0.1 : r.isPutterOrGreen ? 1 : 5
  const isOb = r.selectedLie === 'OB'
  const onKeyDownDistance = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      r.changeRemaining(r.remainingDistance + step)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      r.changeRemaining(r.remainingDistance - step)
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: palette.white,
        borderRadius: '12px',
        border: `1px solid ${palette.slate200}`,
        overflow: 'hidden',
        marginBottom: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}
    >
      <RoundMetrics round={r} />
      <div style={{ padding: '8px 10px' }}>
      {/* 홀 안내 + 기준 파/거리 (한 줄) */}
      <div style={{ paddingBottom: '5px', borderBottom: `1px solid ${palette.slate100}`, marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <select
            value={previewOnly ? '' : r.currentPar}
            onChange={(e) => r.changeHolePar(r.currentHole - 1, Number(e.target.value))}
            disabled={disabled || r.isRegistered}
            aria-label="기준 파"
            style={{ height: '32px', padding: '0 4px', borderRadius: '8px', border: `1px solid ${palette.slate300}`, fontSize: '13px', fontWeight: 'bold', color: palette.slate900, flexShrink: 0, backgroundColor: r.isRegistered ? palette.slate100 : palette.white }}
          >
            {previewOnly && <option value="">Par -</option>}
            {Array.from({ length: MAX_GOLF_PAR - MIN_GOLF_PAR + 1 }, (_, index) => MIN_GOLF_PAR + index).map((p) => (
              <option key={p} value={p}>
                Par {p}
              </option>
            ))}
          </select>
          <DistanceStepper value={r.holeDistance} onChange={r.changeHoleDistance} name="홀 거리" disabled={disabled || r.isRegistered || r.currentShots.length > 0} placeholder={previewOnly ? '-' : undefined} />
        </div>
      </div>

      {/* 현재 핀까지 + 추천 클럽 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          backgroundColor: palette.green50,
          border: `1.5px solid ${palette.green300}`,
          borderRadius: '10px',
          padding: '4px 8px',
          marginBottom: '5px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: palette.green800, whiteSpace: 'nowrap' }}>🚩 현재 핀까지</span>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: palette.green700, whiteSpace: 'nowrap' }}>{previewOnly ? '-' : `${r.currentPrevDistance}m`}</span>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: palette.white,
            padding: '3px 9px',
            borderRadius: '20px',
            border: `1px solid ${palette.green200}`,
            fontSize: '11.5px',
            fontWeight: 'bold',
            color: palette.green800,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: palette.emerald600 }}>💡 추천:</span>
          <span>{previewOnly ? '-' : r.recommendedClub}</span>
        </div>
      </div>

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

      {/* 볼 위치 */}
      <div style={{ marginBottom: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: palette.slate800 }}>📍 볼이 멈춘 위치</span>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: palette.blue600 }}>
            {r.selectedLie} {getPenaltyByLie(r.selectedLie) > 0 && `(+${getPenaltyByLie(r.selectedLie)}벌타)`}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '3px' }}>
          {BALL_LIE_OPTIONS.map((item) => {
            const on = r.selectedLie === item.lie
            return (
              <button
                key={item.lie}
                disabled={disabled}
                title={item.label}
                aria-label={`${item.label}${item.badge ? ` ${item.badge}` : ''}`}
                onClick={() => r.setSelectedLie(item.lie)}
                style={{
                  height: '38px',
                  borderRadius: '6px',
                  border: on ? `1.5px solid ${palette.blue600}` : `1px solid ${palette.slate300}`,
                  backgroundColor: on ? palette.blue50 : palette.white,
                  color: on ? palette.blue600 : item.color,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 2px',
                  lineHeight: 1.15,
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: on ? 'bold' : 600, whiteSpace: 'nowrap' }}>{item.compactLabel ?? item.label}</span>
                {item.badge && <span style={{ fontSize: '8px', color: palette.red600, fontWeight: 'bold' }}>{item.badge}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* 샷 후 남은 거리 (한 줄) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3px',
          backgroundColor: isOb ? palette.slate50 : palette.blue50,
          border: isOb ? `1.5px solid ${palette.slate300}` : `2px solid ${palette.blue400}`,
          borderRadius: '10px',
          padding: '5px 6px',
          marginBottom: '5px',
          opacity: isOb ? 0.55 : 1,
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: isOb ? palette.red700 : palette.blue900, whiteSpace: 'nowrap', textAlign: 'center' }}>
          {isOb ? '📍 원위치 유지' : '📍 남은 거리 📍'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '5px' }}>
          <DistanceStepper
            value={isOb ? r.currentPrevDistance : r.remainingDistance}
            onChange={r.changeRemaining}
            disabled={disabled || isOb}
            step={step}
            onKeyDown={onKeyDownDistance}
            name="샷 후 남은 거리"
            emphasized
            fineAdjustment={fineAdjustment}
            placeholder={previewOnly ? '-' : undefined}
          />
          <button
            type="button"
            disabled={disabled || isOb}
            aria-pressed={r.isPinOver}
            onClick={() => r.setIsPinOver(!r.isPinOver)}
            style={{
              minHeight: '32px',
              padding: '3px 7px',
              fontSize: '11px',
              borderRadius: '8px',
              border: r.isPinOver ? `1px solid ${palette.amber600}` : `1px solid ${palette.blue300}`,
              backgroundColor: r.isPinOver ? palette.amber500 : palette.white,
              color: r.isPinOver ? palette.white : palette.blue700,
              fontWeight: 'bold',
              cursor: isOb ? 'not-allowed' : 'pointer',
            }}
          >
            핀 오버
          </button>
        </div>
      </div>

      {/* 계산 비거리 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          backgroundColor: r.isPinOver ? palette.amber100 : palette.green50,
          border: r.isPinOver ? `1.5px solid ${palette.amber500}` : `1.5px solid ${palette.green300}`,
          borderRadius: '10px',
          padding: '3px 8px',
          marginBottom: '5px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', minWidth: 0 }}>
          <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: r.isPinOver ? palette.amber800 : palette.green800, whiteSpace: 'nowrap' }}>🎯 계산 비거리</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: r.isPinOver ? palette.amber700 : palette.green700, whiteSpace: 'nowrap' }}>
            {previewOnly ? '-' : `${isOb ? 0 : r.calculatedShotDistance}m`}
          </span>
          <span style={{ fontSize: '10.5px', color: palette.slate500, whiteSpace: 'nowrap' }}>({r.selectedClub})</span>
        </div>
      </div>

      {/* 남은 거리 0m 저장은 자동으로 홀아웃 처리 */}
      <div style={{ marginBottom: '5px' }}>
        <button
          disabled={disabled}
          onClick={r.saveShot}
          style={{ width: '100%', minHeight: '38px', padding: '7px 8px', backgroundColor: r.remainingDistance === 0 && !isOb ? palette.red600 : color.brand, color: palette.white, border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}
        >
          {r.remainingDistance === 0 && !isOb ? '🏁 홀아웃 기록' : '✓ 샷 결과 저장'}
        </button>
      </div>

      {/* 퍼트 빠른 입력: 직전 샷이 그린에 올랐을 때만 노출 */}
      {r.isOnGreen && (
        <div style={{ marginBottom: '5px', padding: '6px', backgroundColor: palette.green50, border: `1.5px solid ${palette.green300}`, borderRadius: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: palette.green800, marginBottom: '4px' }}>
            ⛳ 퍼트 한 번에 입력 <span style={{ fontWeight: 'normal', color: palette.slate500 }}>(누르면 바로 홀아웃)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                disabled={disabled}
                onClick={() => r.quickPutt(n)}
                style={{ height: '32px', borderRadius: '8px', border: `1px solid ${palette.green300}`, backgroundColor: palette.white, color: palette.green700, fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {n}퍼트
              </button>
            ))}
          </div>
          <p style={{ margin: '5px 0 0', fontSize: '10px', lineHeight: 1.3, color: palette.slate600 }}>
            한 번에 입력하면 남은 거리를 퍼트 횟수로 나눠 추정합니다. 정확한 접근율 계산을 위해 각 퍼트 후 남은 거리를 직접 입력해 주세요.
          </p>
        </div>
      )}

      {/* 서브 버튼 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
          <button
            type="button"
            onClick={r.undoPreviousShot}
            disabled={disabled || r.isSaving || (r.currentShots.length === 0 && r.completedHoles.length === 0)}
            title={r.currentShots.length === 0 ? '직전 홀의 마지막 샷 취소' : '현재 홀의 직전 샷 취소'}
            style={{ minWidth: 0, minHeight: '34px', padding: '6px 4px', backgroundColor: palette.slate100, color: palette.slate600, border: `1px solid ${palette.slate300}`, borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: r.isSaving || (r.currentShots.length === 0 && r.completedHoles.length === 0) ? 'not-allowed' : 'pointer', opacity: r.isSaving || (r.currentShots.length === 0 && r.completedHoles.length === 0) ? 0.5 : 1 }}
          >
            ↩ 직전 샷 취소
          </button>
          <button
            type="button"
            onClick={r.redoLastShot}
            disabled={disabled || !r.canRedoLastShot || r.isSaving}
            style={{ minWidth: 0, minHeight: '34px', padding: '6px 4px', backgroundColor: r.canRedoLastShot ? palette.emerald50 : palette.slate100, color: r.canRedoLastShot ? color.brand : palette.slate400, border: `1px solid ${palette.slate300}`, borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: r.canRedoLastShot && !r.isSaving ? 'pointer' : 'not-allowed' }}
          >
            ↪ 삭제한 샷 복원
          </button>
      </div>
      </div>
      {disabled && <button type="button" onClick={onDisabledClick} aria-label="코스와 티 정보를 선택한 뒤 라운드 시작을 눌러주세요." style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 0, backgroundColor: 'rgba(248,250,252,0.58)', cursor: 'pointer', zIndex: 1 }} />}
    </div>
  )
}
