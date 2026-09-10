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

export const seedSpecs: ProductSpec[] = [
  {
    id: 'spec-job-fit-dashboard',
    title: 'Job-fit dashboard',
    owner: 'Frontend',
    status: 'In progress',
    priority: 'High',
    requirement:
      'Teams need to see how planned work maps to real product requirements.',
    acceptanceCriteria: [
      'Show target job requirements in a scannable layout.',
      'Track which requirements are covered by planned work.',
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
