# 디자인 시스템 적용 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 다크 프레임 벤토 디자인(따뜻한 검정 배경, 크림·포인트·다크 카드, Pretendard, 알약 탭)과 플랫폼별 포인트 색(YouTube 더스티 로즈 / Instagram 더스티 라벤더), 마그네틱 커서를 모든 화면에 적용한다.

**Architecture:** Tailwind 4 `@theme` 토큰 + `data-platform` 속성으로 바뀌는 `--accent` 변수. `src/components/ui/`에 작은 공용 컴포넌트(Card, Button, IconButton, PillTabs, 필드 클래스, Tag, MagneticCursor)를 만들고, 위젯·페이지는 이걸 가져다 쓴다. 기능 로직과 문구는 바꾸지 않는다.

**Tech Stack:** Next.js 16, Tailwind CSS 4, TypeScript, gsap, pretendard, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-30-design-system-design.md`

## Global Constraints

- 토큰: `ink #1C1818`, `panel #262020`, `line #3A3131`, `cream #F6EFEB`, `muted #A89A96`, `danger #E07A6F`, `accent = var(--accent)` (기본 `#D4A5A5`, `[data-platform="instagram"]`에서 `#B5A5D4`).
- 카드 반경 20px, 알약 `rounded-full`, 벤토 간격 `gap-2`. 글꼴 Pretendard, 제목 `font-extrabold tracking-tight`.
- 카드 tone: cream = `bg-cream text-ink`, accent = `bg-accent text-ink`, dark = `bg-panel text-cream border border-line`.
- 위젯 tone 배치: 업로드 일정 cream · 체크리스트 accent · 편집 진행 상태 dark · 오늘의 트렌드 cream · 고정된 아이디어/레퍼런스/해시태그 dark · 빠른 메모 cream · 성과 스냅샷 accent. 설정: 계정 cream, 워크스페이스/채널/키워드 dark, 오늘 트렌드 accent.
- accent 카드 위의 주 버튼은 `variant="ink"`(accent 위 accent는 안 보임).
- 마그네틱: `Button`(기본 켬), `PillTabs` 링크, 트렌드 고정 버튼, 트렌드 설정 화살표 링크에만. 입력칸·체크박스·`IconButton`·삭제 버튼(`magnetic={false}`)에는 없음. 터치·`prefers-reduced-motion`에서 끔. 시스템 커서는 숨기지 않음.
- 기능·문구·i18n 키는 바꾸지 않는다. 앱은 항상 다크.
- 커밋에서 `.claude/`, AGENTS.md 변경은 제외. 커밋 메시지 끝에 빈 줄 + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Map

| 파일 | 책임 |
|---|---|
| `src/app/globals.css` | 토큰, 기본 배경·글자 |
| `src/lib/cursor/vec.ts` | 2D 벡터 순수 함수 |
| `src/lib/platform.ts` | `platformFromPath` |
| `src/components/PlatformScope.tsx` | `data-platform` 부여 |
| `src/components/ui/card.tsx` | `Card` |
| `src/components/ui/button.tsx` | `Button`, `IconButton` |
| `src/components/ui/pill-tabs.tsx` | `PillTabs`, `pillClass` |
| `src/components/ui/field.ts` | `fieldClass`, `selectClass` |
| `src/components/ui/tag.tsx` | `Tag` |
| `src/components/ui/magnetic-cursor.tsx` | `MagneticCursor` |
| `src/components/WidgetCard.tsx` | Task 2에서 `Card` 재수출로 바꾸고 Task 7에서 삭제 |

---

### Task 1: 토대 — 의존성 · 토큰 · 글꼴 · 벡터 · 플랫폼 스코프

**Files:**
- Modify: `package.json` (의존성), `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`
- Create: `src/lib/cursor/vec.ts`, `src/lib/platform.ts`, `src/components/PlatformScope.tsx`
- Test: `src/lib/cursor/vec.test.ts`, `src/lib/platform.test.ts`

**Interfaces:**
- Produces: `Vec = { x: number; y: number }`, `vec(x?, y?)`, `lerp(a, b, t)`, `sub(a, b)`, `length(v)`
- Produces: `platformFromPath(pathname: string): Platform | null`
- Produces: `<PlatformScope>{children}</PlatformScope>` — `data-platform` 속성을 가진 `display: contents` 래퍼

- [ ] **Step 1: 의존성**

```bash
npm install gsap pretendard lucide-react
```

`node_modules/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css`가 있는지 확인한다(없으면 `ls node_modules/pretendard/dist/web/variable/`로 가변 폰트 CSS 파일명을 찾아 Step 5에서 그 경로를 쓴다).

- [ ] **Step 2: 실패하는 테스트**

`src/lib/cursor/vec.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { length, lerp, sub, vec } from './vec'

describe('vec', () => {
  it('lerps between two points', () => {
    expect(lerp(vec(0, 0), vec(10, 20), 0.5)).toEqual({ x: 5, y: 10 })
    expect(lerp(vec(1, 1), vec(9, 9), 1)).toEqual({ x: 9, y: 9 })
    expect(lerp(vec(1, 1), vec(9, 9), 0)).toEqual({ x: 1, y: 1 })
  })

  it('subtracts and measures length', () => {
    expect(sub(vec(5, 7), vec(2, 3))).toEqual({ x: 3, y: 4 })
    expect(length(vec(3, 4))).toBe(5)
  })

  it('defaults to the origin and does not mutate inputs', () => {
    const a = vec()
    expect(a).toEqual({ x: 0, y: 0 })
    lerp(a, vec(4, 4), 0.5)
    expect(a).toEqual({ x: 0, y: 0 })
  })
})
```

`src/lib/platform.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { platformFromPath } from './platform'

describe('platformFromPath', () => {
  it('reads the first path segment', () => {
    expect(platformFromPath('/youtube')).toBe('youtube')
    expect(platformFromPath('/instagram/settings')).toBe('instagram')
  })

  it('returns null outside a workspace', () => {
    expect(platformFromPath('/login')).toBeNull()
    expect(platformFromPath('/')).toBeNull()
    expect(platformFromPath('')).toBeNull()
  })
})
```

Run: `npm test -- src/lib/cursor src/lib/platform.test.ts` → FAIL (모듈 없음)

- [ ] **Step 3: 구현**

`src/lib/cursor/vec.ts`:

```ts
/** 마그네틱 커서용 2D 벡터. 입력을 바꾸지 않고 새 값을 돌려준다. */
export type Vec = { x: number; y: number }

export const vec = (x = 0, y = 0): Vec => ({ x, y })

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function length(v: Vec): number {
  return Math.hypot(v.x, v.y)
}
```

`src/lib/platform.ts`:

```ts
import { isPlatform, type Platform } from '@/lib/types'

/** "/youtube/settings" → "youtube". 워크스페이스 밖이면 null. */
export function platformFromPath(pathname: string): Platform | null {
  const first = pathname.split('/')[1] ?? ''
  return isPlatform(first) ? first : null
}
```

`src/components/PlatformScope.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { platformFromPath } from '@/lib/platform'

/** 현재 경로의 플랫폼을 data-platform으로 달아, 그 아래의 accent 색을 바꾼다. */
export function PlatformScope({ children }: { children: ReactNode }) {
  const platform = platformFromPath(usePathname() ?? '')
  return (
    <div data-platform={platform ?? undefined} className="contents">
      {children}
    </div>
  )
}
```

Run: `npm test -- src/lib/cursor src/lib/platform.test.ts` → PASS

- [ ] **Step 4: 토큰**

`src/app/globals.css` 전체 교체:

```css
@import "tailwindcss";

/* 플랫폼별 포인트 색. PlatformScope가 data-platform을 단다. */
:root {
  --accent: #d4a5a5;
}
[data-platform="instagram"] {
  --accent: #b5a5d4;
}

@theme {
  --color-ink: #1c1818;
  --color-panel: #262020;
  --color-line: #3a3131;
  --color-cream: #f6efeb;
  --color-muted: #a89a96;
  --color-danger: #e07a6f;
  --font-sans: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
}

/* inline: 유틸리티가 var(--accent)를 직접 참조해야 data-platform 아래에서 값이 바뀐다. */
@theme inline {
  --color-accent: var(--accent);
}

html,
body {
  background: var(--color-ink);
  color: var(--color-cream);
}
```

- [ ] **Step 5: 글꼴·배경 (루트 레이아웃)**

`src/app/layout.tsx`에서 `import './globals.css'` 바로 위에 추가:

```ts
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
```

`<body className="bg-white text-gray-900 antialiased">`를 다음으로 교체:

```tsx
      <body className="min-h-screen bg-ink font-sans text-cream antialiased">
```

- [ ] **Step 6: 플랫폼 스코프 연결**

`src/app/(app)/layout.tsx`: `import { PlatformScope } from '@/components/PlatformScope'`를 추가하고, 반환 JSX 최상위 `<div className="mx-auto max-w-7xl px-4 py-4">…</div>`를 `<PlatformScope>…</PlatformScope>`로 감싼다(안쪽은 그대로).

- [ ] **Step 7: 검증과 커밋**

Run: `npm test && npm run typecheck && npm run lint && npm run build` → 전부 통과

```bash
git add package.json package-lock.json src/app/globals.css src/app/layout.tsx "src/app/(app)/layout.tsx" src/lib/cursor src/lib/platform.ts src/lib/platform.test.ts src/components/PlatformScope.tsx
git commit -m "feat: add design tokens, Pretendard, and platform accent scope"
```

---

### Task 2: 공용 UI 컴포넌트

**Files:**
- Create: `src/components/ui/card.tsx`, `button.tsx`, `pill-tabs.tsx`, `field.ts`, `tag.tsx`
- Modify: `src/components/WidgetCard.tsx` (재수출), `src/components/EditableText.tsx` (테두리)

**Interfaces:**
- Produces: `CardTone = 'cream' | 'accent' | 'dark'`, `Card({ title, tone?, error?, action?, children })`
- Produces: `Button({ variant?: 'primary' | 'ink' | 'ghost' | 'danger', size?: 'sm' | 'md', magnetic?: boolean, ...buttonProps })`, `IconButton({ label, ...buttonProps })`
- Produces: `pillClass(active: boolean): string`, `PillTabs({ items: { href: string; label: string; active: boolean }[] })`
- Produces: `fieldClass`, `selectClass` (문자열)
- Produces: `Tag({ tone?: 'outline' | 'accent', children })`

- [ ] **Step 1: 컴포넌트 작성**

`src/components/ui/card.tsx`:

```tsx
import type { ReactNode } from 'react'

export type CardTone = 'cream' | 'accent' | 'dark'

const TONES: Record<CardTone, string> = {
  cream: 'bg-cream text-ink',
  accent: 'bg-accent text-ink',
  dark: 'bg-panel text-cream border border-line',
}

export function Card({
  title,
  tone = 'dark',
  error,
  action,
  children,
}: {
  title: string
  tone?: CardTone
  error?: string | null
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={`h-full rounded-[20px] p-5 ${TONES[tone]}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
        {action}
      </div>
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-danger/15 px-3 py-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {children}
    </section>
  )
}
```

`src/components/ui/button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'ink' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-ink hover:brightness-105',
  ink: 'bg-ink text-cream hover:bg-ink/90',
  ghost: 'border border-current/30 hover:border-current/70',
  danger: 'text-danger hover:bg-danger/10',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-5 text-sm',
}

/** 알약형 버튼. 기본으로 마그네틱 커서가 끌어당긴다(magnetic={false}로 끔). */
export function Button({
  variant = 'primary',
  size = 'md',
  magnetic = true,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; magnetic?: boolean }) {
  return (
    <button
      {...props}
      type={type}
      data-magnetic={magnetic ? '' : undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold transition disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  )
}

/** 작은 원형 아이콘 버튼(이동·삭제 등). 마그네틱 없음. */
export function IconButton({
  label,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/20 transition hover:border-current/60 disabled:opacity-30 ${className}`}
    >
      {children}
    </button>
  )
}
```

`src/components/ui/pill-tabs.tsx`:

```tsx
import Link from 'next/link'

/** 알약 탭 모양. 선택된 탭은 accent로 채우고 나머지는 테두리만. */
export function pillClass(active: boolean) {
  return `inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition ${
    active ? 'bg-accent text-ink' : 'border border-line text-cream hover:border-cream/60'
  }`
}

export function PillTabs({ items }: { items: { href: string; label: string; active: boolean }[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          data-magnetic
          aria-current={item.active ? 'page' : undefined}
          className={pillClass(item.active)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
```

`src/components/ui/field.ts`:

```ts
/** 입력칸·텍스트 영역 공통 클래스. 카드 글자색(currentColor)을 따라가므로 모든 tone에서 보인다. */
export const fieldClass =
  'min-w-0 rounded-xl border border-current/25 bg-transparent px-3 py-2 text-sm placeholder:text-current/45 focus:border-current/70 focus:outline-none'

/** select는 드롭다운 목록이 흰 배경이라 option 글자를 ink로 고정한다. */
export const selectClass = `${fieldClass} [&>option]:text-ink`
```

`src/components/ui/tag.tsx`:

```tsx
import type { ReactNode } from 'react'

export function Tag({ tone = 'outline', children }: { tone?: 'outline' | 'accent'; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
        tone === 'accent' ? 'bg-accent text-ink' : 'border border-current/30'
      }`}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 2: 기존 파일 연결**

`src/components/WidgetCard.tsx` 전체를 다음으로 교체(위젯을 하나씩 옮기는 동안 빌드를 유지하기 위한 임시 재수출; Task 7에서 삭제):

```tsx
export { Card as WidgetCard } from '@/components/ui/card'
```

`src/components/EditableText.tsx`의 input `className` 템플릿에서
`min-w-0 rounded border border-transparent px-1 hover:border-gray-300 focus:border-gray-400 focus:outline-none`
를
`min-w-0 rounded-md border border-transparent bg-transparent px-1 hover:border-current/30 focus:border-current/60 focus:outline-none`
로 바꾼다.

- [ ] **Step 3: 검증과 커밋**

Run: `npm test && npm run typecheck && npm run lint && npm run build` → 통과

```bash
git add src/components
git commit -m "feat: add Card, Button, PillTabs, field, and Tag components"
```

---

### Task 3: 마그네틱 커서

**Files:**
- Create: `src/components/ui/magnetic-cursor.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `vec`, `lerp`, `sub`, `length`, `Vec`
- Produces: `MagneticCursor({ children, magneticFactor?, lerpAmount?, hoverPadding?, cursorSize?, cursorColor?, blendMode?, speedMultiplier?, maxScaleX?, maxScaleY?, contrastBoost?, disableOnTouch? })`

사용자가 제공한 컴포넌트(gsap + vecteur)를 바탕으로, `vecteur` 대신 `vec.ts`를 쓰고, 마운트 때 요소를 모으는 대신 **이벤트 위임**으로 `[data-magnetic]`을 찾는다. 원형 모양만 지원한다(shape 옵션 제거 — 쓰지 않음).

- [ ] **Step 1: 컴포넌트**

`src/components/ui/magnetic-cursor.tsx`:

```tsx
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
        overwrite: 'all',
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
        overwrite: 'all',
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
```

- [ ] **Step 2: 루트 레이아웃에 연결**

`src/app/layout.tsx`에 `import { MagneticCursor } from '@/components/ui/magnetic-cursor'`를 추가하고, `<NextIntlClientProvider>{children}</NextIntlClientProvider>`를 다음으로 교체:

```tsx
        <NextIntlClientProvider>
          <MagneticCursor magneticFactor={0.35} cursorSize={28}>
            {children}
          </MagneticCursor>
        </NextIntlClientProvider>
```

- [ ] **Step 3: 검증과 커밋**

Run: `npm test && npm run typecheck && npm run lint && npm run build` → 통과. (gsap 타입 `gsap.QuickToFunc`가 없다는 오류가 나면 `ReturnType<typeof gsap.quickTo>`로 바꾼다.)

```bash
git add src/components/ui/magnetic-cursor.tsx src/app/layout.tsx
git commit -m "feat: add magnetic cursor with event delegation"
```

---

### Task 4: 앱 틀 — 헤더 · 대시보드 페이지 · 에러 화면

**Files:**
- Modify: `src/app/(app)/layout.tsx`, `src/app/(app)/WorkspaceTabs.tsx` (전체 교체), `src/app/(app)/[platform]/page.tsx` (전체 교체), `src/app/(app)/error.tsx` (전체 교체)

**Interfaces:**
- Consumes: `PlatformScope`, `Button`, `PillTabs`, `Card`

- [ ] **Step 1: 헤더**

`src/app/(app)/layout.tsx` 전체 교체:

```tsx
import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { PlatformScope } from '@/components/PlatformScope'
import { Button } from '@/components/ui/button'
import { signOut } from './actions'
import { WorkspaceTabs } from './WorkspaceTabs'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav')

  return (
    <PlatformScope>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <WorkspaceTabs />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              {t('logout')}
            </Button>
          </form>
        </header>
        {children}
      </div>
    </PlatformScope>
  )
}
```

`src/app/(app)/WorkspaceTabs.tsx` 전체 교체:

```tsx
'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PillTabs } from '@/components/ui/pill-tabs'
import { platformFromPath } from '@/lib/platform'
import { PLATFORMS } from '@/lib/types'

export function WorkspaceTabs() {
  const t = useTranslations('nav')
  const pathname = usePathname() ?? ''
  const current = platformFromPath(pathname)

  const items = PLATFORMS.map((p) => ({ href: `/${p}`, label: t(p), active: pathname === `/${p}` }))
  if (current) {
    items.push({
      href: `/${current}/settings`,
      label: t('settings'),
      active: pathname === `/${current}/settings`,
    })
  }
  return <PillTabs items={items} />
}
```

- [ ] **Step 2: 대시보드 페이지**

`src/app/(app)/[platform]/page.tsx` 전체 교체:

```tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/card'
import { ChecklistWidget } from '@/features/checklist/ChecklistWidget'
import { HashtagsWidget } from '@/features/hashtags/HashtagsWidget'
import { KanbanWidget } from '@/features/kanban/KanbanWidget'
import { MemoWidget } from '@/features/memo/MemoWidget'
import { PinnedIdeasWidget } from '@/features/ideas/PinnedIdeasWidget'
import { ReferencesWidget } from '@/features/references/ReferencesWidget'
import { ScheduleWidget } from '@/features/schedule/ScheduleWidget'
import { TrendsSection } from '@/features/trends/TrendsSection'
import { loadDashboard } from '@/lib/dashboard'
import { WorkspaceRealtime } from '@/lib/realtime/WorkspaceRealtime'
import { isPlatform } from '@/lib/types'
import { getWorkspace } from '@/lib/workspace'

const sectionClass = 'mt-4 text-xs font-semibold uppercase tracking-widest text-muted md:col-span-12'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ platform: string }>
}) {
  const { platform } = await params
  if (!isPlatform(platform)) notFound()
  const workspace = await getWorkspace(platform)
  if (!workspace) notFound()

  const [data, t] = await Promise.all([loadDashboard(workspace.id), getTranslations()])
  const isYouTube = platform === 'youtube'

  return (
    // key: 탭을 바꾸면 위젯 상태를 새 워크스페이스로 완전히 초기화한다.
    <WorkspaceRealtime key={workspace.id} workspaceId={workspace.id}>
      <h1 className="mb-6 text-4xl font-extrabold tracking-tight md:text-5xl">{workspace.name}</h1>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
        {/* ── 오늘 할 일 ── */}
        <h2 className={sectionClass}>{t('dashboard.today')}</h2>
        <div className="md:col-span-7">
          <ScheduleWidget initial={data.schedule} />
        </div>
        <div className="md:col-span-5">
          <ChecklistWidget initial={data.checklist} />
        </div>
        <div className="md:col-span-12">
          <KanbanWidget initial={data.kanban} />
        </div>

        {/* ── 탐색 · 영감 ── */}
        <h2 className={sectionClass}>{t('dashboard.explore')}</h2>
        {isYouTube && (
          <div className="md:col-span-8">
            <Suspense
              fallback={
                <Card title={t('trends.title')} tone="cream">
                  <p className="text-sm opacity-60">{t('trends.loading')}</p>
                </Card>
              }
            >
              <TrendsSection workspaceId={workspace.id} />
            </Suspense>
          </div>
        )}
        <div className={isYouTube ? 'md:col-span-4' : 'md:col-span-6'}>
          <PinnedIdeasWidget initial={data.ideas} />
        </div>
        <div className="md:col-span-6">
          <ReferencesWidget initial={data.references} />
        </div>
        <div className={isYouTube ? 'md:col-span-6' : 'md:col-span-4'}>
          <HashtagsWidget initial={data.hashtags} />
        </div>
        <div className={isYouTube ? 'md:col-span-8' : 'md:col-span-4'}>
          <MemoWidget initialMemo={workspace.memo} />
        </div>
        <div className="md:col-span-4">
          <Card title={t('performance.title')} tone="accent">
            <p className="text-sm font-medium opacity-70">{t('performance.comingSoon')}</p>
          </Card>
        </div>
      </div>
    </WorkspaceRealtime>
  )
}
```

- [ ] **Step 3: 에러 화면**

`src/app/(app)/error.tsx` 전체 교체:

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function AppError({ reset }: { reset: () => void }) {
  const t = useTranslations('common')
  return (
    <div className="mx-auto max-w-md py-16">
      <Card title={t('loadFailed')} tone="cream">
        <Button onClick={reset}>{t('retry')}</Button>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: 검증과 커밋**

Run: `npm test && npm run typecheck && npm run lint && npm run build` → 통과

```bash
git add "src/app/(app)"
git commit -m "feat: restyle header, dashboard grid, and error screen"
```

---

## 위젯 재스타일 규칙 (Task 5·6 공통)

기능 로직(상태, mutate, 검증, i18n 키)은 **한 줄도 바꾸지 않는다.** JSX의 모양만 아래 규칙으로 바꾼다. 규칙 적용 예시는 Task 5의 `ChecklistWidget` 전체 코드를 따른다.

| 기존 | 변경 |
|---|---|
| `import { WidgetCard } from '@/components/WidgetCard'` / `<WidgetCard …>` | `import { Card } from '@/components/ui/card'` / `<Card tone="…" …>` (tone은 Global Constraints 표) |
| 텍스트 `<input>`·`<textarea>`의 `className="… rounded border border-gray-300 px-2 py-1"` | `className={\`${fieldClass} <레이아웃 클래스만 유지: flex-1, w-full, w-32, sm:col-span-2 등>\`}` |
| `<select className="…">` | `className={selectClass}` (+ 레이아웃 클래스) |
| 추가(submit) 버튼 `rounded bg-gray-900 px-3 py-1 text-white` | `<Button type="submit" size="sm" variant={accent 카드면 "ink", 아니면 "primary"}>` (내용 그대로) |
| 삭제 텍스트 버튼(`text-red-600`) | `<Button variant="danger" size="sm" magnetic={false} onClick={…}>{tc('delete')}</Button>` |
| ↑ ↓ ← → 글자 버튼 | `<IconButton label={기존 aria-label} disabled={…} onClick={…}><ChevronUp/Down/Left/Right className="h-4 w-4" /></IconButton>` (`lucide-react`) |
| × 삭제 버튼(칩 안) | `<IconButton label={기존 aria-label} className="h-5 w-5 border-0" onClick={…}><X className="h-3 w-3" /></IconButton>` |
| `text-gray-500`, `text-gray-600`, `text-gray-400` | `opacity-60` (빈 상태·보조 글자) |
| `text-red-600` 안내 | `text-danger` |
| `text-green-700` 안내 | `font-medium opacity-80` |
| `rounded bg-gray-100 px-1 text-xs` 배지, 칩 `rounded-full border border-gray-300 px-2 py-0.5` | `<Tag>` (칩 안에 IconButton을 children으로) |
| `rounded border border-gray-300 …` 목록 카드(레퍼런스·아이디어) | `rounded-2xl border border-current/15 p-3` |
| `<img className="… rounded …">` | 같은 크기, `rounded-xl` |
| 체크박스 | `className="h-4 w-4 accent-ink"`(accent 카드) / `accent-[var(--accent)]`(그 외) |
| 링크 `underline` | `underline underline-offset-2` |

`fieldClass`, `selectClass`는 `@/components/ui/field`, `Button`·`IconButton`은 `@/components/ui/button`, `Tag`는 `@/components/ui/tag`에서 import한다.

---

### Task 5: 위젯 재스타일 A — 체크리스트 · 업로드 일정 · 편집 칸반 · 빠른 메모

**Files:**
- Modify: `src/features/checklist/ChecklistWidget.tsx` (아래 전체 코드), `src/features/schedule/ScheduleWidget.tsx`, `src/features/kanban/KanbanWidget.tsx`, `src/features/memo/MemoWidget.tsx`

- [ ] **Step 1: 체크리스트 (accent) — 전체 교체**

`src/features/checklist/ChecklistWidget.tsx`의 import 블록과 `return (…)` JSX를 다음으로 바꾼다(함수 본문의 로직은 그대로):

import 블록:

```tsx
import { useState, type FormEvent } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fieldClass } from '@/components/ui/field'
import { newId } from '@/lib/id'
import { positionAfter, positionBetween } from '@/lib/position'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { ChecklistItem } from '@/lib/types'
import { textSchema } from '@/lib/validation'
import { checklistData } from './data'
```

JSX:

```tsx
  return (
    <Card title={t('title')} tone="accent" error={error ? tc('saveFailed') : null}>
      <form onSubmit={add} className="mb-4 flex gap-2">
        <input
          aria-label={t('itemLabel')}
          placeholder={t('itemLabel')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={`${fieldClass} flex-1`}
        />
        <Button type="submit" size="sm" variant="ink">
          {tc('add')}
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm opacity-60">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <li key={row.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={tc('done')}
                checked={row.is_done}
                onChange={(e) => void update(row, { is_done: e.target.checked })}
                className="h-4 w-4 accent-ink"
              />
              <EditableText
                label={t('itemLabel')}
                value={row.content}
                onSave={(v) => update(row, { content: v })}
                className={`flex-1 text-sm ${row.is_done ? 'line-through opacity-50' : ''}`}
              />
              <IconButton label={tc('moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>
                <ChevronUp className="h-4 w-4" />
              </IconButton>
              <IconButton label={tc('moveDown')} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                <ChevronDown className="h-4 w-4" />
              </IconButton>
              <Button
                variant="danger"
                size="sm"
                magnetic={false}
                onClick={() => void mutate({ type: 'DELETE', id: row.id }, () => checklistData.remove(row.id))}
                className="!text-ink"
              >
                {tc('delete')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
```

(accent 카드 위에서는 danger 색이 accent와 대비가 약해 삭제 버튼 글자를 `!text-ink`로 둔다.)

- [ ] **Step 2: 업로드 일정 (cream)** — 규칙 적용. 종류 배지(`t(\`kinds.${row.kind}\`)`)는 `<Tag>`, 날짜 `<span>`은 `text-xs font-semibold opacity-70`, 체크박스 `accent-[var(--accent)]`. 입력 3개(제목·종류 select·datetime-local)는 `fieldClass`/`selectClass`.

- [ ] **Step 3: 편집 칸반 (dark)** — 규칙 적용에 더해:
  - 열 컨테이너 `rounded bg-gray-50 p-2` → `rounded-2xl bg-ink p-3`
  - 열 제목 `<h4>`: `mb-2 text-sm font-bold`, 카드가 1개 이상이면 `text-accent`, 아니면 `text-muted`; 개수 `<span>`은 `opacity-60`
  - 카드 `<li>` `rounded border border-gray-300 bg-white p-2` → `rounded-xl bg-cream p-3 text-ink`
  - ←/→ 는 `IconButton` + `ChevronLeft`/`ChevronRight`, 삭제는 규칙의 danger `Button`(`ml-auto`)
  - 빈 열 문구 `text-xs text-gray-400` → `text-xs opacity-50`

- [ ] **Step 4: 빠른 메모 (cream)** — `<textarea>`는 `` `${fieldClass} w-full` ``(rows 유지), 저장 상태 `<p>`는 `mt-2 h-4 text-xs opacity-60`.

- [ ] **Step 5: 검증과 커밋**

Run: `grep -n "gray-\|red-600\|green-700" src/features/checklist src/features/schedule src/features/kanban src/features/memo -r` → 결과 없음
Run: `npm test && npm run typecheck && npm run lint && npm run build` → 통과

```bash
git add src/features/checklist src/features/schedule src/features/kanban src/features/memo
git commit -m "feat: restyle checklist, schedule, kanban, and memo widgets"
```

---

### Task 6: 위젯 재스타일 B — 고정된 아이디어 · 레퍼런스 · 해시태그 · 트렌드

**Files:**
- Modify: `src/features/ideas/PinnedIdeasWidget.tsx`, `src/features/references/ReferencesWidget.tsx`, `src/features/hashtags/HashtagsWidget.tsx`, `src/features/trends/TrendsWidget.tsx`

- [ ] **Step 1: 고정된 아이디어 (dark)** — 규칙 적용. 목록 카드 `rounded-2xl border border-current/15 p-3`, 썸네일 `rounded-xl`, 메모 `text-xs opacity-60`, "원본 보기" 링크 `underline underline-offset-2`.

- [ ] **Step 2: 레퍼런스 (dark)** — 규칙 적용. 종류 배지 `<Tag>`, 목록 카드 규칙, "열기" 링크 규칙, 폼의 추가 버튼은 `primary`(`sm:col-span-2` 유지).

- [ ] **Step 3: 해시태그 (dark)** — 규칙 적용. 칩 `<li>`는 `<li key=…><Tag>#{row.tag}<IconButton …><X …/></IconButton></Tag></li>`, 그룹 제목 `<h4>`는 `mb-1 text-xs font-semibold uppercase tracking-widest opacity-60`.

- [ ] **Step 4: 트렌드 (cream)** — 규칙 적용에 더해:
  - 모든 `<WidgetCard>`(no-sources 포함)를 `<Card tone="cream" …>`로, 기본 화면 카드에는 `action`으로 설정 링크를 단다:

```tsx
action={
  <Link
    href="/youtube/settings"
    data-magnetic
    aria-label={t('goToSettings')}
    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-current/30 transition hover:border-current/70"
  >
    <ArrowUpRight className="h-4 w-4" />
  </Link>
}
```

  - 묶음 제목 `<h4>` → `mb-2 text-xs font-semibold uppercase tracking-widest opacity-60`
  - 매칭 키워드 `<span>`들 → `<Tag tone="accent">{keyword}</Tag>`
  - 고정 버튼 → `<Button size="sm" variant="ghost" disabled={isPinned} onClick={() => void pin(topic)} className="mt-2">{isPinned ? t('pinned') : t('pin')}</Button>` (마그네틱 켬)
  - 실패 안내(`text-amber-700`) → `text-sm font-medium text-danger`
  - 썸네일 `rounded-xl`, 제목 링크 `line-clamp-2 text-sm font-semibold hover:underline`
  - `import { ArrowUpRight } from 'lucide-react'`

- [ ] **Step 5: 검증과 커밋**

Run: `grep -rn "gray-\|red-600\|amber-700\|WidgetCard" src/features/ideas src/features/references src/features/hashtags src/features/trends/TrendsWidget.tsx` → 결과 없음
Run: `npm test && npm run typecheck && npm run lint && npm run build` → 통과

```bash
git add src/features/ideas src/features/references src/features/hashtags src/features/trends/TrendsWidget.tsx
git commit -m "feat: restyle ideas, references, hashtags, and trends widgets"
```

---

### Task 7: 설정 · 로그인 재스타일, WidgetCard 제거

**Files:**
- Modify: `src/app/(app)/[platform]/settings/page.tsx`, `src/features/settings/LanguageToggle.tsx`, `src/features/settings/WorkspaceNameForm.tsx`, `src/features/trends/ChannelSettings.tsx`, `src/features/trends/KeywordSettings.tsx`, `src/features/trends/RefetchTrends.tsx`, `src/app/login/LoginForm.tsx`
- Delete: `src/components/WidgetCard.tsx`

- [ ] **Step 1: 설정 페이지** — `WidgetCard` → `Card`, tone: 계정 `cream`, 워크스페이스·벤치마킹 채널·트렌드 검색 키워드 `dark`, 오늘 트렌드 `accent`. 제목 `<h1>`은 `mb-2 text-4xl font-extrabold tracking-tight`, 카드 목록 간격 `gap-2`.

- [ ] **Step 2: 설정 컴포넌트** — 위젯 규칙 적용.
  - `LanguageToggle`: 언어 버튼 두 개를 `className={pillClass(l === locale)}` + `data-magnetic`로 (`pillClass`는 `@/components/ui/pill-tabs`). cream 카드 위라 비활성 테두리가 `border-line text-cream`이면 안 보이므로, 이 컴포넌트에서만 비활성 버튼에 `!border-ink/30 !text-ink`를 덧붙인다.
  - `WorkspaceNameForm`: `EditableText`에 `className="border-current/25 text-base font-semibold"`.
  - `ChannelSettings`·`KeywordSettings`: 입력은 `fieldClass`, 추가 버튼 `primary`, × 는 규칙의 `IconButton`, 채널 썸네일 `rounded-full`, 그룹 제목 규칙, 칩은 `Tag`.
  - `RefetchTrends`(accent 카드): 버튼 `<Button size="sm" variant="ink" …>`, 결과 문구 `text-sm font-medium`, 실패 문구 `text-ink font-semibold`.

- [ ] **Step 3: 로그인 화면** — `src/app/login/LoginForm.tsx`의 JSX만 교체(로직 그대로). 구조:

```tsx
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[28px] bg-cream p-8 text-ink">
        <h1 className="mb-6 text-4xl font-extrabold leading-none tracking-tight">{t('title')}</h1>

        <div role="tablist" className="mb-6 flex gap-2">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              data-magnetic
              className={`${pillClass(mode === m)} ${mode === m ? '' : '!border-ink/30 !text-ink'}`}
            >
              {t(m === 'login' ? 'loginTab' : 'signupTab')}
            </button>
          ))}
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          {/* hidden mode, 이메일·비밀번호 label/input: input은 `${fieldClass} w-full`, label은 flex flex-col gap-1 text-sm font-medium */}
          {/* 에러: text-sm font-medium text-danger / 안내: text-sm font-medium opacity-80 */}
          <Button type="submit" disabled={pending} className="mt-2 w-full">
            {t(mode === 'login' ? 'submitLogin' : 'submitSignup')}
          </Button>
        </form>

        <p className="my-4 text-center text-xs uppercase tracking-widest opacity-50">{t('or')}</p>
        <Button variant="ghost" onClick={() => void continueWithGoogle()} className="w-full">
          {t('google')}
        </Button>
      </div>
    </main>
```

  주석으로 표시한 부분은 기존 요소를 그대로 두고 클래스만 바꾼다. import에 `Button`, `fieldClass`, `pillClass`를 추가한다. 로그인 화면은 `PlatformScope` 밖이라 accent는 기본 로즈다.

- [ ] **Step 4: WidgetCard 제거**

```bash
git rm src/components/WidgetCard.tsx
grep -rn "WidgetCard\|gray-[0-9]\|red-600\|green-700" src
```

Expected: 결과 없음 (남은 게 있으면 규칙대로 바꾼다)

- [ ] **Step 5: 검증과 커밋**

Run: `npm test && npm run typecheck && npm run lint && npm run build` → 통과

```bash
git add -A src
git commit -m "feat: restyle settings and login, remove WidgetCard"
```

---

### Task 8: 브라우저 검증 (컨트롤러)

개발 서버를 재시작하고 탭을 앞으로 둔 상태에서 확인한다.

- [ ] `/youtube`: 따뜻한 검정 배경, 헤더 알약 탭(YouTube 로즈 채움), 위젯 tone 배치가 목업 A와 일치
- [ ] `/instagram`: 포인트가 라벤더로 바뀜(탭·체크리스트 카드·성과 카드)
- [ ] 설정·로그인·에러 화면 톤
- [ ] 마그네틱: 탭·추가 버튼·고정 버튼에 커서를 대면 커서가 버튼 모양이 되고 버튼이 끌려옴, 입력칸·체크박스는 그대로
- [ ] 모바일 375px: 1열, 가로 스크롤 없음, 커서 없음(터치 에뮬레이션)
- [ ] 글자 대비: 크림·로즈·라벤더 위 `ink`, 다크 위 `cream`
- [ ] 콘솔·서버 에러 없음
