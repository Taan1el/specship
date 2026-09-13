import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createSpec, listSpecs, updateSpecStatus } from './api'

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('live api client', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns parsed JSON on a successful response', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: 'spec-1' }]))

    await expect(listSpecs()).resolves.toEqual([{ id: 'spec-1' }])
  })

  it('throws an ApiError with the server code and issues on a validation failure', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          code: 'VALIDATION_ERROR',
          error: 'Invalid request',
          issues: [{ path: ['title'], message: 'Too short' }],
        },
        400,
      ),
    )

    await expect(
      createSpec({
        acceptanceCriteria: ['x'],
        owner: 'ab',
        priority: 'Low',
        requirement: 'short',
        title: 'x',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      issues: [{ path: ['title'], message: 'Too short' }],
    })
  })

  it('throws an ApiError for a not-found status update', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: 'SPEC_NOT_FOUND', error: 'Spec not found' }, 404),
    )

    await expect(updateSpecStatus('missing', 'Review')).rejects.toBeInstanceOf(ApiError)
  })

  it('falls back to a generic error when the error body is not JSON shaped', async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, 500))

    await expect(listSpecs()).rejects.toMatchObject({ code: 'UNKNOWN_ERROR' })
  })

  it('propagates network failures instead of wrapping them in an ApiError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(listSpecs()).rejects.toBeInstanceOf(TypeError)
  })
})
