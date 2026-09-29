import { describe, expect, it } from 'vitest'
import { parseKeywordList } from './parseKeywordList'

describe('parseKeywordList', () => {
  it('splits on commas and new lines and tidies spaces', () => {
    expect(parseKeywordList('glow up,  skincare   routine\nthat girl\r\n, girl talk ')).toEqual([
      'glow up',
      'skincare routine',
      'that girl',
      'girl talk',
    ])
  })

  it('drops empty entries and entries over 60 characters', () => {
    expect(parseKeywordList(`,,\n  \n${'x'.repeat(61)}\nok`)).toEqual(['ok'])
  })

  it('keeps the first of case-insensitive duplicates', () => {
    expect(parseKeywordList('Glow Up, glow up, GLOW UP, mindset')).toEqual(['Glow Up', 'mindset'])
  })

  it('strips | and " so they cannot break the search query', () => {
    expect(parseKeywordList('say "yes"|no, a|b')).toEqual(['say yes no', 'a b'])
  })
})
