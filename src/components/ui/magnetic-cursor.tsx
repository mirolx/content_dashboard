'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import gsap from 'gsap'
import { length, lerp, sub, vec, type Vec } from '@/lib/cursor/vec'

const SELECTOR = '[data-magnetic]'

type MagneticCursorProps = {
  children: ReactNode
  /** 호버한 요소가 커서 쪽으로 끌려오는 정도 */
  magneticFactor?: number
  lerpAmount?: number
  hoverPadding?: number
  cursorSize?: number
  cursorColor?: string
  blendMode?: 'difference' | 'exclusion' | 'normal' | 'screen' | 'overlay'
  speedMultiplier?: number
  maxScaleX?: number
  maxScaleY?: number
  /** 블렌딩 전에 배경 대비를 높여 어두운 배경에서도 잘 보이게 한다 */
  contrastBoost?: number
  disableOnTouch?: boolean
}

/**
 * 마우스를 부드럽게 따라다니는 원형 커서. data-magnetic 요소에 올리면 그 요소 모양으로 바뀌고
 * 요소가 커서 쪽으로 살짝 끌려온다. 문서 전체에서 이벤트를 받으므로 나중에 렌더링된 요소도 동작한다.
 * 터치 기기에서는 끄고, prefers-reduced-motion이면 지연·늘어남 없이 따라간다.
 */
export function MagneticCursor({
  children,
  magneticFactor = 0.2,
  lerpAmount = 0.1,
  hoverPadding = 12,
  cursorSize = 24,
  cursorColor = 'white',
  blendMode = 'exclusion',
  speedMultiplier = 0.02,
  maxScaleX = 1,
  maxScaleY = 0.3,
  contrastBoost = 1.5,
  disableOnTouch = true,
}: MagneticCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor) return
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (disableOnTouch && isTouch) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const detachDuration = reduced ? 0.1 : 0.35
    gsap.set(cursor, { xPercent: -50, yPercent: -50, opacity: 0 })

    let current: Vec = vec(-100, -100)
    let target: Vec = vec(-100, -100)
    let previous: Vec = vec(-100, -100)
    let initialized = false
    let detaching = false
    let hovered: HTMLElement | null = null
    const movers = new WeakMap<HTMLElement, { x: gsap.QuickToFunc; y: gsap.QuickToFunc }>()

    const moverFor = (el: HTMLElement) => {
      let m = movers.get(el)
      if (!m) {
        m = {
          x: gsap.quickTo(el, 'x', { duration: 1, ease: 'elastic.out(1, 0.3)' }),
          y: gsap.quickTo(el, 'y', { duration: 1, ease: 'elastic.out(1, 0.3)' }),
        }
        movers.set(el, m)
      }
      return m
    }

    const tick = () => {
      if (hovered) return
      current = lerp(current, target, reduced ? 1 : lerpAmount)
      const delta = sub(current, previous)
      previous = current
      if (detaching || reduced) {
        gsap.set(cursor, { x: current.x, y: current.y, scaleX: 1, scaleY: 1, rotate: 0 })
        return
      }
      const speed = length(delta) * speedMultiplier
      gsap.set(cursor, {
        x: current.x,
        y: current.y,
        rotate: (Math.atan2(delta.y, delta.x) * 180) / Math.PI,
        scaleX: 1 + Math.min(speed, maxScaleX),
        scaleY: 1 - Math.min(speed, maxScaleY),
      })
    }

    const attach = (el: HTMLElement) => {
      hovered = el
      detaching = false
      const bounds = el.getBoundingClientRect()
      const padding = hoverPadding * (1 + magneticFactor)
      gsap.killTweensOf(cursor)
      gsap.to(cursor, {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
        borderRadius: window.getComputedStyle(el).borderRadius,
        backgroundColor: el.dataset.magneticColor || cursorColor,
        scaleX: 1,
        scaleY: 1,
        rotate: 0,
        duration: 0.3,
        ease: 'power3.out',
        overwrite: true,
      })
    }

    const detach = (el: HTMLElement) => {
      const x = gsap.getProperty(cursor, 'x') as number
      const y = gsap.getProperty(cursor, 'y') as number
      current = vec(x, y)
      previous = vec(x, y)
      hovered = null
      detaching = true
      const m = moverFor(el)
      m.x(0)
      m.y(0)
      gsap.killTweensOf(cursor)
      gsap.to(cursor, {
        width: cursorSize,
        height: cursorSize,
        borderRadius: '50%',
        backgroundColor: cursorColor,
        scaleX: 1,
        scaleY: 1,
        duration: detachDuration,
        ease: 'power3.out',
        overwrite: true,
        onComplete: () => {
          detaching = false
        },
      })
    }

    const magneticTarget = (node: EventTarget | null) => {
      const el = node instanceof Element ? node.closest<HTMLElement>(SELECTOR) : null
      return el && !el.matches(':disabled') ? el : null
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      target = vec(e.clientX, e.clientY)
      if (!initialized) {
        initialized = true
        current = target
        previous = target
        gsap.set(cursor, { x: target.x, y: target.y })
      }
      gsap.to(cursor, { opacity: 1, duration: 0.2, overwrite: 'auto' })
      if (hovered) {
        const { left, top, width, height } = hovered.getBoundingClientRect()
        const m = moverFor(hovered)
        m.x((e.clientX - (left + width / 2)) * magneticFactor)
        m.y((e.clientY - (top + height / 2)) * magneticFactor)
      }
    }

    const onPointerOver = (e: PointerEvent) => {
      const el = magneticTarget(e.target)
      if (!el || el === hovered) return
      if (hovered) detach(hovered)
      attach(el)
    }

    const onPointerOut = (e: PointerEvent) => {
      if (!hovered) return
      if (magneticTarget(e.relatedTarget) === hovered) return
      detach(hovered)
    }

    const onDocumentLeave = () => gsap.to(cursor, { opacity: 0, duration: 0.3 })

    gsap.ticker.add(tick)
    window.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerout', onPointerOut)
    document.documentElement.addEventListener('mouseleave', onDocumentLeave)

    return () => {
      gsap.ticker.remove(tick)
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      document.documentElement.removeEventListener('mouseleave', onDocumentLeave)
      if (hovered) gsap.set(hovered, { x: 0, y: 0 })
      gsap.killTweensOf(cursor)
    }
  }, [
    magneticFactor,
    lerpAmount,
    hoverPadding,
    cursorSize,
    cursorColor,
    speedMultiplier,
    maxScaleX,
    maxScaleY,
    disableOnTouch,
  ])

  const style: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 9999,
    pointerEvents: 'none',
    opacity: 0,
    willChange: 'transform, width, height, border-radius',
    backgroundColor: cursorColor,
    mixBlendMode: blendMode,
    width: cursorSize,
    height: cursorSize,
    borderRadius: '50%',
    backdropFilter: contrastBoost !== 1 ? `contrast(${contrastBoost})` : undefined,
    WebkitBackdropFilter: contrastBoost !== 1 ? `contrast(${contrastBoost})` : undefined,
  }

  return (
    <>
      <div ref={cursorRef} aria-hidden="true" className="magnetic-cursor" style={style} />
      {children}
    </>
  )
}
