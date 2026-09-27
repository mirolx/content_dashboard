const seoulDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 한국 시간 기준 날짜를 "YYYY-MM-DD"로 반환한다. */
export function seoulDateString(date: Date): string {
  return seoulDate.format(date)
}
