'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { palette } from '@/utils/theme'

interface ScoreGuideTourProps {
  enabled: boolean
  bottomNavVisible: boolean
  startAutomatically: boolean
  onAutoStart: () => void
  onComplete: () => void
}

const STEPS = [
  {
    target: '[data-score-guide-target="course"]',
    title: '1. 구장과 라운드 방식',
    body: '골프장 이름을 검색해 선택하세요. 필드와 스크린을 모두 지원하는 구장은 실제 플레이 방식을 선택합니다.',
  },
  {
    target: '[data-score-guide-target="course-layout"]',
    title: '2. 코스 순서와 티 위치',
    body: '오늘 플레이할 9홀 코스를 순서대로 고르고, 모든 홀에 제공되는 티 거리에서 티를 선택하세요. 공식 티가 없으면 기준 거리로 기록합니다.',
  },
  {
    target: '[data-score-guide-target="clubs"]',
    title: '3. 클럽 설정',
    body: '사용하는 클럽을 설정하면 샷 입력과 클럽별 비거리 분석에 반영됩니다.',
  },
  {
    target: '[data-score-guide-target="shot-entry"]',
    title: '4. 샷 입력과 분석',
    body: '홀 시작 시 실제 티·핀 위치에 맞춰 보정거리를 입력하면 샷 비거리와 접근율을 더 정확하게 계산할 수 있습니다. 이후 홀별 샷의 클럽, 남은 거리, 라이를 입력하세요. 기록은 진행 홀·페어웨이·그린 적중 통계에 반영됩니다.',
  },
]

interface Position { top: number; left: number; width: number; height: number }

export default function ScoreGuideTour({ enabled, bottomNavVisible, startAutomatically, onAutoStart, onComplete }: ScoreGuideTourProps) {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [position, setPosition] = useState<Position | null>(null)
  const [viewport, setViewport] = useState({ width: 360, height: 640 })
  const [tooltipHeight, setTooltipHeight] = useState(218)
  const tooltipRef = useRef<HTMLElement | null>(null)
  const autoStartedRef = useRef(false)
  const currentStep = STEPS[stepIndex]

  useEffect(() => {
    if (enabled && startAutomatically && !autoStartedRef.current) {
      autoStartedRef.current = true
      setStepIndex(0)
      setActive(true)
      onAutoStart()
    }
  }, [enabled, startAutomatically, onAutoStart])

  const measure = useCallback(() => {
    if (!active || !currentStep) return
    const target = document.querySelector<HTMLElement>(currentStep.target)
    if (!target) {
      setPosition(null)
      return
    }
    const rect = target.getBoundingClientRect()
    setPosition({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
  }, [active, currentStep])

  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    if (!active) return
    const frame = window.requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [active, measure])

  useEffect(() => {
    if (!active || !tooltipRef.current) return
    const observer = new ResizeObserver(([entry]) => setTooltipHeight(entry.contentRect.height))
    observer.observe(tooltipRef.current)
    return () => observer.disconnect()
  }, [active])

  const finish = useCallback(() => {
    setActive(false)
    onComplete()
  }, [onComplete])

  const beginReplay = () => {
    setStepIndex(0)
    setActive(true)
  }

  const tooltipPosition = useMemo(() => {
    const width = Math.min(360, Math.max(220, viewport.width - 24))
    const left = position
      ? Math.max(12, Math.min(position.left + position.width / 2 - width / 2, viewport.width - width - 12))
      : Math.max(12, (viewport.width - width) / 2)
    const below = position ? position.top + position.height + 14 : null
    const top = below != null && below + tooltipHeight < viewport.height - 12
      ? below
      : position ? Math.max(12, position.top - tooltipHeight - 14) : Math.max(12, (viewport.height - tooltipHeight) / 2)
    return { left, top, width }
  }, [position, viewport, tooltipHeight])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, finish])

  return <>
    {!active && <button
      type="button"
      onClick={beginReplay}
      aria-label="스코어 입력 도움말 다시 보기"
      title="입력 도움말 다시 보기"
      style={{ position: 'fixed', left: 12, bottom: `calc(${bottomNavVisible ? 76 : 12}px + env(safe-area-inset-bottom, 0px))`, transition: 'bottom 220ms ease', zIndex: 60, border: `1px solid ${palette.sky300}`, borderRadius: '999px', background: palette.sky50, color: palette.sky700, minHeight: 36, padding: '0 11px', fontSize: 12, fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(15,23,42,.18)' }}
    >도움말</button>}
    {active && <>
      <div aria-hidden="true" style={{ position: 'fixed', zIndex: 10000, inset: 0, pointerEvents: 'none' }} />
      {position && <div aria-hidden="true" style={{ position: 'fixed', zIndex: 10001, top: position.top, left: position.left, width: position.width, height: position.height, border: `3px solid ${palette.sky400}`, borderRadius: 10, boxShadow: '0 0 0 9999px rgba(15,23,42,.62), 0 0 0 6px rgba(56,189,248,.3)', pointerEvents: 'none', boxSizing: 'border-box' }} />}
      <section
        ref={tooltipRef}
        role="dialog"
        aria-labelledby="score-guide-title"
        aria-describedby="score-guide-description"
        aria-live="polite"
        style={{ position: 'fixed', zIndex: 10002, top: tooltipPosition.top, left: tooltipPosition.left, width: tooltipPosition.width, boxSizing: 'border-box', padding: 17, background: palette.white, border: `2px solid ${palette.sky400}`, borderRadius: 14, boxShadow: '0 16px 44px rgba(15,23,42,.28)' }}
      >
        <div style={{ color: palette.sky700, fontSize: 10, fontWeight: 800, letterSpacing: '.08em' }}>스코어 입력 안내 · {stepIndex + 1}/{STEPS.length}</div>
        <h2 id="score-guide-title" style={{ margin: '6px 0', color: palette.slate900, fontSize: 17 }}>{currentStep.title}</h2>
        <p id="score-guide-description" style={{ margin: '0 0 14px', color: palette.slate600, fontSize: 13, lineHeight: 1.6 }}>{currentStep.body}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={finish} style={{ padding: '8px 10px', border: 0, borderRadius: 7, background: 'transparent', color: palette.slate500, cursor: 'pointer', font: 'inherit', fontSize: 12 }}>건너뛰기</button>
          <div style={{ display: 'flex', gap: 7 }}>
            {stepIndex > 0 && <button type="button" onClick={() => setStepIndex((value) => value - 1)} style={{ padding: '8px 11px', border: `1px solid ${palette.slate300}`, borderRadius: 7, background: palette.white, color: palette.slate700, cursor: 'pointer', font: 'inherit', fontSize: 12 }}>이전</button>}
            <button type="button" autoFocus onClick={() => stepIndex === STEPS.length - 1 ? finish() : setStepIndex((value) => value + 1)} style={{ padding: '8px 13px', border: 0, borderRadius: 7, background: palette.sky700, color: palette.white, cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700 }}>{stepIndex === STEPS.length - 1 ? '완료' : '다음'}</button>
          </div>
        </div>
      </section>
    </>}
  </>
}
