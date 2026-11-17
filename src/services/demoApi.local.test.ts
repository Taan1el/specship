import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { seedSpecs, type ProductSpec } from '../../shared/spec'

const STORAGE_KEY = 'specship:demo:v1'

const validInput = {
  acceptanceCriteria: ['Show a passing review state'],
  owner: 'Frontend',
  priority: 'High' as const,
  requirement: 'The team needs to see a complete delivery checklist.',
  title: 'Delivery checklist',
}

const legacy = { ...seedSpecs[0] }

async function loadModules() {
  const demo = await import('./demoApi')
  const workspace = await import('../local/specWorkspace')
  return { demo, workspace }
}

beforeEach(() => {
  vi.resetModules()
  window.localStorage.clear()
  vi.stubGlobal('indexedDB', new IDBFactory())
})

describe('reading saved sample data', () => {
  it('accepts specs saved by the first version and gives them a ticked list', async () => {
    const { demo } = await loadModules()
    const result = demo.readSampleSpecs(JSON.stringify([legacy]))
    expect(result.notice).toBe('')
    expect(result.specs).toEqual([{ ...legacy, criteriaDone: [false, false, false] }])
  })

  it('leaves out specs that fail validation and says which and why', async () => {
    const { demo } = await loadModules()
    const broken = [legacy, { ...legacy, id: 'bad-status', status: 'Done' }, { ...legacy, id: 'bad-title', title: '' }, 'text', null]
    const result = demo.readSampleSpecs(JSON.stringify(broken))
    expect(result.specs).toEqual([{ ...legacy, criteriaDone: [false, false, false] }])
    expect(result.notice).toContain('4 saved sample specs could not be read and were left out')
    expect(result.notice).toContain('spec 2: status')
    expect(result.notice).toContain('and 2 more')
  })

  it('leaves out a spec whose id repeats', async () => {
    const { demo } = await loadModules()
    const result = demo.readSampleSpecs(JSON.stringify([legacy, legacy]))
    expect(result.specs).toHaveLength(1)
    expect(result.notice).toContain('1 saved sample spec could not be read and was left out')
  })

  it('falls back to the seed specs for text that is not JSON, not a list, or only bad entries', async () => {
    const { demo } = await loadModules()
    expect(demo.readSampleSpecs(null)).toEqual({ specs: undefined, notice: '' })
    expect(demo.readSampleSpecs('{oops')).toMatchObject({ specs: undefined, notice: expect.stringContaining('could not be read') })
    expect(demo.readSampleSpecs('{"a":1}')).toMatchObject({ specs: undefined, notice: expect.stringContaining('unexpected shape') })
    expect(demo.readSampleSpecs('[{"id":1}]').specs).toBeUndefined()
    expect(demo.readSampleSpecs('[]')).toEqual({ specs: undefined, notice: '' })
  })
})

describe('first load with saved demo data', () => {
  it('shows the valid specs, tells the person about the rest and writes the cleaned list back', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([legacy, { ...legacy, id: 'broken', priority: 'Urgent' }]))
    const { demo, workspace } = await loadModules()

    await expect(demo.listSpecs()).resolves.toEqual([{ ...legacy, criteriaDone: [false, false, false] }])
    expect(workspace.workspaceState().notice).toContain('1 saved sample spec could not be read')

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as ProductSpec[]
    expect(saved.map((spec) => spec.id)).toEqual([legacy.id])
    workspace.resetWorkspaceForTests()
  })

  it('leaves untouched data alone and shows no notice', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedSpecs))
    const { demo, workspace } = await loadModules()

    await expect(demo.listSpecs()).resolves.toHaveLength(seedSpecs.length)
    expect(workspace.workspaceState().notice).toBe('')
    workspace.resetWorkspaceForTests()
  })
})

describe('editing sample data', () => {
  it('edits, deletes and imports specs and saves each change', async () => {
    const { demo, workspace } = await loadModules()
    const created = await demo.createSpec(validInput)

    const edited = await demo.updateSpec(created.id, {
      acceptanceCriteria: ['One', 'Two'],
      criteriaDone: [true, false],
      owner: '',
      priority: 'Low',
      requirement: 'A rewritten requirement for the spec.',
      status: 'Review',
      title: 'Edited checklist',
    })
    expect(edited).toMatchObject({ title: 'Edited checklist', owner: '', status: 'Review', criteriaDone: [true, false] })

    await demo.importSpecs([{ ...seedSpecs[1], id: 'imported-one', updatedAt: '2026-01-01T00:00:00.000Z' }])
    await demo.deleteSpec(seedSpecs[0].id)

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as ProductSpec[]
    expect(saved.map((spec) => spec.id)).toEqual(['imported-one', created.id, seedSpecs[1].id, seedSpecs[2].id])
    expect(saved[0].updatedAt).toBe('2026-01-01T00:00:00.000Z')
    workspace.resetWorkspaceForTests()
  })

  it('rejects an edit with an invalid field the way the server would', async () => {
    const { demo, workspace } = await loadModules()
    await expect(
      demo.updateSpec(seedSpecs[0].id, { ...seedSpecs[0], title: 'x', criteriaDone: [] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', issues: [{ path: ['title'] }] })
    workspace.resetWorkspaceForTests()
  })

  it('reports an unknown id for an edit and a delete', async () => {
    const { demo, workspace } = await loadModules()
    await expect(demo.deleteSpec('missing')).rejects.toMatchObject({ code: 'SPEC_NOT_FOUND' })
    await expect(demo.updateSpec('missing', { ...seedSpecs[0], criteriaDone: [] })).rejects.toMatchObject({ code: 'SPEC_NOT_FOUND' })
    workspace.resetWorkspaceForTests()
  })

  it('refuses to import a spec that fails validation', async () => {
    const { demo, workspace } = await loadModules()
    await expect(demo.importSpecs([{ ...seedSpecs[0], id: 'bad', status: 'Done' as never }])).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    workspace.resetWorkspaceForTests()
  })
})

describe('with Your workspace selected', () => {
  it('saves changes to the workspace and leaves sample data and its reset alone', async () => {
    const { demo, workspace } = await loadModules()
    await workspace.chooseWorkspaceMode('workspace')
    await expect(demo.listSpecs()).resolves.toEqual([])

    const created = await demo.createSpec(validInput)
    await demo.updateSpecStatus(created.id, 'Shipped')
    await expect(demo.listSpecs()).resolves.toMatchObject([{ id: created.id, status: 'Shipped' }])
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()

    demo.resetDemoData()
    await expect(demo.listSpecs()).resolves.toHaveLength(1)

    await workspace.chooseWorkspaceMode('sample')
    await expect(demo.listSpecs()).resolves.toEqual(seedSpecs)
    workspace.resetWorkspaceForTests()
  })

  it('reports a failed save as an API error instead of pretending it worked', async () => {
    const storage = await import('../local/workspace')
    await storage.saveWorkspace({ version: 1, unbacked: false, specs: [{ nope: true }] }, { mode: 'workspace' })
    const { demo, workspace } = await loadModules()

    await expect(demo.createSpec(validInput)).rejects.toMatchObject({ code: 'STORAGE_ERROR', message: expect.stringContaining('cannot be read') })
    await expect(demo.listSpecs()).resolves.toEqual([])
    workspace.resetWorkspaceForTests()
  })
})
