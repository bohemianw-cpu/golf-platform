'use client'

import React from 'react'
import type { BallLie, ClubItem } from '@/types/golf'
import { getPenaltyByLie } from '@/utils/golf/scoring'
import type { RoundApi } from '@/hooks/useRound'

const BALL_LIE_OPTIONS: { lie: BallLie; label: string; badge: string | null; color: string }[] = [
  { lie: '티', label: '티 (Tee)', badge: null, color: '#334155' },
  { lie: '페어웨이', label: '페어웨이', badge: null, color: '#047857' },
  { lie: '러프', label: '러프', badge: null, color: '#ca8a04' },
  { lie: '벙커', label: '벙커', badge: null, color: '#d97706' },
  { lie: '그린', label: '그린 (On)', badge: null, color: '#16a34a' },
  { lie: '해저드', label: '해저드', badge: '+1벌타', color: '#dc2626' },
  { lie: '해저드티', label: '해저드 특설티', badge: '+1벌타', color: '#dc2626' },
  { lie: 'OB', label: 'OB (원위치)', badge: '+1벌타', color: '#b91c1c' },
  { lie: 'OB티', label: 'OB 특설티', badge: '+2벌타', color: '#991b1b' },
]

const distBtn: React.CSSProperties = {
  minWidth: '32px',
  height: '32px',
  padding: '0 4px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  backgroundColor: '#f1f5f9',
  color: '#1e293b',
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
  border: '1.5px solid #3b82f6',
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#1d4ed8',
  textAlign: 'center',
  backgroundColor: '#ffffff',
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
}: {
  value: number
  onChange: (next: number) => void
  disabled?: boolean
  step?: number
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  name: string
  emphasized?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      {[-5, -1].map((d) => (
        <button key={d} type="button" disabled={disabled} onClick={() => onChange(value + d)} style={distBtn} aria-label={`${name} ${d}m`}>
          −{Math.abs(d)}
        </button>
      ))}
      <input
        type="number"
        min={0}
        step={step}
        disabled={disabled}
        value={value}
        onKeyDown={onKeyDown}
        onChange={(e) => onChange(Number(e.target.value))}
        style={emphasized ? {
          ...distInput,
          width: '64px',
          height: '40px',
          border: '2px solid #2563eb',
          backgroundColor: '#eff6ff',
          boxShadow: '0 0 0 2px #dbeafe',
          fontSize: '22px',
          color: '#1e40af',
        } : distInput}
        aria-label={name}
      />
      {[1, 5].map((d) => (
        <button key={d} type="button" disabled={disabled} onClick={() => onChange(value + d)} style={distBtn} aria-label={`${name} +${d}m`}>
          +{d}
        </button>
      ))}
      <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '1px' }}>m</span>
    </div>
  )
}

interface Props {
  round: RoundApi
  clubs: ClubItem[]
}


export default function ShotInputCard({ round: r, clubs }: Props) {
  console.log('[ShotInputCard] round:', r)

  if (!r) {
    return (
      <div role="alert">
        라운드 정보를 전달받지 못했습니다.
      </div>
    )
  }

  const step = r.isPutterOrGreen ? 1 : 5
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
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '10px 12px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}
    >
      {/* 홀 안내 + 기준 파/거리 (한 줄) */}
      <div style={{ paddingBottom: '8px', borderBottom: '1px solid #f1f5f9', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{r.currentHole}번 홀</span>
          <span style={{ fontSize: '11.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
            {r.currentShots.length + 1}번째 샷 · 누적 {r.currentHoleScore}타
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <select
            value={r.currentPar}
            onChange={(e) => r.changeHolePar(r.currentHole - 1, Number(e.target.value))}
            aria-label="기준 파"
            style={{ height: '32px', padding: '0 4px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 'bold', color: '#0f172a', flexShrink: 0 }}
          >
            {[3, 4, 5, 6].map((p) => (
              <option key={p} value={p}>
                Par {p}
              </option>
            ))}
          </select>
          <DistanceStepper value={r.holeDistance} onChange={r.changeHoleDistance} name="홀 거리" />
        </div>
      </div>

      {/* 현재 핀까지 + 추천 클럽 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          backgroundColor: '#f0fdf4',
          border: '1.5px solid #86efac',
          borderRadius: '10px',
          padding: '6px 10px',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534', whiteSpace: 'nowrap' }}>🚩 현재 핀까지</span>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#15803d', whiteSpace: 'nowrap' }}>{r.currentPrevDistance}m</span>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#ffffff',
            padding: '3px 9px',
            borderRadius: '20px',
            border: '1px solid #bbf7d0',
            fontSize: '11.5px',
            fontWeight: 'bold',
            color: '#166534',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: '#059669' }}>💡 추천:</span>
          <span>{r.recommendedClub}</span>
        </div>
      </div>

      {/* 사용 클럽 */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>🏌️ 사용한 클럽</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#047857' }}>{r.selectedClub}</span>
            <span style={{ fontSize: '10.5px', color: '#065f46', backgroundColor: '#ecfdf5', padding: '1px 7px', borderRadius: '12px' }}>
              평균 {r.expectedDistance(r.selectedClub)}m
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
          {clubs.map((c) => {
            const on = r.selectedClub === c.name
            return (
              <button
                key={c.id}
                onClick={() => r.handleClubSelect(c.name)}
                style={{
                  height: '30px',
                  borderRadius: '6px',
                  border: on ? '1.5px solid #047857' : '1px solid #cbd5e1',
                  backgroundColor: on ? '#ecfdf5' : '#ffffff',
                  color: on ? '#047857' : '#334155',
                  fontWeight: on ? 'bold' : 'normal',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  padding: '0 2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* 볼 위치 */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>📍 볼이 멈춘 위치</span>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#2563eb' }}>
            {r.selectedLie} {getPenaltyByLie(r.selectedLie) > 0 && `(+${getPenaltyByLie(r.selectedLie)}벌타)`}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {BALL_LIE_OPTIONS.map((item) => {
            const on = r.selectedLie === item.lie
            return (
              <button
                key={item.lie}
                onClick={() => r.setSelectedLie(item.lie)}
                style={{
                  height: '34px',
                  borderRadius: '6px',
                  border: on ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: on ? '#eff6ff' : '#ffffff',
                  color: on ? '#2563eb' : item.color,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 2px',
                  lineHeight: 1.15,
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: on ? 'bold' : 600, whiteSpace: 'nowrap' }}>{item.label}</span>
                {item.badge && <span style={{ fontSize: '9px', color: '#dc2626', fontWeight: 'bold' }}>{item.badge}</span>}
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
          gap: '6px',
          backgroundColor: isOb ? '#f8fafc' : '#eff6ff',
          border: isOb ? '1.5px solid #cbd5e1' : '2px solid #60a5fa',
          borderRadius: '10px',
          padding: '8px 10px',
          marginBottom: '6px',
          opacity: isOb ? 0.55 : 1,
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 'bold', color: isOb ? '#b91c1c' : '#1e3a8a', whiteSpace: 'nowrap', textAlign: 'center' }}>
          {isOb ? '📍 원위치 유지' : '📍 남은 거리 📍'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <DistanceStepper
            value={isOb ? r.currentPrevDistance : r.remainingDistance}
            onChange={r.changeRemaining}
            disabled={isOb}
            step={step}
            onKeyDown={onKeyDownDistance}
            name="샷 후 남은 거리"
            emphasized
          />
          <button
            type="button"
            disabled={isOb}
            aria-pressed={r.isPinOver}
            onClick={() => r.setIsPinOver(!r.isPinOver)}
            style={{
              minHeight: '36px',
              padding: '5px 10px',
              fontSize: '11px',
              borderRadius: '8px',
              border: r.isPinOver ? '1px solid #d97706' : '1px solid #93c5fd',
              backgroundColor: r.isPinOver ? '#f59e0b' : '#ffffff',
              color: r.isPinOver ? '#ffffff' : '#1d4ed8',
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
          backgroundColor: r.isPinOver ? '#fef3c7' : '#f0fdf4',
          border: r.isPinOver ? '1.5px solid #f59e0b' : '1.5px solid #86efac',
          borderRadius: '10px',
          padding: '5px 10px',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', minWidth: 0 }}>
          <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: r.isPinOver ? '#92400e' : '#166534', whiteSpace: 'nowrap' }}>🎯 계산 비거리</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: r.isPinOver ? '#b45309' : '#15803d', whiteSpace: 'nowrap' }}>
            {isOb ? 0 : r.calculatedShotDistance}m
          </span>
          <span style={{ fontSize: '10.5px', color: '#64748b', whiteSpace: 'nowrap' }}>({r.selectedClub})</span>
        </div>
      </div>

      {/* 메인 버튼 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <button
          onClick={() => r.saveShot(false)}
          style={{ padding: '11px 4px', backgroundColor: '#047857', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          ✓ 샷 결과 저장
        </button>
        <button
          onClick={() => r.saveShot(true)}
          style={{ padding: '11px 4px', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          🏁 땡그랑! (홀아웃)
        </button>
      </div>

      {/* 퍼트 빠른 입력: 직전 샷이 그린에 올랐을 때만 노출 */}
      {r.isOnGreen && (
        <div style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534', marginBottom: '6px' }}>
            ⛳ 퍼트 한 번에 입력 <span style={{ fontWeight: 'normal', color: '#64748b' }}>(누르면 바로 홀아웃)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => r.quickPutt(n)}
                style={{ height: '36px', borderRadius: '8px', border: '1px solid #86efac', backgroundColor: '#ffffff', color: '#15803d', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {n}퍼트
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 서브 버튼 */}
      {(r.currentShots.length > 0 || r.completedHoles.length > 0) && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {r.currentShots.length > 0 && (
            <button
              onClick={r.undoLastShot}
              style={{ flex: 1, padding: '8px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
            >
              ↩ 직전 샷 취소
            </button>
          )}
          {r.completedHoles.length > 0 && r.currentShots.length === 0 && (
            <button
              onClick={r.undoPreviousHole}
              disabled={r.isSaving}
              style={{ flex: 1, padding: '8px 12px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12.5px', fontWeight: 'bold', cursor: r.isSaving ? 'not-allowed' : 'pointer', opacity: r.isSaving ? 0.6 : 1 }}
            >
              ↩ 직전 홀 삭제 & 다시 입력
            </button>
          )}
        </div>
      )}
    </div>
  )
}
