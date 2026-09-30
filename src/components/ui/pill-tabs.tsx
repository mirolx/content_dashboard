import Link from 'next/link'

/** 알약 탭 모양. 선택된 탭은 accent로 채우고 나머지는 테두리만. */
export function pillClass(active: boolean) {
  return `inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
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
