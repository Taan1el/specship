import type { CreateSpecInput, ProductSpec, SpecStatus } from './spec.js'
import { criteriaState, seedSpecs } from './spec.js'

export type SpecStore = {
  create(input: CreateSpecInput): Promise<ProductSpec>
  list(): Promise<ProductSpec[]>
  updateStatus(id: string, status: SpecStatus): Promise<ProductSpec | null>
}

export type SpecPatch = Partial<
  Pick<
    ProductSpec,
    'acceptanceCriteria' | 'criteriaDone' | 'owner' | 'priority' | 'requirement' | 'status' | 'title'
  >
>

/**
 * The browser-side store: everything SpecStore does, plus editing, deleting and
 * bringing in specs from files. The Express API keeps the smaller SpecStore.
 */
export type LocalSpecStore = SpecStore & {
  /** Changes fields of one spec and stamps it as updated now. Returns null when the id is unknown. */
  update(id: string, patch: SpecPatch): Promise<ProductSpec | null>
  /** Deletes one spec. Returns false when the id is unknown. */
  remove(id: string): Promise<boolean>
  /** Adds specs, or replaces the spec with the same id, keeping the given updatedAt. New ids go first. */
  upsertMany(incoming: ProductSpec[]): Promise<void>
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * In-memory spec store. Pure TypeScript with no Node-only APIs, so it runs
 * the same way in the Express server and in the browser (used by the
 * GitHub Pages demo to simulate the API without a backend).
 */
export function createMemorySpecStore(initialSpecs: ProductSpec[] = seedSpecs): LocalSpecStore {
  let specs = [...initialSpecs]

  return {
    async create(input) {
      const spec: ProductSpec = {
        ...input,
        id: `${slugify(input.title)}-${Date.now()}`,
        status: 'Backlog',
        updatedAt: new Date().toISOString(),
      }

      specs = [spec, ...specs]
      return spec
    },
    async list() {
      return specs
    },
    async updateStatus(id, status) {
      let updatedSpec: ProductSpec | null = null

      specs = specs.map((spec) => {
        if (spec.id !== id) {
          return spec
        }

        updatedSpec = { ...spec, status, updatedAt: new Date().toISOString() }
        return updatedSpec
      })

      return updatedSpec
    },
    async update(id, patch) {
      const current = specs.find((spec) => spec.id === id)
      if (!current) {
        return null
      }

      const merged: ProductSpec = { ...current, ...patch, updatedAt: new Date().toISOString() }
      // Keep the ticked list exactly as long as the criteria list.
      merged.criteriaDone = criteriaState(merged)
      specs = specs.map((spec) => (spec.id === id ? merged : spec))
      return merged
    },
    async remove(id) {
      const before = specs.length
      specs = specs.filter((spec) => spec.id !== id)
      return specs.length < before
    },
    async upsertMany(incoming) {
      const byId = new Map(incoming.map((spec) => [spec.id, spec]))
      const known = new Set(specs.map((spec) => spec.id))
      const replaced = specs.map((spec) => byId.get(spec.id) ?? spec)
      specs = [...incoming.filter((spec) => !known.has(spec.id)), ...replaced]
    },
  }
}
