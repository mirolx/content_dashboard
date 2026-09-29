const MAX_LENGTH = 60

/** 쉼표·줄바꿈으로 구분된 붙여넣기 텍스트를 키워드 목록으로 바꾼다. 대소문자만 다른 중복은 첫 번째만 남긴다. */
export function parseKeywordList(text: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of text.split(/[,\r\n]+/)) {
    const keyword = raw.replace(/[|"]/g, ' ').trim().replace(/\s+/g, ' ')
    if (!keyword || keyword.length > MAX_LENGTH) continue
    const key = keyword.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(keyword)
  }
  return result
}
