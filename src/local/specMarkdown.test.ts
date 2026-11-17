import { describe, expect, it } from 'vitest'
import { seedSpecs, type ProductSpec } from '../../shared/spec'
import {
  combinedSeparator,
  parseSpecDocuments,
  parseSpecMarkdown,
  serializeCombined,
  serializeSpecMarkdown,
  specFileName,
  SpecMarkdownError,
} from './specMarkdown'

const spec: ProductSpec = {
  id: 'spec-login-flow',
  title: 'Login flow',
  owner: 'Platform',
  status: 'Review',
  priority: 'High',
  requirement: 'People must sign in with a magic link.\n\nThe link expires after ten minutes.',
  acceptanceCriteria: ['Send the link by email', 'Expire the link after ten minutes', 'Show a clear error for an expired link'],
  criteriaDone: [true, false, true],
  updatedAt: '2026-10-05T09:30:00.000Z',
}

function errorOf(text: string): SpecMarkdownError {
  try {
    parseSpecMarkdown(text)
  } catch (error) {
    if (error instanceof SpecMarkdownError) return error
    throw error
  }
  throw new Error('Expected the text to be rejected')
}

const valid = serializeSpecMarkdown(spec)

describe('serializeSpecMarkdown', () => {
  it('writes front matter, the requirement and a task list', () => {
    expect(valid).toBe(
      [
        '---',
        'id: spec-login-flow',
        'title: Login flow',
        'status: Review',
        'priority: High',
        'owner: Platform',
        'updated: 2026-10-05T09:30:00.000Z',
        '---',
        '',
        'People must sign in with a magic link.',
        '',
        'The link expires after ten minutes.',
        '',
        '## Acceptance criteria',
        '',
        '- [x] Send the link by email',
        '- [ ] Expire the link after ten minutes',
        '- [x] Show a clear error for an expired link',
        '',
      ].join('\n'),
    )
  })

  it('leaves the owner out when there is none', () => {
    expect(serializeSpecMarkdown({ ...spec, owner: '' })).not.toContain('owner:')
  })

  it('treats a missing ticked list as nothing ticked', () => {
    const text = serializeSpecMarkdown({ ...spec, criteriaDone: undefined })
    expect(text).toContain('- [ ] Send the link by email')
    expect(text).not.toContain('[x]')
  })

  it('quotes values a plain scalar could not hold', () => {
    const tricky = { ...spec, title: 'Fix: the "#1" bug', owner: ' Ops ', id: '2026' }
    const text = serializeSpecMarkdown(tricky)
    expect(text).toContain('title: "Fix: the \\"#1\\" bug"')
    expect(text).toContain('owner: " Ops "')
    expect(text).toContain('id: "2026"')
  })

  it('refuses a requirement that contains the criteria heading', () => {
    expect(() => serializeSpecMarkdown({ ...spec, requirement: 'Intro text here.\n## Acceptance criteria\nMore text' })).toThrow(SpecMarkdownError)
  })

  it('keeps each criterion on one line', () => {
    const text = serializeSpecMarkdown({ ...spec, acceptanceCriteria: ['First line\nsecond line'], criteriaDone: [false] })
    expect(text).toContain('- [ ] First line second line')
  })
})

describe('parseSpecMarkdown round trip', () => {
  it('reads back what it wrote', () => {
    expect(parseSpecMarkdown(valid)).toEqual(spec)
  })

  it('round trips every seed spec to identical text', () => {
    for (const seed of seedSpecs) {
      const text = serializeSpecMarkdown(seed)
      const parsed = parseSpecMarkdown(text)
      expect(parsed).toEqual({ ...seed, criteriaDone: seed.acceptanceCriteria.map(() => false) })
      expect(serializeSpecMarkdown(parsed)).toBe(text)
    }
  })

  it('round trips awkward text and unicode', () => {
    const awkward: ProductSpec = {
      ...spec,
      id: 'a.b_c-1',
      title: "Ünïcode ✓ title: with 'quotes' and # hash",
      owner: 'Équipe: Données',
      requirement: 'A line with --- dashes in it.\n\n---\n\nAnd a second block with "quotes" and \\ backslashes.',
      acceptanceCriteria: ['Works with `code`, [links](x) and - dashes'],
      criteriaDone: [true],
    }
    const parsed = parseSpecMarkdown(serializeSpecMarkdown(awkward))
    expect(parsed).toEqual(awkward)
  })

  it('tolerates CRLF line endings', () => {
    expect(parseSpecMarkdown(valid.replaceAll('\n', '\r\n'))).toEqual(spec)
  })

  it('tolerates a byte order mark', () => {
    expect(parseSpecMarkdown(`﻿${valid}`)).toEqual(spec)
    expect(parseSpecMarkdown(`﻿${valid.replaceAll('\n', '\r\n')}`)).toEqual(spec)
  })

  it('accepts an upper case X and a date without a time', () => {
    const text = valid.replace('- [x] Send', '- [X] Send').replace('2026-10-05T09:30:00.000Z', '2026-10-05')
    const parsed = parseSpecMarkdown(text)
    expect(parsed.criteriaDone?.[0]).toBe(true)
    expect(parsed.updatedAt).toBe('2026-10-05T00:00:00.000Z')
  })

  it('reads a time without a zone as UTC', () => {
    expect(parseSpecMarkdown(valid.replace('2026-10-05T09:30:00.000Z', '2026-10-05T09:30')).updatedAt).toBe('2026-10-05T09:30:00.000Z')
  })

  it('defaults the priority to Medium and the owner to empty', () => {
    const text = valid.replace('priority: High\n', '').replace('owner: Platform\n', '')
    const parsed = parseSpecMarkdown(text)
    expect(parsed.priority).toBe('Medium')
    expect(parsed.owner).toBe('')
  })

  it('reads single quoted values and skips comment lines', () => {
    const text = valid.replace('title: Login flow', "# a comment\ntitle: 'It''s a flow'")
    expect(parseSpecMarkdown(text).title).toBe("It's a flow")
  })
})

describe('unknown front matter fields', () => {
  const withExtra = valid.replace('---\n\nPeople', 'team: Growth\nlabels: "a, b"\n---\n\nPeople')

  it('keeps them in order and writes them back', () => {
    const parsed = parseSpecMarkdown(withExtra)
    expect(parsed.extra).toEqual({ team: 'Growth', labels: 'a, b' })
    const again = serializeSpecMarkdown(parsed)
    expect(again).toContain('team: Growth\nlabels: a, b\n---')
    expect(parseSpecMarkdown(again)).toEqual(parsed)
  })

  it('has no extra property when there are none', () => {
    expect(parseSpecMarkdown(valid)).not.toHaveProperty('extra')
  })
})

describe('front matter errors', () => {
  it('requires the opening line', () => {
    const error = errorOf('# Title\n\nSome text')
    expect(error.line).toBe(1)
    expect(error.message).toMatch(/^Line 1: A spec file starts with/)
  })

  it('reports an unclosed block', () => {
    const error = errorOf('---\nid: a\ntitle: Some title\n')
    expect(error.line).toBe(1)
    expect(error.message).toContain('not closed')
  })

  it('reports a line that is not key and value, with its number', () => {
    const error = errorOf(valid.replace('title: Login flow', 'title Login flow'))
    expect(error.line).toBe(3)
    expect(error.message).toContain('Expected "key: value"')
  })

  it('reports a duplicate key on the second line', () => {
    const error = errorOf(valid.replace('priority: High', 'title: Again'))
    expect(error.line).toBe(5)
    expect(error.message).toContain('"title" appears twice')
  })

  it('rejects nested or indented values', () => {
    const error = errorOf(valid.replace('owner: Platform', 'owner:\n  - Platform'))
    expect(error.line).toBe(7)
    expect(error.message).toContain('Indented lines')
  })

  it('names the missing required field and where the block ends', () => {
    const error = errorOf(valid.replace('id: spec-login-flow\n', ''))
    expect(error.message).toBe('Line 7: The front matter is missing the required field "id"')
  })

  it('rejects an unknown status and lists the valid ones', () => {
    const error = errorOf(valid.replace('status: Review', 'status: Done'))
    expect(error.line).toBe(4)
    expect(error.message).toContain('Backlog, In progress, Review, Shipped')
    expect(error.message).toContain('"Done"')
  })

  it('rejects an unknown priority', () => {
    expect(errorOf(valid.replace('priority: High', 'priority: Urgent')).line).toBe(5)
  })

  it('rejects dates that do not exist or are not dates', () => {
    expect(errorOf(valid.replace('2026-10-05T09:30:00.000Z', '2026-02-31')).line).toBe(7)
    expect(errorOf(valid.replace('2026-10-05T09:30:00.000Z', 'yesterday')).message).toContain('updated must be a date')
  })

  it('rejects ids that cannot be a file name', () => {
    expect(errorOf(valid.replace('id: spec-login-flow', 'id: ../escape')).line).toBe(2)
  })

  it('rejects a title or owner outside the limits', () => {
    expect(errorOf(valid.replace('title: Login flow', 'title: Ab')).message).toContain('title must be 3 to 200')
    expect(errorOf(valid.replace('owner: Platform', 'owner: X')).message).toContain('owner must be 2 to 100')
  })

  it('reports an unclosed quote', () => {
    const error = errorOf(valid.replace('title: Login flow', 'title: "Login flow'))
    expect(error.line).toBe(3)
    expect(error.message).toContain('not valid')
  })
})

describe('body errors', () => {
  it('reports a missing criteria section at the end of the file', () => {
    const text = '---\nid: a\ntitle: Some title\nstatus: Backlog\nupdated: 2026-10-05\n---\n\nA long enough requirement.\n'
    const error = errorOf(text)
    expect(error.message).toContain('"## Acceptance criteria" section is missing')
    expect(error.line).toBe(8)
  })

  it('rejects a requirement that is missing or too short', () => {
    const error = errorOf(valid.replace(/---\n\nPeople[\s\S]*?\n\n## Acc/, '---\n\n## Acc'))
    expect(error.line).toBe(10)
    expect(error.message).toContain('requirement before')
  })

  it('rejects a second criteria section', () => {
    const error = errorOf(`${valid}\n## Acceptance criteria\n\n- [ ] More\n`)
    expect(error.message).toContain('appears twice')
    expect(error.line).toBe(20)
  })

  it('rejects an empty criteria section', () => {
    const error = errorOf(valid.slice(0, valid.indexOf('- [x]')))
    expect(error.message).toContain('at least one item')
    expect(error.line).toBe(14)
  })

  it('rejects a line in the criteria section that is not a task', () => {
    const error = errorOf(`${valid}\nSome trailing notes\n`)
    expect(error.line).toBe(20)
    expect(error.message).toContain('Expected a task list item')
  })

  it('rejects a task with no text', () => {
    expect(errorOf(valid.replace('- [ ] Expire the link after ten minutes', '- [ ]')).line).toBe(17)
  })

  it('rejects more than 25 criteria and a criterion that is too long', () => {
    const many = Array.from({ length: 26 }, (_, index) => `- [ ] Item ${index}`).join('\n')
    expect(errorOf(`${valid.slice(0, valid.indexOf('- [x]'))}${many}\n`).message).toContain('at most 25')
    expect(errorOf(`${valid}- [ ] ${'x'.repeat(501)}\n`).message).toContain('at most 500')
  })
})

describe('combined files', () => {
  const other: ProductSpec = { ...spec, id: 'spec-other', title: 'Other spec', criteriaDone: [false, false, false] }

  it('splits on the separator line and reads every document', () => {
    const combined = serializeCombined([spec, other])
    expect(combined).toContain(combinedSeparator)
    const documents = parseSpecDocuments(combined)
    expect(documents).toEqual([
      { ok: true, spec },
      { ok: true, spec: other },
    ])
  })

  it('reads a single document the same way', () => {
    expect(parseSpecDocuments(valid)).toEqual([{ ok: true, spec }])
  })

  it('reports an error with its line counted from the top of the combined file', () => {
    const broken = other.id === 'spec-other' ? serializeSpecMarkdown(other).replace('status: Review', 'status: Nope') : ''
    const combined = `${valid}\n${combinedSeparator}\n\n${broken}`
    const offset = combined.split('\n').findIndex((line) => line.startsWith('status: Nope')) + 1
    const documents = parseSpecDocuments(combined)
    expect(documents[0].ok).toBe(true)
    expect(documents[1]).toMatchObject({ ok: false, line: offset })
    expect(documents[1].ok === false && documents[1].message).toContain(`Line ${offset}:`)
  })

  it('reports an empty file', () => {
    expect(parseSpecDocuments('  \n')).toEqual([{ ok: false, message: 'The file is empty', line: undefined }])
  })
})

describe('specFileName', () => {
  it('uses the id with an .md extension', () => {
    expect(specFileName(spec)).toBe('spec-login-flow.md')
  })
})
