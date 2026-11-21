import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
  async function openSpec(title: string) {
    const row = await screen.findByRole('button', { name: new RegExp(title) })
    await userEvent.click(row)
  }

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

    await screen.findByRole('button', { name: /Spec intake dashboard/ })
    await user.click(screen.getByRole('button', { name: 'Review' }))

    const list = screen.getByLabelText('Filtered product specs')
    expect(within(list).getByText('API contract review')).toBeInTheDocument()
    expect(within(list).queryByText('Spec intake dashboard')).not.toBeInTheDocument()
  })

  it('moves a spec to the next status', async () => {
    const user = userEvent.setup()

    render(<App />)

    await openSpec('Spec intake dashboard')
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

    await openSpec('Spec intake dashboard')
    await user.click(screen.getByRole('button', { name: 'New spec' }))
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

  it('rejects whitespace-only criteria and trims submitted fields', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'New spec' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Release notes  ' } })
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: '  Platform  ' } })
    fireEvent.change(screen.getByLabelText('Requirement'), { target: { value: '  Show updates  ' } })
    fireEvent.change(screen.getByLabelText('Acceptance criterion'), { target: { value: '   ' } })
    await user.click(screen.getByRole('button', { name: 'Create spec' }))

    expect(screen.getByLabelText('Acceptance criterion')).toHaveFocus()
    expect(screen.getByLabelText('Acceptance criterion')).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).not.toHaveBeenCalledWith('/api/specs', expect.objectContaining({ method: 'POST' }))

    fireEvent.change(screen.getByLabelText('Acceptance criterion'), { target: { value: '  Show rollback steps  ' } })
    await user.click(screen.getByRole('button', { name: 'Create spec' }))
    expect(await screen.findByRole('heading', { name: 'Release notes' })).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/specs' && init?.method === 'POST')
    expect(JSON.parse(post?.[1]?.body as string)).toMatchObject({
      title: 'Release notes', owner: 'Platform', requirement: 'Show updates',
      acceptanceCriteria: ['Show rollback steps'],
    })
  })

  it('keeps intake fields within the API length limits', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'New spec' }))

    expect(screen.getByLabelText('Title')).toHaveAttribute('maxlength', '200')
    expect(screen.getByLabelText('Owner')).toHaveAttribute('maxlength', '100')
    expect(screen.getByLabelText('Requirement')).toHaveAttribute('maxlength', '5000')
    expect(screen.getByLabelText('Acceptance criterion')).toHaveAttribute('maxlength', '500')

    const title = screen.getByLabelText('Title') as HTMLInputElement
    await user.type(title, 'a'.repeat(201))
    expect(title.value).toHaveLength(200)
    expect(screen.getByText('200 / 200 characters')).toBeInTheDocument()

    const owner = screen.getByLabelText('Owner') as HTMLInputElement
    await user.click(owner)
    await user.paste('b'.repeat(120))
    expect(owner.value).toHaveLength(100)
    expect(screen.getByText('100 / 100 characters')).toBeInTheDocument()
    expect(owner).toHaveAccessibleDescription('100 / 100 characters')
  })

  it('announces remaining space only near a field limit', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'New spec' }))

    const owner = screen.getByLabelText('Owner')
    fireEvent.change(owner, { target: { value: 'a'.repeat(79) } })
    expect(screen.queryByText('21 characters remaining')).not.toBeInTheDocument()
    fireEvent.change(owner, { target: { value: 'a'.repeat(80) } })
    expect(screen.getByText('20 characters remaining')).toHaveAttribute('aria-live', 'polite')
    fireEvent.change(owner, { target: { value: 'a'.repeat(100) } })
    expect(screen.getByText('0 characters remaining')).toBeInTheDocument()
  })

  it('shows the server validation error instead of faking a saved spec', async () => {
    const user = userEvent.setup()

    render(<App />)
    await openSpec('Spec intake dashboard')

    fetchMock.mockImplementationOnce(async () =>
      jsonResponse(
        {
          code: 'VALIDATION_ERROR',
          error: 'Invalid request',
          issues: [{ path: ['owner'], message: 'Owner is too short' }],
        },
        400,
      ),
    )

    await user.click(screen.getByRole('button', { name: 'New spec' }))
    await user.type(screen.getByLabelText('Title'), 'Mobile release notes')
    await user.type(screen.getByLabelText('Owner'), 'Platform')
    await user.type(
      screen.getByLabelText('Requirement'),
      'Release managers need a short summary before publishing a feature.',
    )
    await user.type(
      screen.getByLabelText('Acceptance criterion'),
      'Show publishing status and rollback notes.',
    )
    await user.click(screen.getByRole('button', { name: 'Create spec' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Owner is too short')
    expect(screen.getByLabelText('Owner')).toHaveFocus()
    expect(screen.getByLabelText('Owner')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Owner')).toHaveAttribute('aria-describedby', 'owner-count form-error')
    expect(
      screen.queryByRole('heading', { name: 'Mobile release notes' }),
    ).not.toBeInTheDocument()
  })

  it('focuses the first missing field after an invalid submission', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'New spec' }))
    await user.click(screen.getByRole('button', { name: 'Create spec' }))
    expect(screen.getByLabelText('Title')).toHaveFocus()
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-describedby', 'title-count form-error')
    await user.type(screen.getByLabelText('Title'), 'Release notes')
    await user.click(screen.getByRole('button', { name: 'Create spec' }))
    expect(screen.getByLabelText('Owner')).toHaveFocus()
    expect(screen.getByLabelText('Owner')).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).not.toHaveBeenCalledWith('/api/specs', expect.objectContaining({ method: 'POST' }))
  })

  it('focuses the error when the API rejection has no field issue', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSpec('Spec intake dashboard')
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ code: 'SPEC_CONFLICT', error: 'A spec with this title already exists' }, 409),
    )

    await user.click(screen.getByRole('button', { name: 'New spec' }))
    await user.type(screen.getByLabelText('Title'), 'Mobile release notes')
    await user.type(screen.getByLabelText('Owner'), 'Platform')
    await user.type(screen.getByLabelText('Requirement'), 'Summarize release changes.')
    await user.type(screen.getByLabelText('Acceptance criterion'), 'Show the summary.')
    await user.click(screen.getByRole('button', { name: 'Create spec' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A spec with this title already exists')
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('keeps an unsaved spec in the form when the API cannot be reached', async () => {
    const user = userEvent.setup()

    render(<App />)
    await openSpec('Spec intake dashboard')

    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError('Failed to fetch')
    })

    await user.click(screen.getByRole('button', { name: 'New spec' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Offline release notes  ' } })
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: '  Platform  ' } })
    fireEvent.change(screen.getByLabelText('Requirement'), {
      target: { value: '  Summarize release changes.  ' },
    })
    fireEvent.change(screen.getByLabelText('Acceptance criterion'), {
      target: { value: '  Show rollback notes.  ' },
    })
    await user.click(screen.getByRole('button', { name: 'Create spec' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the spec')
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await screen.findByText('Offline')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('  Offline release notes  ')
    expect(screen.getByLabelText('Requirement')).toHaveValue('  Summarize release changes.  ')
    expect(screen.getByLabelText('Acceptance criterion')).toHaveValue('  Show rollback notes.  ')
    expect(screen.queryByRole('heading', { name: 'Offline release notes' })).not.toBeInTheDocument()
  })

  it('keeps the form open when a successful create response is unreadable', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSpec('Spec intake dashboard')
    fetchMock.mockImplementationOnce(async () => ({
      ok: true, status: 201, json: async () => { throw new SyntaxError('Invalid JSON') },
    } as unknown as Response))

    await user.click(screen.getByRole('button', { name: 'New spec' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Release notes' } })
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: 'Platform' } })
    fireEvent.change(screen.getByLabelText('Requirement'), { target: { value: 'Summarize changes' } })
    fireEvent.change(screen.getByLabelText('Acceptance criterion'), { target: { value: 'Show status' } })
    await user.click(screen.getByRole('button', { name: 'Create spec' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('unreadable response')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Release notes' })).not.toBeInTheDocument()
  })

  it('shows an error and keeps the status when the API rejects a move', async () => {
    const user = userEvent.setup()

    render(<App />)
    await openSpec('Spec intake dashboard')
    const moveButton = await screen.findByRole('button', {
      name: 'Move Spec intake dashboard from In progress',
    })

    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ code: 'SPEC_NOT_FOUND', error: 'Spec not found' }, 404),
    )

    await user.click(moveButton)

    expect(await screen.findByRole('alert')).toHaveTextContent('Spec not found')
    expect(
      screen.getByRole('button', { name: 'Move Spec intake dashboard from In progress' }),
    ).toBeInTheDocument()
  })

  it('falls back to a local status change when the move request cannot reach the API', async () => {
    const user = userEvent.setup()

    render(<App />)
    await openSpec('Spec intake dashboard')
    const moveButton = await screen.findByRole('button', {
      name: 'Move Spec intake dashboard from In progress',
    })

    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError('Failed to fetch')
    })

    await user.click(moveButton)

    expect(
      await screen.findByRole('button', { name: 'Move Spec intake dashboard from Review' }),
    ).toBeInTheDocument()
  })

  it('keeps the current status when a successful move response is unreadable', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSpec('Spec intake dashboard')
    fetchMock.mockImplementationOnce(async () => ({
      ok: true, status: 200, json: async () => { throw new SyntaxError('Invalid JSON') },
    } as unknown as Response))

    await user.click(screen.getByRole('button', { name: 'Move Spec intake dashboard from In progress' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('unreadable response')
    expect(screen.getByRole('button', { name: 'Move Spec intake dashboard from In progress' })).toBeInTheDocument()
  })

  it('shows the first spec as a document and opens another from the list', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Release checklist' }),
    ).toBeInTheDocument()

    await openSpec('API contract review')

    expect(
      screen.getByRole('heading', { level: 2, name: 'API contract review' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Acceptance criteria' })).toBeInTheDocument()
  })

  it('closes the new spec dialog with Escape and returns focus to the opener', async () => {
    const user = userEvent.setup()

    render(<App />)
    await screen.findByRole('button', { name: /Spec intake dashboard/ })

    const opener = screen.getByRole('button', { name: 'New spec' })
    await user.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'New spec' })
    expect(within(dialog).getByLabelText('Title')).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})
