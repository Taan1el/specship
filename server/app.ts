import express from 'express'
import type { SpecStore } from './specStore.js'
import { createSpecSchema, statusSchema } from './validation.js'

export function createApp(store: SpecStore) {
  const app = express()

  app.use(express.json())

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true })
  })

  app.get('/api/specs', async (_request, response, next) => {
    try {
      response.json(await store.list())
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/specs', async (request, response, next) => {
    try {
      const input = createSpecSchema.parse(request.body)
      const spec = await store.create(input)

      response.status(201).json(spec)
    } catch (error) {
      next(error)
    }
  })

  app.patch('/api/specs/:id/status', async (request, response, next) => {
    try {
      const { status } = statusSchema.parse(request.body)
      const spec = await store.updateStatus(request.params.id, status)

      if (!spec) {
        response.status(404).json({ error: 'Spec not found' })
        return
      }

      response.json(spec)
    } catch (error) {
      next(error)
    }
  })

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      response.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid request',
      })
    },
  )

  return app
}
