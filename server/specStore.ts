import pg from 'pg'
import type { CreateSpecInput, ProductSpec, SpecStatus } from '../shared/spec.js'
import { seedSpecs } from '../shared/spec.js'

type SpecRow = {
  id: string
  title: string
  owner: string
  status: SpecStatus
  priority: ProductSpec['priority']
  requirement: string
  acceptance_criteria: string[]
  updated_at: Date
}

export type SpecStore = {
  create(input: CreateSpecInput): Promise<ProductSpec>
  list(): Promise<ProductSpec[]>
  updateStatus(id: string, status: SpecStatus): Promise<ProductSpec | null>
}

const { Pool } = pg

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function toSpec(row: SpecRow): ProductSpec {
  return {
    acceptanceCriteria: row.acceptance_criteria,
    id: row.id,
    owner: row.owner,
    priority: row.priority,
    requirement: row.requirement,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at.toISOString(),
  }
}

export function createMemorySpecStore(initialSpecs = seedSpecs): SpecStore {
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

export function createPostgresSpecStore(connectionString: string): SpecStore {
  const pool = new Pool({ connectionString })

  async function ensureSchema() {
    await pool.query(`
      create table if not exists specs (
        id text primary key,
        title text not null,
        owner text not null,
        status text not null,
        priority text not null,
        requirement text not null,
        acceptance_criteria text[] not null,
        updated_at timestamptz not null
      )
    `)

    const { rows } = await pool.query('select count(*)::int as count from specs')

    if (rows[0]?.count === 0) {
      for (const spec of seedSpecs) {
        await pool.query(
          `
            insert into specs (
              id,
              title,
              owner,
              status,
              priority,
              requirement,
              acceptance_criteria,
              updated_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            spec.id,
            spec.title,
            spec.owner,
            spec.status,
            spec.priority,
            spec.requirement,
            spec.acceptanceCriteria,
            spec.updatedAt,
          ],
        )
      }
    }
  }

  return {
    async create(input) {
      await ensureSchema()

      const spec: ProductSpec = {
        ...input,
        id: `${slugify(input.title)}-${Date.now()}`,
        status: 'Backlog',
        updatedAt: new Date().toISOString(),
      }

      const { rows } = await pool.query<SpecRow>(
        `
          insert into specs (
            id,
            title,
            owner,
            status,
            priority,
            requirement,
            acceptance_criteria,
            updated_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8)
          returning *
        `,
        [
          spec.id,
          spec.title,
          spec.owner,
          spec.status,
          spec.priority,
          spec.requirement,
          spec.acceptanceCriteria,
          spec.updatedAt,
        ],
      )

      return toSpec(rows[0])
    },
    async list() {
      await ensureSchema()

      const { rows } = await pool.query<SpecRow>(
        'select * from specs order by updated_at desc',
      )

      return rows.map(toSpec)
    },
    async updateStatus(id, status) {
      await ensureSchema()

      const { rows } = await pool.query<SpecRow>(
        `
          update specs
          set status = $2, updated_at = now()
          where id = $1
          returning *
        `,
        [id, status],
      )

      return rows[0] ? toSpec(rows[0]) : null
    },
  }
}
