import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedSpecs, type ProductSpec, type SpecStatus } from '../shared/spec'
import App from './App'

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('SpecShip dashboard', () => {
  let specs: ProductSpec[]
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    specs = seedSpecs.map((spec) => ({ ...spec }))
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()

      if (url === '/api/specs' && !init) {
        return jsonResponse(specs)
      }

      if (url === '/api/specs' && init?.method === 'POST') {
        const inputBody = JSON.parse(init.body as string) as Omit<
          ProductSpec,
          'id' | 'status' | 'updatedAt'
        >
        const createdSpec: ProductSpec = {
          ...inputBody,
          id: 'spec-created-from-ui',
          status: 'Backlog',
          updatedAt: '2026-09-10T12:00:00.000Z',
        }
        specs = [createdSpec, ...specs]
        return jsonResponse(createdSpec, 201)
      }

      if (url.endsWith('/status') && init?.method === 'PATCH') {
        const { status } = JSON.parse(init.body as string) as {
          status: SpecStatus
        }
        const id = url.split('/').at(-2)
        const updatedSpec = specs.find((spec) => spec.id === id)

        if (!updatedSpec) {
          return jsonResponse({ error: 'Not found' }, 404)
        }

        updatedSpec.status = status
        updatedSpec.updatedAt = '2026-09-10T12:15:00.000Z'
        return jsonResponse(updatedSpec)
      }

      return jsonResponse({ error: 'Unhandled request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('filters specs by delivery status', async () => {
    const user = userEvent.setup()

    render(<App />)

    await screen.findByText('Spec intake dashboard')
    await user.click(screen.getByRole('button', { name: 'Review' }))

    const list = screen.getByLabelText('Filtered product specs')
    expect(within(list).getByText('API contract review')).toBeInTheDocument()
    expect(within(list).queryByText('Spec intake dashboard')).not.toBeInTheDocument()
  })

  it('moves a spec to the next status', async () => {
    const user = userEvent.setup()

    render(<App />)

    const moveButton = await screen.findByRole('button', {
      name: 'Move Spec intake dashboard from In progress',
    })
    await user.click(moveButton)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/specs/spec-intake-dashboard/status',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(
      await screen.findByRole('button', {
        name: 'Move Spec intake dashboard from Review',
      }),
    ).toBeInTheDocument()
  })

  it('creates a spec from the form', async () => {
    const user = userEvent.setup()

    render(<App />)

    await screen.findByText('Spec intake dashboard')
    await user.type(screen.getByLabelText('Title'), 'Mobile release notes')
    await user.type(screen.getByLabelText('Owner'), 'Platform')
    await user.selectOptions(screen.getByLabelText('Priority'), 'High')
    await user.type(
      screen.getByLabelText('Requirement'),
      'Release managers need a short summary before publishing a feature.',
    )
    await user.type(
      screen.getByLabelText('Acceptance criterion'),
      'Show publishing status and rollback notes.',
    )
    await user.click(screen.getByRole('button', { name: 'Create spec' }))

    expect(
      await screen.findByRole('heading', { name: 'Mobile release notes' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/specs',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
