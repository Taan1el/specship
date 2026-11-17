import type { ProductSpec } from '../../shared/spec'
import { createMemorySpecStore, type LocalSpecStore } from '../../shared/specStore'
import { validateStoredSpec } from '../../shared/validation'
import {
  clearWorkspace,
  loadMode,
  loadWorkspace,
  saveMode,
  saveWorkspace,
  SavedWorkspaceError,
  subscribeToOtherTabs,
  WorkspaceConflictError,
  type WorkspaceMode,
} from './workspace'

export type { WorkspaceMode } from './workspace'

/**
 * What is saved under the workspace key. `unbacked` is true from the first change
 * after the specs last left the browser as a file, and is what the backup
 * reminder shows.
 */
type StoredWorkspace = {
  version: 1
  specs: unknown[]
  unbacked: boolean
}

export type WorkspaceProblem = {
  /** unreadable: saved data exists but cannot be used, so it can be cleared. storage: the browser refused to open storage. */
  kind: 'unreadable' | 'storage'
  message: string
}

export type WorkspaceState = {
  ready: boolean
  mode: WorkspaceMode
  /** The specs saved in Your workspace. Sample data is kept elsewhere. */
  specs: ProductSpec[]
  unbacked: boolean
  problem: WorkspaceProblem | null
  /** A short line for the person: another tab saved, or saved sample data was repaired. */
  notice: string
  /** Goes up whenever the visible specs change for a reason other than this tab's own save. */
  syncTick: number
}

let state: WorkspaceState = { ready: false, mode: 'sample', specs: [], unbacked: false, problem: null, notice: '', syncTick: 0 }
let revision = 0
let ready: Promise<void> | undefined
let stopListening: (() => void) | undefined
const listeners = new Set<() => void>()

export function subscribeWorkspace(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** A new object whenever anything changes, so it works with useSyncExternalStore. */
export function workspaceState(): WorkspaceState {
  return state
}

function publish(patch: Partial<WorkspaceState>, outside = false): void {
  state = { ...state, ...patch, syncTick: outside ? state.syncTick + 1 : state.syncTick }
  listeners.forEach((listener) => listener())
}

function unreadable(detail: string): SavedWorkspaceError {
  return new SavedWorkspaceError(
    `The saved workspace in this browser cannot be read (${detail}). Clear the workspace to start again, or switch to sample data.`,
  )
}

function restore(saved: StoredWorkspace): ProductSpec[] {
  if (!saved || saved.version !== 1 || !Array.isArray(saved.specs) || typeof saved.unbacked !== 'boolean') {
    throw new SavedWorkspaceError('The saved workspace in this browser has an unsupported format. Clear the workspace to start again, or switch to sample data.')
  }
  const seen = new Set<string>()
  return saved.specs.map((value, index) => {
    const result = validateStoredSpec(value)
    if (!result.ok) throw unreadable(`spec ${index + 1}, ${result.message}`)
    if (seen.has(result.spec.id)) throw unreadable(`spec ${index + 1}, id "${result.spec.id}" is saved twice`)
    seen.add(result.spec.id)
    return result.spec
  })
}

async function readAll(): Promise<void> {
  const [mode, saved] = await Promise.all([loadMode(), loadWorkspace<StoredWorkspace>()])
  if (!saved) {
    revision = 0
    publish({ ready: true, mode, specs: [], unbacked: false, problem: null }, true)
    return
  }
  const specs = restore(saved.data)
  revision = saved.revision
  publish({ ready: true, mode, specs, unbacked: saved.data.unbacked, problem: null }, true)
}

/** Another tab saved the workspace: take its version. This tab's own edits are already saved, so none are lost. */
async function followOtherTab(): Promise<void> {
  const before = revision
  try {
    await readAll()
    if (revision !== before) publish({ notice: 'Another tab changed this workspace. This tab now shows the latest saved version.' })
  } catch (error) {
    if (error instanceof SavedWorkspaceError) publish({ ready: true, specs: [], problem: { kind: 'unreadable', message: error.message } }, true)
  }
}

export function initializeWorkspace(): Promise<void> {
  ready ??= (async () => {
    try {
      await readAll()
    } catch (error) {
      if (error instanceof SavedWorkspaceError) {
        // The mode is still readable, so the person lands where they were and sees why the data is not shown.
        const mode = await loadMode().catch((): WorkspaceMode => 'sample')
        publish({ ready: true, mode, specs: [], unbacked: false, problem: { kind: 'unreadable', message: error.message } }, true)
      } else {
        publish({
          ready: true,
          mode: 'sample',
          specs: [],
          problem: { kind: 'storage', message: 'Browser storage is unavailable here, so Your workspace cannot be saved. Sample data still works. Check the browser storage settings.' },
        }, true)
      }
    }
    stopListening ??= subscribeToOtherTabs(() => {
      void followOtherTab()
    })
  })()
  return ready
}

export function setNotice(notice: string): void {
  if (state.notice !== notice) publish({ notice })
}

export async function chooseWorkspaceMode(next: WorkspaceMode): Promise<void> {
  await initializeWorkspace()
  if (next === 'workspace' && state.problem?.kind === 'storage') throw new Error(state.problem.message)
  await saveMode(next)
  publish({ mode: next, notice: '' }, true)
}

function toStored(specs: ProductSpec[], unbacked: boolean): StoredWorkspace {
  return { version: 1, specs, unbacked }
}

async function conflictFallback(error: unknown): Promise<never> {
  if (error instanceof WorkspaceConflictError) {
    try {
      await readAll()
    } catch {
      // The error below is the one to show.
    }
  }
  throw error
}

/**
 * Applies a change to the latest saved specs and writes the result. The write is
 * refused when another tab saved first; this tab then shows that tab's version
 * and the error says the change was not saved. A null or false result means the
 * change found nothing to do, so nothing is written.
 */
export async function mutateWorkspace<T>(change: (store: LocalSpecStore) => Promise<T>): Promise<T> {
  await initializeWorkspace()
  if (state.problem) throw new Error(state.problem.message)
  const draft = createMemorySpecStore(state.specs)
  const result = await change(draft)
  if (result === null || result === false) return result
  const next = await draft.list()
  try {
    revision = await saveWorkspace(toStored(next, true), { expectedRevision: revision })
  } catch (error) {
    return conflictFallback(error)
  }
  publish({ specs: next, unbacked: true })
  return result
}

/** Records that every spec was written to a file, so the backup reminder goes away. */
export async function markBackedUp(): Promise<void> {
  await initializeWorkspace()
  if (state.problem || !state.unbacked) return
  try {
    revision = await saveWorkspace(toStored(state.specs, false), { expectedRevision: revision })
  } catch (error) {
    return conflictFallback(error)
  }
  publish({ unbacked: false })
}

/** Deletes every saved spec. Works on an unreadable workspace too. */
export async function removeWorkspace(): Promise<void> {
  await initializeWorkspace()
  revision = await clearWorkspace()
  publish({ ready: true, specs: [], unbacked: false, problem: null, notice: '' }, true)
}

/** Test helper: stops listening to other tabs and forgets everything loaded. */
export function resetWorkspaceForTests(): void {
  stopListening?.()
  stopListening = undefined
  ready = undefined
  revision = 0
  state = { ready: false, mode: 'sample', specs: [], unbacked: false, problem: null, notice: '', syncTick: 0 }
}
