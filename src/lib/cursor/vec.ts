/** 마그네틱 커서용 2D 벡터. 입력을 바꾸지 않고 새 값을 돌려준다. */
export type Vec = { x: number; y: number }

export const vec = (x = 0, y = 0): Vec => ({ x, y })

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function length(v: Vec): number {
  return Math.hypot(v.x, v.y)
}
