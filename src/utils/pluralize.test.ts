import { describe, expect, it } from 'vitest'
import { formatCount, pluralize } from './pluralize'

describe('pluralize', () => {
  it('uses the singular form for exactly 1', () => {
    expect(pluralize(1, 'spec')).toBe('spec')
    expect(pluralize(-1, 'spec')).toBe('spec')
  })

  it('uses the regular plural form (adds "s") for any other count', () => {
    expect(pluralize(0, 'spec')).toBe('specs')
    expect(pluralize(2, 'spec')).toBe('specs')
    expect(pluralize(30, 'criterion', 'criteria')).toBe('criteria')
  })

  it('uses an explicit irregular plural when given one', () => {
    expect(pluralize(1, 'criterion', 'criteria')).toBe('criterion')
    expect(pluralize(2, 'criterion', 'criteria')).toBe('criteria')
    expect(pluralize(0, 'criterion', 'criteria')).toBe('criteria')
  })
})

describe('formatCount', () => {
  it('joins the count and the correctly pluralized noun', () => {
    expect(formatCount(1, 'spec')).toBe('1 spec')
    expect(formatCount(2, 'spec')).toBe('2 specs')
    expect(formatCount(0, 'spec')).toBe('0 specs')
    expect(formatCount(1, 'criterion', 'criteria')).toBe('1 criterion')
    expect(formatCount(5, 'criterion', 'criteria')).toBe('5 criteria')
  })
})
