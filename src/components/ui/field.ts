/** 입력칸·텍스트 영역 공통 클래스. 카드 글자색(currentColor)을 따라가므로 모든 tone에서 보인다. */
export const fieldClass =
  'min-w-0 rounded-xl border border-current/25 bg-transparent px-3 py-2 text-sm placeholder:text-current/45 focus:border-current/70 focus:outline-none'

/** select는 드롭다운 목록이 흰 배경이라 option 글자를 ink로 고정한다. */
export const selectClass = `${fieldClass} [&>option]:text-ink`
