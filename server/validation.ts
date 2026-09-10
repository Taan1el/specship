import { z } from 'zod'

export const createSpecSchema = z.object({
  acceptanceCriteria: z
    .array(z.string().trim().min(1))
    .min(1, 'Add at least one acceptance criterion'),
  owner: z.string().trim().min(2),
  priority: z.enum(['Low', 'Medium', 'High']),
  requirement: z.string().trim().min(10),
  title: z.string().trim().min(3),
})

export const statusSchema = z.object({
  status: z.enum(['Backlog', 'In progress', 'Review', 'Shipped']),
})
