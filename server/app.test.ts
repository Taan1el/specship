import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { seedSpecs } from '../shared/spec.js'
import { createApp } from './app.js'
import { createMemorySpecStore } from './specStore.js'

describe('SpecShip API', () => {
  const validInput = {
    acceptanceCriteria: ['Show a passing review state'],
    owner: 'Frontend',
    priority: 'High',
    requirement: 'The team needs to see a complete delivery checklist.',
    title: 'Delivery checklist',
  }

  it('returns field issues without storing invalid specs', async () => {
    const store = createMemorySpecStore()
    const create = vi.spyOn(store, 'create')
    const response = await request(createApp(store))
      .post('/api/specs')
      .send({ ...validInput, title: ' ', acceptanceCriteria: [' '] })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      error: 'Invalid request',
      issues: expect.arrayContaining([
        { path: ['title'], message: expect.any(String) },
        { path: ['acceptanceCriteria', 0], message: expect.any(String) },
      ]),
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects invalid status changes before storage', async () => {
    const store = createMemorySpecStore()
    const updateStatus = vi.spyOn(store, 'updateStatus')
    const response = await request(createApp(store))
      .patch('/api/specs/spec-release-checklist/status')
      .send({ status: 'Unknown' })

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('VALIDATION_ERROR')
    expect(response.body.issues[0].path).toEqual(['status'])
    expect(updateStatus).not.toHaveBeenCalled()
  })

  it('returns a JSON error for malformed JSON without echoing the body', async () => {
    const store = createMemorySpecStore()
    const create = vi.spyOn(store, 'create')
    const response = await request(createApp(store))
      .post('/api/specs')
      .set('Content-Type', 'application/json')
      .send('{"private-note":')

    expect(response.status).toBe(400)
    expect(response.type).toBe('application/json')
    expect(response.body).toEqual({ code: 'INVALID_JSON', error: 'Malformed JSON body' })
    expect(create).not.toHaveBeenCalled()
  })

  it('preserves the payload size limit as a 413 response', async () => {
    const store = createMemorySpecStore()
    const create = vi.spyOn(store, 'create')
    const response = await request(createApp(store))
      .post('/api/specs')
      .send({ ...validInput, requirement: 'x'.repeat(110 * 1024) })

    expect(response.status).toBe(413)
    expect(response.body).toEqual({ code: 'PAYLOAD_TOO_LARGE', error: 'Request body is too large' })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects unsupported request encodings with a 415 response', async () => {
    const response = await request(createApp(createMemorySpecStore()))
      .post('/api/specs')
      .set('Content-Encoding', 'unsupported')
      .send(validInput)

    expect(response.status).toBe(415)
    expect(response.body).toEqual({ code: 'UNSUPPORTED_ENCODING', error: 'Unsupported request encoding' })
  })

  it('distinguishes a missing spec from an unknown route', async () => {
    const app = createApp(createMemorySpecStore())
    const missingSpec = await request(app)
      .patch('/api/specs/missing/status')
      .send({ status: 'Review' })
    const missingRoute = await request(app).get('/api/missing')

    expect(missingSpec.status).toBe(404)
    expect(missingSpec.body).toEqual({ code: 'SPEC_NOT_FOUND', error: 'Spec not found' })
    expect(missingRoute.status).toBe(404)
    expect(missingRoute.body).toEqual({ code: 'NOT_FOUND', error: 'Route not found' })
  })

  it.each(['list', 'create', 'updateStatus'] as const)(
    'returns a safe 500 response when storage %s fails',
    async (method) => {
      const store = createMemorySpecStore()
      vi.spyOn(store, method).mockRejectedValue(new Error('Internal database failure details'))
      const app = createApp(store)
      const response = method === 'list'
        ? await request(app).get('/api/specs')
        : method === 'create'
          ? await request(app).post('/api/specs').send(validInput)
          : await request(app).patch('/api/specs/spec-release-checklist/status').send({ status: 'Review' })

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ code: 'INTERNAL_ERROR', error: 'Unable to complete request' })
    },
  )

  it('handles non-Error storage failures without exposing them', async () => {
    const store = createMemorySpecStore()
    vi.spyOn(store, 'list').mockRejectedValue('Internal storage failure details')
    const response = await request(createApp(store)).get('/api/specs')

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ code: 'INTERNAL_ERROR', error: 'Unable to complete request' })
  })

  it('reports health', async () => {
    const app = createApp(createMemorySpecStore())

    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true })
  })

  it('lists seeded product specs', async () => {
    const app = createApp(createMemorySpecStore())

    const response = await request(app).get('/api/specs')

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(seedSpecs.length)
    expect(response.body[0].title).toBe('Spec intake dashboard')
  })

  it('creates a validated spec', async () => {
    const app = createApp(createMemorySpecStore())

    const response = await request(app)
      .post('/api/specs')
      .send({
        acceptanceCriteria: ['Show a passing review state'],
        owner: 'Frontend',
        priority: 'High',
        requirement: 'The team needs to see a complete delivery checklist.',
        title: 'Delivery checklist',
      })

    expect(response.status).toBe(201)
    expect(response.body.status).toBe('Backlog')
    expect(response.body.title).toBe('Delivery checklist')
  })

  it('updates a spec status', async () => {
    const app = createApp(createMemorySpecStore())

    const response = await request(app)
      .patch('/api/specs/spec-release-checklist/status')
      .send({ status: 'In progress' })

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('In progress')
  })
})
