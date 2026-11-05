import { z } from 'zod'

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
