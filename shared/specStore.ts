import type { CreateSpecInput, ProductSpec, SpecStatus } from './spec.js'
import { seedSpecs } from './spec.js'

export type SpecStore = {
  create(input: CreateSpecInput): Promise<ProductSpec>
  list(): Promise<ProductSpec[]>
  updateStatus(id: string, status: SpecStatus): Promise<ProductSpec | null>
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
export function createMemorySpecStore(initialSpecs: ProductSpec[] = seedSpecs): SpecStore {
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
  }
}
