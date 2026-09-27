'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/**
 * schedule(value)가 마지막으로 호출되고 delay(ms) 뒤에 save(value)를 한 번 실행한다.
 * flush()는 기다리지 않고 바로 저장한다(blur, 언마운트 시).
 */
export function useAutosave(save: (value: string) => Promise<boolean>, delay = 800) {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pending = useRef<string | null>(null)
  const saveRef = useRef(save)

  useEffect(() => {
    saveRef.current = save
  })

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const value = pending.current
    if (value === null) return
    pending.current = null
    setStatus('saving')
    const ok = await saveRef.current(value)
    setStatus(pending.current !== null ? 'pending' : ok ? 'saved' : 'error')
  }, [])

  const schedule = useCallback(
    (value: string) => {
      pending.current = value
      setStatus('pending')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), delay)
    },
    [delay, flush],
  )

  useEffect(
    () => () => {
      void flush()
    },
    [flush],
  )

  return { status, schedule, flush }
}
