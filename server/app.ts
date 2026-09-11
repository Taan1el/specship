import express from 'express'
import { ZodError } from 'zod'
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
        response.status(404).json({ code: 'SPEC_NOT_FOUND', error: 'Spec not found' })
        return
      }

      response.json(spec)
    } catch (error) {
      next(error)
    }
  })

  app.use((_request, response) => {
    response.status(404).json({ code: 'NOT_FOUND', error: 'Route not found' })
  })

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      next: express.NextFunction,
    ) => {
      if (response.headersSent) {
        next(error)
        return
      }

      if (error instanceof ZodError) {
        response.status(400).json({
          code: 'VALIDATION_ERROR',
          error: 'Invalid request',
          issues: error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        })
        return
      }

      const type = error && typeof error === 'object' && 'type' in error
        ? error.type
        : undefined

      if (type === 'entity.parse.failed') {
        response.status(400).json({ code: 'INVALID_JSON', error: 'Malformed JSON body' })
        return
      }

      if (type === 'entity.too.large') {
        response.status(413).json({ code: 'PAYLOAD_TOO_LARGE', error: 'Request body is too large' })
        return
      }

      if (type === 'charset.unsupported' || type === 'encoding.unsupported') {
        response.status(415).json({ code: 'UNSUPPORTED_ENCODING', error: 'Unsupported request encoding' })
        return
      }

      response.status(500).json({
        code: 'INTERNAL_ERROR',
        error: 'Unable to complete request',
      })
    },
  )

  return app
}
