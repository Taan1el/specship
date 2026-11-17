import { describe, expect, it } from 'vitest'
import { seedSpecs } from './spec.js'
import { editSpecSchema, hasCriteriaHeadingLine, validateStoredSpec } from './validation.js'

describe('validateStoredSpec', () => {
  it('accepts a seed spec and fills in a full ticked list', () => {
    const result = validateStoredSpec(seedSpecs[0])
    expect(result).toEqual({ ok: true, spec: { ...seedSpecs[0], criteriaDone: [false, false, false] } })
  })

  it('keeps ticked criteria and extra fields', () => {
    const result = validateStoredSpec({ ...seedSpecs[0], criteriaDone: [true], extra: { team: 'Growth' } })
    expect(result).toMatchObject({ ok: true, spec: { criteriaDone: [true, false, false], extra: { team: 'Growth' } } })
  })

  it.each([
    [null, ''],
    ['text', ''],
    [{ ...seedSpecs[0], status: 'Done' }, 'status'],
    [{ ...seedSpecs[0], title: 'x' }, 'title'],
    [{ ...seedSpecs[0], acceptanceCriteria: [] }, 'acceptanceCriteria'],
    [{ ...seedSpecs[0], acceptanceCriteria: [3] }, 'acceptanceCriteria.0'],
    [{ ...seedSpecs[0], updatedAt: 'not a date' }, 'updatedAt'],
    [{ ...seedSpecs[0], id: '../up' }, 'id'],
    [{ ...seedSpecs[0], requirement: 'Some text here.\n## Acceptance criteria\nMore' }, 'requirement'],
  ])('rejects %j and names the field', (value, field) => {
    const result = validateStoredSpec(value)
    expect(result.ok).toBe(false)
    if (!result.ok && field) expect(result.message.startsWith(`${field}: `)).toBe(true)
  })
})

describe('editSpecSchema', () => {
  const draft = {
    acceptanceCriteria: ['One criterion'],
    owner: '',
    priority: 'Low' as const,
    requirement: 'A requirement that is long enough.',
    status: 'Review' as const,
    title: 'A title',
  }

  it('allows an empty owner but not a one character owner', () => {
    expect(editSpecSchema.safeParse(draft).success).toBe(true)
    expect(editSpecSchema.safeParse({ ...draft, owner: 'X' }).success).toBe(false)
  })

  it('trims fields before checking them', () => {
    const result = editSpecSchema.parse({ ...draft, title: '  A title  ' })
    expect(result.title).toBe('A title')
    expect(editSpecSchema.safeParse({ ...draft, title: '   ' }).success).toBe(false)
  })

  it('refuses a requirement line that would start the criteria section', () => {
    expect(hasCriteriaHeadingLine('a\r\n## Acceptance criteria\r\nb')).toBe(true)
    expect(editSpecSchema.safeParse({ ...draft, requirement: 'Some text.\n## Acceptance criteria' }).success).toBe(false)
  })
})
