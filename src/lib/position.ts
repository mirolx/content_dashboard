/** 목록 맨 끝에 놓일 position */
export function positionAfter(positions: number[]): number {
  return positions.length === 0 ? 1 : Math.max(...positions) + 1
}

/** 두 이웃 사이에 놓일 position. 다른 행의 position은 바꾸지 않는다. */
export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return 1
  if (before === undefined) return after! - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}
