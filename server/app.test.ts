import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { seedSpecs } from '../shared/spec.js'
import { createApp } from './app.js'
import { createMemorySpecStore } from './specStore.js'

describe('SpecShip API', () => {
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
