'use client'

import { useEffect, useRef, useState } from 'react'

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

// 창 위에 창이 열리면(예: 클럽 설정 위의 확인 창) 맨 위 창만 키보드를 처리한다.
const openModals: symbol[] = []

const focusableIn = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0)

/**
 * 화면을 덮는 창을 키보드로 쓸 수 있게 한다.
 * - 열리면 키보드 위치를 창 안으로 옮긴다(이미 창 안에 있으면 그대로, 아니면 첫 입력란, 없으면 첫 버튼).
 * - Tab·Shift+Tab은 창 안에서만 돈다.
 * - Esc를 누르면 onEscape를 부른다. 넘기지 않으면 Esc로 닫히지 않는다.
 * - 닫히면 창을 열기 전 위치로 키보드 위치를 돌려놓는다.
 * 돌려주는 ref는 창 요소에 붙인다. 창이 늦게 그려져도(예: 로딩 화면 뒤) 그려지는 순간 처리를 시작한다.
 */
export function useModalKeyboard<T extends HTMLElement>(active: boolean, onEscape?: () => void) {
  const [root, setRoot] = useState<T | null>(null)
  const onEscapeRef = useRef(onEscape)
  useEffect(() => { onEscapeRef.current = onEscape })

  useEffect(() => {
    if (!active || !root) return
    const id = Symbol('modal')
    openModals.push(id)
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!root.contains(document.activeElement)) {
      const items = focusableIn(root)
      const target = items.find((el) => el.matches('input, select, textarea')) ?? items[0]
      if (target) target.focus()
      else { root.setAttribute('tabindex', '-1'); root.focus() }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== id) return
      if (event.key === 'Escape' && onEscapeRef.current) {
        event.preventDefault()
        onEscapeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusableIn(root)
      if (items.length === 0) { event.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const inside = root.contains(document.activeElement)
      if (event.shiftKey && (document.activeElement === first || !inside)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !inside)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      openModals.splice(openModals.indexOf(id), 1)
      if (previous?.isConnected) previous.focus()
    }
  }, [active, root])

  return setRoot
}
