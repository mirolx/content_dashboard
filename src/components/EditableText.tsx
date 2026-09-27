'use client'

import { useState } from 'react'
import { useAutosave } from '@/lib/realtime/useAutosave'

/**
 * 제자리 수정 입력칸. 입력을 멈추면 800ms 뒤 onSave, blur 시 즉시 저장한다.
 * 편집 중에는 바깥(실시간) 값으로 덮어쓰지 않는다.
 */
export function EditableText({
  value,
  onSave,
  label,
  className = '',
}: {
  value: string
  onSave: (value: string) => Promise<boolean>
  label: string
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  const [synced, setSynced] = useState(value)
  const [focused, setFocused] = useState(false)
  const { schedule, flush } = useAutosave(async (v) => {
    const text = v.trim()
    return text ? onSave(text) : false
  })

  // 편집 중이 아닐 때 바깥 값이 바뀌면 따라간다.
  if (!focused && value !== synced) {
    setSynced(value)
    setDraft(value)
  }

  return (
    <input
      aria-label={label}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        schedule(e.target.value)
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        void flush()
        if (!draft.trim()) setDraft(value)
      }}
      className={`min-w-0 rounded border border-transparent px-1 hover:border-gray-300 focus:border-gray-400 focus:outline-none ${className}`}
    />
  )
}
