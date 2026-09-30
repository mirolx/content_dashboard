import { z } from 'zod'

export const textSchema = z.string().trim().min(1).max(500)

const httpUrl = z.url({ protocol: /^https?$/ })

/** 빈 값은 null, 값이 있으면 http(s) URL이어야 한다. */
export const optionalUrlSchema = z
  .string()
  .trim()
  .pipe(z.union([z.literal(''), httpUrl]))
  .transform((v) => (v === '' ? null : v))

/** https 이고 호스트가 notion.so / notion.site (또는 그 하위 도메인)인 주소 */
const notionUrl = z.url({ protocol: /^https$/, hostname: /^([a-z0-9-]+\.)*notion\.(so|site)$/i })

/** 칸반 카드의 Notion 링크. 빈 값은 null(연결 해제), 값이 있으면 Notion 페이지 주소여야 한다. */
export const notionUrlSchema = z
  .string()
  .trim()
  .pipe(z.union([z.literal(''), notionUrl]))
  .transform((v) => (v === '' ? null : v))

/** "#day in my life" → "dayinmylife" */
export function normalizeTag(input: string): string {
  return input.trim().replace(/^#+/, '').replace(/\s+/g, '')
}
