import pg from 'pg'
import type { ProductSpec, SpecStatus } from '../shared/spec.js'
import { seedSpecs } from '../shared/spec.js'
import { slugify } from '../shared/specStore.js'
import type { SpecStore } from '../shared/specStore.js'

export type { SpecStore } from '../shared/specStore.js'
export { createMemorySpecStore } from '../shared/specStore.js'

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

const { Pool } = pg

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

/**
 * PostgreSQL-backed spec store used for container and database runs. Uses
 * the `pg` Node client, so this stays server-only (not imported by the
 * browser demo build).
 */
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
