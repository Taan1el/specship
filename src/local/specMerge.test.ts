import { describe, expect, it } from 'vitest'
import type { ProductSpec } from '../../shared/spec'
import { buildMergePreview, changedFields, mergeCounts, specsToImport } from './specMerge'
import { serializeCombined, serializeSpecMarkdown } from './specMarkdown'

const base: ProductSpec = {
  id: 'spec-one',
  title: 'First spec',
  owner: 'Platform',
  status: 'Backlog',
  priority: 'Medium',
  requirement: 'The first requirement, long enough.',
  acceptanceCriteria: ['Criterion one', 'Criterion two'],
  criteriaDone: [false, false],
  updatedAt: '2026-10-01T00:00:00.000Z',
}

const file = (name: string, spec: ProductSpec) => ({ name, text: serializeSpecMarkdown(spec) })

describe('buildMergePreview', () => {
  it('marks an id that is not saved as new', () => {
    const preview = buildMergePreview([], [file('one.md', base)])
    expect(preview.items).toMatchObject([{ kind: 'new', fileName: 'one.md', spec: base }])
    expect(preview.problems).toEqual([])
  })

  it('marks identical content as unchanged, whatever the update time', () => {
    const preview = buildMergePreview([base], [file('one.md', { ...base, updatedAt: '2026-12-31T00:00:00.000Z' })])
    expect(preview.items[0].kind).toBe('unchanged')
    expect(preview.items[0].changedFields).toEqual([])
  })

  it('marks different content from a file that is not older as changed, and names the fields', () => {
    const edited = { ...base, title: 'Renamed spec', status: 'Review' as const, updatedAt: '2026-10-02T00:00:00.000Z' }
    const [item] = buildMergePreview([base], [file('one.md', edited)]).items
    expect(item.kind).toBe('changed')
    expect(item.changedFields).toEqual(['title', 'status'])
    expect(item.saved).toBe(base)
  })

  it('treats equal update times as changed', () => {
    expect(buildMergePreview([base], [file('one.md', { ...base, owner: 'Other team' })]).items[0].kind).toBe('changed')
  })

  it('marks different content as a conflict when the saved copy is newer', () => {
    const saved = { ...base, updatedAt: '2026-10-09T00:00:00.000Z' }
    const [item] = buildMergePreview([saved], [file('one.md', { ...base, requirement: 'An older requirement text.' })]).items
    expect(item.kind).toBe('conflict')
    expect(item.changedFields).toEqual(['requirement'])
  })

  it('notices ticked criteria and extra fields as changes', () => {
    expect(changedFields({ ...base, criteriaDone: [true, false] }, base)).toEqual(['ticked criteria'])
    expect(changedFields({ ...base, extra: { team: 'Growth' } }, base)).toEqual(['extra fields'])
    expect(changedFields({ ...base, criteriaDone: undefined }, base)).toEqual([])
  })

  it('reports files that cannot be read with their line, and keeps the rest', () => {
    const broken = { name: 'broken.md', text: serializeSpecMarkdown(base).replace('status: Backlog', 'status: Later') }
    const preview = buildMergePreview([], [broken, file('two.md', { ...base, id: 'spec-two' })])
    expect(preview.problems).toEqual([{ fileName: 'broken.md', message: expect.stringMatching(/^Line 4: status must be one of/) }])
    expect(preview.items.map((item) => item.spec.id)).toEqual(['spec-two'])
  })

  it('leaves out a repeated id and says which file had it first', () => {
    const preview = buildMergePreview([], [file('a.md', base), file('b.md', { ...base, title: 'Same id again' })])
    expect(preview.items).toHaveLength(1)
    expect(preview.problems[0]).toEqual({ fileName: 'b.md', message: expect.stringContaining('already used by a.md') })
  })

  it('reads every spec in a combined file', () => {
    const text = serializeCombined([base, { ...base, id: 'spec-two' }])
    expect(buildMergePreview([], [{ name: 'all.md', text }]).items.map((item) => item.spec.id)).toEqual(['spec-one', 'spec-two'])
  })

  it('does not change the saved specs', () => {
    const saved = [{ ...base }]
    buildMergePreview(saved, [file('one.md', { ...base, title: 'Changed title' })])
    expect(saved).toEqual([base])
  })
})

describe('applying a preview', () => {
  const saved: ProductSpec[] = [
    { ...base, id: 'same' },
    { ...base, id: 'older', updatedAt: '2026-10-01T00:00:00.000Z' },
    { ...base, id: 'newer', updatedAt: '2026-10-09T00:00:00.000Z' },
  ]
  const preview = buildMergePreview(saved, [
    file('new.md', { ...base, id: 'fresh' }),
    file('same.md', { ...base, id: 'same' }),
    file('older.md', { ...base, id: 'older', title: 'Updated in file', updatedAt: '2026-10-05T00:00:00.000Z' }),
    file('newer.md', { ...base, id: 'newer', title: 'Stale in file' }),
  ])

  it('counts what an import would do', () => {
    expect(mergeCounts(preview, new Set())).toEqual({ added: 1, replaced: 1, keptSaved: 1, unchanged: 1 })
    expect(mergeCounts(preview, new Set(['newer']))).toEqual({ added: 1, replaced: 2, keptSaved: 0, unchanged: 1 })
  })

  it('keeps the saved copy of a conflict unless it is chosen', () => {
    expect(specsToImport(preview, new Set()).map((spec) => spec.id)).toEqual(['fresh', 'older'])
    expect(specsToImport(preview, new Set(['newer'])).map((spec) => spec.id)).toEqual(['fresh', 'older', 'newer'])
  })

  it('keeps the update time written in the file', () => {
    expect(specsToImport(preview, new Set()).find((spec) => spec.id === 'older')?.updatedAt).toBe('2026-10-05T00:00:00.000Z')
  })
})
