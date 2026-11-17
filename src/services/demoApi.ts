import { ZodError } from 'zod'
import { seedSpecs, type CreateSpecInput, type ProductSpec, type SpecStatus } from '../../shared/spec'
import { createMemorySpecStore, type LocalSpecStore, type SpecPatch } from '../../shared/specStore'
import { createSpecSchema, editSpecSchema, statusSchema, validateStoredSpec } from '../../shared/validation'
import { WorkspaceConflictError } from '../local/workspace'
import { initializeWorkspace, mutateWorkspace, setNotice, workspaceState } from '../local/specWorkspace'
import { formatCount } from '../utils/pluralize'
import { ApiError } from './api'

// Namespaced so this never collides with data from another app on the same
// GitHub Pages origin, and versioned so a future data shape change can start
// fresh instead of crashing on old saved data.
const STORAGE_KEY = 'specship:demo:v1'

type LoadedSample = { specs: ProductSpec[] | undefined; notice: string }

/**
 * Reads the saved sample specs and checks each one, instead of trusting the
 * shape. Specs saved by an earlier version get a full ticked list. A spec that
 * does not pass is left out and the notice says how many and why.
 */
export function readSampleSpecs(raw: string | null): LoadedSample {
  if (!raw) {
    return { specs: undefined, notice: '' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { specs: undefined, notice: 'Saved sample data could not be read, so the sample specs were restored.' }
  }

  if (!Array.isArray(parsed)) {
    return { specs: undefined, notice: 'Saved sample data had an unexpected shape, so the sample specs were restored.' }
  }

  const specs: ProductSpec[] = []
  const seen = new Set<string>()
  const skipped: string[] = []
  parsed.forEach((value, index) => {
    const result = validateStoredSpec(value)
    if (!result.ok) {
      skipped.push(`spec ${index + 1}: ${result.message}`)
    } else if (seen.has(result.spec.id)) {
      skipped.push(`spec ${index + 1}: id "${result.spec.id}" appears twice`)
    } else {
      seen.add(result.spec.id)
      specs.push(result.spec)
    }
  })

  if (skipped.length === 0) {
    return { specs: specs.length > 0 ? specs : undefined, notice: '' }
  }

  const first = skipped.slice(0, 2).join('; ')
  const more = skipped.length > 2 ? ` and ${skipped.length - 2} more` : ''
  return {
    specs: specs.length > 0 ? specs : undefined,
    notice: `${formatCount(skipped.length, 'saved sample spec')} could not be read and ${skipped.length === 1 ? 'was' : 'were'} left out (${first}${more}).`,
  }
}

function loadPersistedSpecs(): LoadedSample {
  try {
    return readSampleSpecs(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    // Private browsing or storage disabled: fall back to the seed data for
    // this session instead of failing the demo.
    return { specs: undefined, notice: '' }
  }
}

function persistSpecs(specs: ProductSpec[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(specs))
  } catch {
    // Storage may be full or unavailable. The demo keeps working in memory
    // for the rest of the session even if it cannot save.
  }
}

const loaded = loadPersistedSpecs()
let store = createMemorySpecStore(loaded.specs)
let pendingNotice = loaded.notice
if (loaded.notice) {
  // Write the repaired list back so the same notice is not shown on every visit.
  persistSpecs(loaded.specs ?? seedSpecs)
}

function validationError(error: ZodError): ApiError {
  return new ApiError({
    code: 'VALIDATION_ERROR',
    error: 'Invalid request',
    issues: error.issues.map((issue) => ({
      path: issue.path as (string | number)[],
      message: issue.message,
    })),
  })
}

export async function fetchHealth(): Promise<{ ok: boolean }> {
  return { ok: true }
}

/** Waits for the saved mode and workspace to load. A storage failure is reported through the workspace state, not thrown. */
async function ready(): Promise<void> {
  await initializeWorkspace()
  if (pendingNotice) {
    setNotice(pendingNotice)
    pendingNotice = ''
  }
}

/**
 * Runs a change against whichever data is active: Your workspace is saved to
 * IndexedDB with a revision check, sample data to localStorage.
 */
async function mutate<T>(change: (active: LocalSpecStore) => Promise<T>): Promise<T> {
  await ready()
  if (workspaceState().mode === 'workspace') {
    try {
      return await mutateWorkspace(change)
    } catch (error) {
      if (error instanceof ApiError || error instanceof ZodError) {
        throw error
      }
      // Saved data was changed elsewhere, or the browser refused to save. Say so instead of pretending it worked.
      throw new ApiError({
        code: error instanceof WorkspaceConflictError ? 'WORKSPACE_CONFLICT' : 'STORAGE_ERROR',
        error: error instanceof Error ? error.message : 'Browser storage could not save this change.',
      })
    }
  }

  const result = await change(store)
  persistSpecs(await store.list())
  return result
}

function parseWith<T>(parse: () => T): T {
  try {
    return parse()
  } catch (error) {
    if (error instanceof ZodError) {
      throw validationError(error)
    }
    throw error
  }
}

function notFound(): ApiError {
  return new ApiError({ code: 'SPEC_NOT_FOUND', error: 'Spec not found' })
}

export async function listSpecs(): Promise<ProductSpec[]> {
  await ready()
  return workspaceState().mode === 'workspace' ? workspaceState().specs : store.list()
}

export async function createSpec(input: CreateSpecInput): Promise<ProductSpec> {
  const parsedInput = parseWith(() => createSpecSchema.parse(input))
  return mutate((active) => active.create(parsedInput))
}

export async function updateSpecStatus(id: string, status: SpecStatus): Promise<ProductSpec> {
  const parsedStatus = parseWith(() => statusSchema.parse({ status }).status)
  const spec = await mutate((active) => active.updateStatus(id, parsedStatus))

  if (!spec) {
    throw notFound()
  }

  return spec
}

export type EditSpecInput = Required<Pick<SpecPatch, 'acceptanceCriteria' | 'owner' | 'priority' | 'requirement' | 'status' | 'title'>> & {
  criteriaDone?: boolean[]
}

/** Saves edits to one spec. Fields are checked the same way as when a spec is created, and the owner may be empty. */
export async function updateSpec(id: string, input: EditSpecInput): Promise<ProductSpec> {
  const patch = parseWith(() => editSpecSchema.parse(input))
  const spec = await mutate((active) => active.update(id, patch))

  if (!spec) {
    throw notFound()
  }

  return spec
}

export async function deleteSpec(id: string): Promise<void> {
  const removed = await mutate((active) => active.remove(id))

  if (!removed) {
    throw notFound()
  }
}

/** Writes specs that were already read and checked from Markdown files. Their updated time is kept. */
export async function importSpecs(specs: ProductSpec[]): Promise<void> {
  const checked = specs.map((spec) => {
    const result = validateStoredSpec(spec)
    if (!result.ok) {
      throw new ApiError({ code: 'VALIDATION_ERROR', error: `Could not import "${spec.title}": ${result.message}` })
    }
    return result.spec
  })

  await mutate((active) => active.upsertMany(checked).then(() => true))
}

/** Clears saved sample data and starts a fresh store from the seed specs. Your workspace is never touched. */
export function resetDemoData(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore: nothing saved, or storage unavailable.
  }
  store = createMemorySpecStore()
}
