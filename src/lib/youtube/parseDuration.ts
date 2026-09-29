const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/

/** YouTube의 ISO 8601 길이("PT12M3S")를 초로 바꾼다. 해석할 수 없으면 0. */
export function parseDuration(iso: string): number {
  const m = ISO_DURATION.exec(iso)
  if (!m || iso === 'P' || iso.endsWith('T')) return 0
  const [, d, h, min, s] = m.map((part) => Number(part ?? 0))
  return d * 86400 + h * 3600 + min * 60 + s
}
