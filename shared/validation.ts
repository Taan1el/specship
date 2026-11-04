import { z } from 'zod'

export const createSpecSchema = z.object({
  acceptanceCriteria: z
    .array(z.string().trim().min(1).max(500))
    .min(1, 'Add at least one acceptance criterion')
    .max(25),
  owner: z.string().trim().min(2).max(100),
  priority: z.enum(['Low', 'Medium', 'High']),
  requirement: z.string().trim().min(10).max(5000),
  title: z.string().trim().min(3).max(200),
})

export const statusSchema = z.object({
  status: z.enum(['Backlog', 'In progress', 'Review', 'Shipped']),
})
