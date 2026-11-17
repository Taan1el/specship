import { describe, expect, it, vi } from 'vitest'
import { createMemorySpecStore, slugify } from './specStore.js'
import { seedSpecs } from './spec.js'

describe('slugify', () => {
  it('lowercases and hyphenates non-alphanumeric characters', () => {
    expect(slugify('Mobile Release Notes!')).toBe('mobile-release-notes')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --Edge Case--  ')).toBe('edge-case')
  })
})

describe('createMemorySpecStore', () => {
  const validInput = {
    acceptanceCriteria: ['Show a passing review state'],
    owner: 'Frontend',
    priority: 'High' as const,
    requirement: 'The team needs to see a complete delivery checklist.',
    title: 'Delivery checklist',
  }

  it('starts with the provided seed data', async () => {
    const store = createMemorySpecStore(seedSpecs)
    await expect(store.list()).resolves.toEqual(seedSpecs)
  })

  it('defaults to the shared seed data when none is provided', async () => {
    const store = createMemorySpecStore()
    await expect(store.list()).resolves.toEqual(seedSpecs)
  })

  it('creates a spec in Backlog status with a slugified id', async () => {
    const store = createMemorySpecStore([])
    const spec = await store.create(validInput)

    expect(spec.status).toBe('Backlog')
    expect(spec.id).toMatch(/^delivery-checklist-\d+$/)
    expect(spec.title).toBe(validInput.title)
  })

  it('prepends new specs so the newest sorts first', async () => {
    const store = createMemorySpecStore([])
    const first = await store.create(validInput)
    const second = await store.create({ ...validInput, title: 'Second spec' })

    await expect(store.list()).resolves.toEqual([second, first])
  })

  it('updates the status and timestamp of an existing spec', async () => {
    vi.useFakeTimers()

    try {
      const store = createMemorySpecStore([])
      const created = await store.create(validInput)

      vi.advanceTimersByTime(1000)
      const updated = await store.updateStatus(created.id, 'Review')

      expect(updated?.status).toBe('Review')
      expect(updated?.id).toBe(created.id)
      expect(updated?.updatedAt).not.toBe(created.updatedAt)
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves other specs untouched when updating one status', async () => {
    const store = createMemorySpecStore([])
    const first = await store.create(validInput)
    const second = await store.create({ ...validInput, title: 'Second spec' })

    await store.updateStatus(second.id, 'Shipped')

    const specs = await store.list()
    const unchanged = specs.find((spec) => spec.id === first.id)
    expect(unchanged?.status).toBe('Backlog')
  })

  it('returns null when updating a spec that does not exist', async () => {
    const store = createMemorySpecStore([])
    await expect(store.updateStatus('missing-id', 'Review')).resolves.toBeNull()
  })
})

describe('local store editing', () => {
  const input = {
    acceptanceCriteria: ['First criterion', 'Second criterion'],
    owner: 'Frontend',
    priority: 'High' as const,
    requirement: 'The team needs to see a complete delivery checklist.',
    title: 'Delivery checklist',
  }

  it('updates fields, stamps the time and keeps the ticked list as long as the criteria', async () => {
    vi.useFakeTimers()

    try {
      const store = createMemorySpecStore([])
      const created = await store.create(input)

      vi.advanceTimersByTime(1000)
      const updated = await store.update(created.id, {
        acceptanceCriteria: ['Only criterion'],
        criteriaDone: [true, true, true],
        title: 'Renamed checklist',
      })

      expect(updated).toMatchObject({ id: created.id, title: 'Renamed checklist', criteriaDone: [true], status: 'Backlog' })
      expect(updated?.updatedAt).not.toBe(created.updatedAt)
      await expect(store.list()).resolves.toEqual([updated])
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns null when updating an unknown id', async () => {
    const store = createMemorySpecStore([])
    await expect(store.update('missing', { title: 'Nope nope' })).resolves.toBeNull()
  })

  it('removes one spec and reports whether it existed', async () => {
    const store = createMemorySpecStore([])
    const first = await store.create(input)
    const second = await store.create({ ...input, title: 'Second spec' })

    await expect(store.remove(first.id)).resolves.toBe(true)
    await expect(store.remove(first.id)).resolves.toBe(false)
    await expect(store.list()).resolves.toEqual([second])
  })

  it('replaces specs with the same id, puts new ones first and keeps the given update time', async () => {
    const store = createMemorySpecStore(seedSpecs)
    const edited = { ...seedSpecs[1], title: 'Edited in a file', updatedAt: '2026-01-01T00:00:00.000Z' }
    const added = { ...seedSpecs[0], id: 'brand-new' }

    await store.upsertMany([edited, added])

    const specs = await store.list()
    expect(specs.map((spec) => spec.id)).toEqual(['brand-new', seedSpecs[0].id, seedSpecs[1].id, seedSpecs[2].id])
    expect(specs[2]).toEqual(edited)
  })
})
