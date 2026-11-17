export type SpecStatus = 'Backlog' | 'In progress' | 'Review' | 'Shipped'

export type SpecPriority = 'Low' | 'Medium' | 'High'

export type ProductSpec = {
  id: string
  title: string
  owner: string
  status: SpecStatus
  priority: SpecPriority
  requirement: string
  acceptanceCriteria: string[]
  /**
   * Which acceptance criteria are ticked, in the same order as
   * `acceptanceCriteria`. Optional so specs from the API and older saved data
   * stay valid; a missing or short list reads as "not ticked".
   */
  criteriaDone?: boolean[]
  /** Front matter fields from an imported Markdown file that SpecShip does not use. Kept so they survive export. */
  extra?: Record<string, string>
  updatedAt: string
}

export type CreateSpecInput = {
  title: string
  owner: string
  priority: SpecPriority
  requirement: string
  acceptanceCriteria: string[]
}

export const statusOrder: SpecStatus[] = [
  'Backlog',
  'In progress',
  'Review',
  'Shipped',
]

/** Ticked state for every criterion, always as long as the criteria list. */
export function criteriaState(spec: Pick<ProductSpec, 'acceptanceCriteria' | 'criteriaDone'>): boolean[] {
  return spec.acceptanceCriteria.map((_, index) => spec.criteriaDone?.[index] === true)
}

export function nextStatus(status: SpecStatus): SpecStatus {
  return statusOrder[(statusOrder.indexOf(status) + 1) % statusOrder.length]
}

export const seedSpecs: ProductSpec[] = [
  {
    id: 'spec-intake-dashboard',
    title: 'Spec intake dashboard',
    owner: 'Frontend',
    status: 'In progress',
    priority: 'High',
    requirement:
      'Product teams need a clear view of new feature requests before planning delivery work.',
    acceptanceCriteria: [
      'Show incoming feature requests in a scannable layout.',
      'Track owner, priority, and delivery status for each spec.',
      'Keep the interface responsive on mobile and desktop.',
    ],
    updatedAt: '2026-09-10T00:00:00.000Z',
  },
  {
    id: 'spec-release-checklist',
    title: 'Release checklist',
    owner: 'Platform',
    status: 'Backlog',
    priority: 'Medium',
    requirement:
      'Teams need a lightweight checklist before moving a feature from review to shipped.',
    acceptanceCriteria: [
      'Require tests to pass before shipping.',
      'Show deployment and rollback notes.',
      'Record the latest status update timestamp.',
    ],
    updatedAt: '2026-09-10T00:00:00.000Z',
  },
  {
    id: 'spec-api-contract',
    title: 'API contract review',
    owner: 'Backend',
    status: 'Review',
    priority: 'High',
    requirement:
      'Developers need to confirm API contracts before the frontend depends on new data.',
    acceptanceCriteria: [
      'Document request and response fields.',
      'Handle empty and error responses.',
      'Share a typed contract with the frontend.',
    ],
    updatedAt: '2026-09-10T00:00:00.000Z',
  },
]
