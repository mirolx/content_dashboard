/**
 * 최근에 추천한 영상을 두 후보 목록에서 뺀다.
 * 둘 다 비게 되면 빈 화면 대신 원래 목록을 그대로 돌려준다.
 */
export function excludeVideos<T extends { videoId: string }>(
  channel: T[],
  keyword: T[],
  exclude: Iterable<string>,
): { channel: T[]; keyword: T[] } {
  const ids = new Set(exclude)
  const fresh = {
    channel: channel.filter((x) => !ids.has(x.videoId)),
    keyword: keyword.filter((x) => !ids.has(x.videoId)),
  }
  return fresh.channel.length === 0 && fresh.keyword.length === 0 ? { channel, keyword } : fresh
}
