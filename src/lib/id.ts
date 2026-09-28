/**
 * `crypto.randomUUID()`는 보안 컨텍스트(https 또는 localhost)에서만 존재한다.
 * `http://<LAN IP>:3000`처럼 폰으로 테스트할 때는 정의되어 있지 않으므로,
 * 그런 경우 `crypto.getRandomValues`로 직접 RFC 4122 v4 UUID를 만든다.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10xx

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-')
}
