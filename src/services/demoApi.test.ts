import { beforeEach, describe, expect, it } from 'vitest'
import { seedSpecs } from '../../shared/spec'
import { ApiError } from './api'
import { createSpec, listSpecs, resetDemoData, updateSpecStatus } from './demoApi'

const STORAGE_KEY = 'specship:demo:v1'

const validInput = {
  acceptanceCriteria: ['Show a passing review state'],
  owner: 'Frontend',
  priority: 'High' as const,
  requirement: 'The team needs to see a complete delivery checklist.',
  title: 'Delivery checklist',
}

describe('demo api client', () => {
  beforeEach(() => {
    // Each test starts from the seed data, with no leftover browser storage.
    resetDemoData()
  })

  it('lists the seed specs with no backend involved', async () => {
    await expect(listSpecs()).resolves.toEqual(seedSpecs)
  })

  it('creates a spec and saves the updated list to localStorage', async () => {
    const spec = await createSpec(validInput)

    expect(spec.status).toBe('Backlog')

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    expect(saved).toHaveLength(seedSpecs.length + 1)
    expect(saved[0].id).toBe(spec.id)
  })

  it('rejects invalid input the same way the server does, without saving it', async () => {
    await expect(
      createSpec({ ...validInput, title: 'x', acceptanceCriteria: [] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })

    await expect(listSpecs()).resolves.toEqual(seedSpecs)
  })

  it('moves a seeded spec to a new status', async () => {
    const updated = await updateSpecStatus('spec-release-checklist', 'In progress')

    expect(updated.status).toBe('In progress')
  })

  it('rejects a status update for a spec that does not exist', async () => {
    await expect(updateSpecStatus('missing-spec', 'Review')).rejects.toBeInstanceOf(ApiError)
    await expect(updateSpecStatus('missing-spec', 'Review')).rejects.toMatchObject({
      code: 'SPEC_NOT_FOUND',
    })
  })

  it('clears saved data and restores the seed specs on reset', async () => {
    await createSpec(validInput)
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull()

    resetDemoData()

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    await expect(listSpecs()).resolves.toEqual(seedSpecs)
  })
})
