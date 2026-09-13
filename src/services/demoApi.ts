import { ZodError } from 'zod'
import type { CreateSpecInput, ProductSpec, SpecStatus } from '../../shared/spec'
import { createMemorySpecStore } from '../../shared/specStore'
import { createSpecSchema, statusSchema } from '../../shared/validation'
import { ApiError } from './api'

// Namespaced so this never collides with data from another app on the same
// GitHub Pages origin, and versioned so a future data shape change can start
// fresh instead of crashing on old saved data.
const STORAGE_KEY = 'specship:demo:v1'

function loadPersistedSpecs(): ProductSpec[] | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return undefined
    }

    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ProductSpec[]) : undefined
  } catch {
    // Corrupted data, private browsing, or storage disabled: fall back to
    // the seed data for this session instead of failing the demo.
    return undefined
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

let store = createMemorySpecStore(loadPersistedSpecs())

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

export async function listSpecs(): Promise<ProductSpec[]> {
  return store.list()
}

export async function createSpec(input: CreateSpecInput): Promise<ProductSpec> {
  let parsedInput: CreateSpecInput

  try {
    parsedInput = createSpecSchema.parse(input)
  } catch (error) {
    if (error instanceof ZodError) {
      throw validationError(error)
    }
    throw error
  }

  const spec = await store.create(parsedInput)
  persistSpecs(await store.list())
  return spec
}

export async function updateSpecStatus(id: string, status: SpecStatus): Promise<ProductSpec> {
  let parsedStatus: SpecStatus

  try {
    parsedStatus = statusSchema.parse({ status }).status
  } catch (error) {
    if (error instanceof ZodError) {
      throw validationError(error)
    }
    throw error
  }

  const spec = await store.updateStatus(id, parsedStatus)

  if (!spec) {
    throw new ApiError({ code: 'SPEC_NOT_FOUND', error: 'Spec not found' })
  }

  persistSpecs(await store.list())
  return spec
}

/** Clears saved demo data and starts a fresh store from the seed specs. */
export function resetDemoData(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore: nothing saved, or storage unavailable.
  }
  store = createMemorySpecStore()
}
