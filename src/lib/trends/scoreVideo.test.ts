import { describe, expect, it } from 'vitest'
import type { VideoDetail } from '@/lib/youtube/api'
import { byRelevanceThenViews, scoreAll, scoreVideo } from './scoreVideo'

const video = (title: string, tags: string[] = [], description = '') => ({ title, tags, description })

describe('scoreVideo', () => {
  it('gives 2 points per keyword in the title, case-insensitively', () => {
    expect(scoreVideo(video('My GLOW UP and That Girl routine'), ['glow up', 'that girl'])).toEqual({
      relevance: 4,
      matched: ['glow up', 'that girl'],
    })
  })

  it('gives 1 point for tags or description when not in the title', () => {
    expect(scoreVideo(video('Sunday vlog', ['self care'], 'talking about mindset today'), ['self care', 'mindset'])).toEqual({
      relevance: 2,
      matched: ['self care', 'mindset'],
    })
  })

  it('counts a keyword once, preferring the title', () => {
    expect(scoreVideo(video('mindset reset', ['mindset'], 'mindset'), ['mindset'])).toEqual({
      relevance: 2,
      matched: ['mindset'],
    })
  })

  it('lists title matches before tag/description matches', () => {
    expect(scoreVideo(video('habits that stick', ['glow up']), ['glow up', 'habits']).matched).toEqual([
      'habits',
      'glow up',
    ])
  })

  it('matches whole phrases only', () => {
    expect(scoreVideo(video('glowing up slowly'), ['glow up']).relevance).toBe(0)
    expect(scoreVideo(video('selfcare sunday'), ['self care']).relevance).toBe(0)
    expect(scoreVideo(video('glow up: part 2'), ['glow up']).relevance).toBe(2)
  })

  it('escapes regex characters in keywords', () => {
    expect(scoreVideo(video('how to be confident (really)'), ['how to be confident (really)']).relevance).toBe(2)
  })
})

describe('scoreAll / byRelevanceThenViews', () => {
  const v = (id: string, title: string, viewCount: number): VideoDetail => ({
    videoId: id,
    title,
    channelId: 'UC',
    channelTitle: 'C',
    viewCount,
    thumbnailUrl: '',
    durationSec: 600,
    categoryId: '22',
    publishedAt: '2026-09-25T00:00:00Z',
    tags: [],
    description: '',
  })

  it('sorts by relevance first, then by views', () => {
    const scored = scoreAll([v('a', 'random', 1000), v('b', 'glow up', 10), v('c', 'glow up', 50)], ['glow up'])
    expect(scored.sort(byRelevanceThenViews).map((x) => x.videoId)).toEqual(['c', 'b', 'a'])
  })
})
