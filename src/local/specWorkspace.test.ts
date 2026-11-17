// @vitest-environment node
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { seedSpecs } from '../../shared/spec'

type Workspace = typeof import('./specWorkspace')

const input = {
  acceptanceCriteria: ['A criterion'],
  owner: 'Platform',
  priority: 'High' as const,
  requirement: 'A requirement long enough to pass.',
  title: 'Workspace spec',
}

async function load(): Promise<Workspace> {
  return import('./specWorkspace')
}

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('indexedDB', new IDBFactory())
})

describe('Your workspace', () => {
  it('starts empty in sample mode', async () => {
    const workspace = await load()
    await workspace.initializeWorkspace()
    expect(workspace.workspaceState()).toMatchObject({ ready: true, mode: 'sample', specs: [], unbacked: false, problem: null })
    workspace.resetWorkspaceForTests()
  })

  it('saves changes, marks them as not backed up, and survives a reload', async () => {
    let workspace = await load()
    await workspace.chooseWorkspaceMode('workspace')
    const created = await workspace.mutateWorkspace((store) => store.create(input))
    expect(workspace.workspaceState()).toMatchObject({ mode: 'workspace', unbacked: true })
    expect(workspace.workspaceState().specs).toEqual([created])
    workspace.resetWorkspaceForTests()

    vi.resetModules()
    workspace = await load()
    await workspace.initializeWorkspace()
    expect(workspace.workspaceState()).toMatchObject({ mode: 'workspace', unbacked: true, problem: null })
    // Reading checks every spec and fills in the ticked list.
    expect(workspace.workspaceState().specs).toEqual([{ ...created, criteriaDone: [false] }])
    workspace.resetWorkspaceForTests()
  })

  it('does not write when a change finds nothing to do', async () => {
    const workspace = await load()
    await workspace.chooseWorkspaceMode('workspace')
    await expect(workspace.mutateWorkspace((store) => store.remove('missing'))).resolves.toBe(false)
    expect(workspace.workspaceState().unbacked).toBe(false)
    workspace.resetWorkspaceForTests()
  })

  it('clears the backup reminder once everything was exported', async () => {
    const workspace = await load()
    await workspace.chooseWorkspaceMode('workspace')
    await workspace.mutateWorkspace((store) => store.create(input))
    await workspace.markBackedUp()
    expect(workspace.workspaceState().unbacked).toBe(false)
    await workspace.mutateWorkspace((store) => store.create({ ...input, title: 'Second spec' }))
    expect(workspace.workspaceState().unbacked).toBe(true)
    workspace.resetWorkspaceForTests()
  })

  it('keeps sample mode and workspace specs independent', async () => {
    const workspace = await load()
    await workspace.chooseWorkspaceMode('workspace')
    await workspace.mutateWorkspace((store) => store.create(input))
    await workspace.chooseWorkspaceMode('sample')
    expect(workspace.workspaceState()).toMatchObject({ mode: 'sample' })
    expect(workspace.workspaceState().specs).toHaveLength(1)
    workspace.resetWorkspaceForTests()
  })

  it('refuses a save when another tab saved first, then shows the latest version', async () => {
    const first = await load()
    await first.chooseWorkspaceMode('workspace')
    await first.mutateWorkspace((store) => store.create(input))

    // A second tab is a second copy of the module in the same browser storage.
    vi.resetModules()
    const second = await load()
    await second.initializeWorkspace()
    await second.mutateWorkspace((store) => store.create({ ...input, title: 'Saved by the second tab' }))

    await expect(first.mutateWorkspace((store) => store.create({ ...input, title: 'Too late' }))).rejects.toThrow('another tab')
    expect(first.workspaceState().specs.map((spec) => spec.title)).toEqual(['Saved by the second tab', 'Workspace spec'])
    first.resetWorkspaceForTests()
    second.resetWorkspaceForTests()
  })

  it('shows what another tab saved and says so', async () => {
    const first = await load()
    await first.chooseWorkspaceMode('workspace')
    const before = first.workspaceState().syncTick

    vi.resetModules()
    const second = await load()
    await second.initializeWorkspace()
    await second.mutateWorkspace((store) => store.create(input))

    await vi.waitFor(() => expect(first.workspaceState().specs).toHaveLength(1))
    expect(first.workspaceState().syncTick).toBeGreaterThan(before)
    expect(first.workspaceState().notice).toContain('Another tab changed this workspace')
    first.resetWorkspaceForTests()
    second.resetWorkspaceForTests()
  })

  it('clears the workspace', async () => {
    const workspace = await load()
    await workspace.chooseWorkspaceMode('workspace')
    await workspace.mutateWorkspace((store) => store.create(input))
    await workspace.removeWorkspace()
    expect(workspace.workspaceState()).toMatchObject({ specs: [], unbacked: false, problem: null })
    workspace.resetWorkspaceForTests()
  })
})

describe('a workspace that cannot be read', () => {
  async function saveRaw(value: unknown) {
    const storage = await import('./workspace')
    await storage.saveWorkspace(value, { mode: 'workspace' })
  }

  it('reports which spec is wrong, refuses changes, and can be cleared', async () => {
    await saveRaw({ version: 1, unbacked: false, specs: [seedSpecs[0], { ...seedSpecs[1], status: 'Done' }] })
    const workspace = await load()
    await workspace.initializeWorkspace()
    const state = workspace.workspaceState()
    expect(state.mode).toBe('workspace')
    expect(state.specs).toEqual([])
    expect(state.problem?.kind).toBe('unreadable')
    expect(state.problem?.message).toContain('spec 2, status')
    expect(state.problem?.message).toContain('Clear the workspace')

    await expect(workspace.mutateWorkspace((store) => store.create(input))).rejects.toThrow('cannot be read')

    await workspace.removeWorkspace()
    expect(workspace.workspaceState().problem).toBeNull()
    await workspace.mutateWorkspace((store) => store.create(input))
    expect(workspace.workspaceState().specs).toHaveLength(1)
    workspace.resetWorkspaceForTests()
  })

  it('reports an unsupported format and a repeated id', async () => {
    await saveRaw({ version: 2, specs: [] })
    let workspace = await load()
    await workspace.initializeWorkspace()
    expect(workspace.workspaceState().problem?.message).toContain('unsupported format')
    workspace.resetWorkspaceForTests()

    vi.resetModules()
    await saveRaw({ version: 1, unbacked: false, specs: [seedSpecs[0], seedSpecs[0]] })
    workspace = await load()
    await workspace.initializeWorkspace()
    expect(workspace.workspaceState().problem?.message).toContain('saved twice')
    workspace.resetWorkspaceForTests()
  })
})

describe('browser storage that is not available', () => {
  it('falls back to sample mode with a message and refuses the workspace', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const workspace = await load()
    await workspace.initializeWorkspace()
    expect(workspace.workspaceState().mode).toBe('sample')
    expect(workspace.workspaceState().problem?.kind).toBe('storage')
    await expect(workspace.chooseWorkspaceMode('workspace')).rejects.toThrow('cannot be saved')
    workspace.resetWorkspaceForTests()
  })
})
