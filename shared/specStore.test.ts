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
