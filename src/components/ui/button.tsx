import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'ink' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-ink hover:brightness-105',
  ink: 'bg-ink text-cream hover:bg-ink/90',
  ghost: 'border border-current/30 hover:border-current/70',
  danger: 'opacity-70 hover:opacity-100 hover:text-danger hover:bg-danger/10',
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
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
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
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/20 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current hover:border-current/60 disabled:opacity-30 ${className}`}
    >
      {children}
    </button>
  )
}
