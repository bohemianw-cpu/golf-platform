'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 스크롤할 수 있는 화면에서 상단바·하단 메뉴를 잠시 보여 줬다가 2.5초 뒤 숨긴다.
 * 숨은 상태에서 30px 이상 스크롤하면 다시 보여 준다. 스크롤할 내용이 없으면 항상 보인다.
 * remeasureKey가 바뀌면(탭 이동, 로그인 상태 변화 등) 스크롤 가능 여부를 다시 잰다.
 */
export function useAutoHideChrome(remeasureKey: string) {
  const [chromeVisible, setChromeVisible] = useState(true)
  const mainRef = useRef<HTMLElement | null>(null)
  const hasScrollableContentRef = useRef(false)
  const chromeHideTimer = useRef<number | null>(null)
  const chromeVisibleRef = useRef(true)
  const scrollPositions = useRef(new WeakMap<EventTarget, number>())
  const scrollDistance = useRef(0)

  const showChrome = useCallback(() => {
    chromeVisibleRef.current = true
    scrollDistance.current = 0
    setChromeVisible(true)
    if (chromeHideTimer.current) window.clearTimeout(chromeHideTimer.current)
    if (!hasScrollableContentRef.current) return
    chromeHideTimer.current = window.setTimeout(() => {
      if (!hasScrollableContentRef.current) {
        chromeVisibleRef.current = true
        setChromeVisible(true)
        return
      }
      chromeVisibleRef.current = false
      scrollDistance.current = 0
      setChromeVisible(false)
    }, 2500)
  }, [])

  useEffect(() => {
    const measureScrollableContent = () => {
      const canScroll = document.documentElement.scrollHeight > window.innerHeight + 1
      const changed = hasScrollableContentRef.current !== canScroll
      hasScrollableContentRef.current = canScroll
      if (!canScroll) {
        if (chromeHideTimer.current) window.clearTimeout(chromeHideTimer.current)
        chromeVisibleRef.current = true
        setChromeVisible(true)
      } else if (changed) {
        showChrome()
      }
    }
    const onScroll = (event: Event) => {
      if (!hasScrollableContentRef.current) return
      const target = event.target
      if (!(target instanceof Document) && !(target instanceof Element)) return
      const top = target instanceof Document ? window.scrollY : target.scrollTop
      const previousTop = scrollPositions.current.get(target) ?? 0
      scrollPositions.current.set(target, top)
      const moved = Math.abs(top - previousTop)
      if (moved === 0) return
      if (chromeVisibleRef.current) {
        showChrome()
      } else {
        scrollDistance.current += moved
        if (scrollDistance.current >= 30) showChrome()
      }
    }
    measureScrollableContent()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', measureScrollableContent)
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureScrollableContent) : null
    const mutationObserver = typeof MutationObserver !== 'undefined' ? new MutationObserver(measureScrollableContent) : null
    if (mainRef.current) {
      resizeObserver?.observe(mainRef.current)
      mutationObserver?.observe(mainRef.current, { childList: true, subtree: true, attributes: true })
    }
    measureScrollableContent()
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', measureScrollableContent)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      if (chromeHideTimer.current) window.clearTimeout(chromeHideTimer.current)
    }
  }, [showChrome, remeasureKey])

  return { chromeVisible, mainRef }
}
