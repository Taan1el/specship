import { z } from 'zod'
import type { ProductSpec } from './spec.js'
import { criteriaState } from './spec.js'

export const specFieldLimits = {
  criterion: 500,
  owner: 100,
  requirement: 5000,
  title: 200,
} as const

export const createSpecSchema = z.object({
  acceptanceCriteria: z
    .array(z.string().trim().min(1).max(specFieldLimits.criterion))
    .min(1, 'Add at least one acceptance criterion')
    .max(25),
  owner: z.string().trim().min(2).max(specFieldLimits.owner),
  priority: z.enum(['Low', 'Medium', 'High']),
  requirement: z.string().trim().min(10).max(specFieldLimits.requirement),
  title: z.string().trim().min(3).max(specFieldLimits.title),
})

export const statusSchema = z.object({
  status: z.enum(['Backlog', 'In progress', 'Review', 'Shipped']),
})

export const specStatuses = ['Backlog', 'In progress', 'Review', 'Shipped'] as const

// The line that starts the criteria section in a spec's Markdown file. A requirement
// that contains this exact line could not be read back, so it is refused.
export const criteriaHeading = '## Acceptance criteria'

export function hasCriteriaHeadingLine(requirement: string): boolean {
  return requirement.split(/\r\n|\r|\n/).some((line) => line.trim() === criteriaHeading)
}

const requirementField = z
  .string()
  .trim()
  .min(10)
  .max(specFieldLimits.requirement)
  .refine((value) => !hasCriteriaHeadingLine(value), {
    message: `The requirement cannot contain a line that reads "${criteriaHeading}"`,
  })

const criteriaFields = {
  acceptanceCriteria: z
    .array(z.string().trim().min(1).max(specFieldLimits.criterion))
    .min(1, 'Add at least one acceptance criterion')
    .max(25),
  criteriaDone: z.array(z.boolean()).max(25).optional(),
}

/** What a person can change when editing a spec. Owner may be empty. */
export const editSpecSchema = z.object({
  ...criteriaFields,
  owner: z.union([z.literal(''), z.string().trim().min(2).max(specFieldLimits.owner)]),
  priority: z.enum(['Low', 'Medium', 'High']),
  requirement: requirementField,
  status: z.enum(specStatuses),
  title: z.string().trim().min(3).max(specFieldLimits.title),
})

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'must be a date such as 2026-09-10T00:00:00.000Z',
})

/** The full saved shape of one spec, used to check anything read back from browser storage or a file. */
export const storedSpecSchema = z.object({
  ...criteriaFields,
  extra: z.record(z.string(), z.string()).optional(),
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/, 'must be letters, digits, dot, dash or underscore, up to 100 characters'),
  owner: z.string().max(specFieldLimits.owner),
  priority: z.enum(['Low', 'Medium', 'High']),
  requirement: requirementField,
  status: z.enum(specStatuses),
  title: z.string().trim().min(3).max(specFieldLimits.title),
  updatedAt: isoDate,
})

export type StoredSpecResult =
  | { ok: true; spec: ProductSpec }
  | { ok: false; message: string }

/** Checks one value read from storage and returns a spec with a full ticked list, or one readable reason. */
export function validateStoredSpec(value: unknown): StoredSpecResult {
  const result = storedSpecSchema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues[0]
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
    return { ok: false, message: `${path}${issue.message}` }
  }

  const { criteriaDone: ticked, extra, ...rest } = result.data
  const spec: ProductSpec = { ...rest, criteriaDone: criteriaState({ acceptanceCriteria: rest.acceptanceCriteria, criteriaDone: ticked }) }
  if (extra && Object.keys(extra).length > 0) spec.extra = extra
  return { ok: true, spec }
}
