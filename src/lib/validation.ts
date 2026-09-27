import { z } from 'zod'

export const textSchema = z.string().trim().min(1).max(500)

const httpUrl = z.url({ protocol: /^https?$/ })

/** 빈 값은 null, 값이 있으면 http(s) URL이어야 한다. */
export const optionalUrlSchema = z
  .string()
  .trim()
  .pipe(z.union([z.literal(''), httpUrl]))
  .transform((v) => (v === '' ? null : v))

/** "#day in my life" → "dayinmylife" */
export function normalizeTag(input: string): string {
  return input.trim().replace(/^#+/, '').replace(/\s+/g, '')
}
