import type { CreateSpecInput, ProductSpec, SpecStatus } from '../../shared/spec'

export type ApiErrorIssue = {
  path: (string | number)[]
  message: string
}

export type ApiErrorBody = {
  code: string
  error: string
  issues?: ApiErrorIssue[]
}

/**
 * Thrown whenever the API responds with a non-2xx status. Carries the same
 * `code` and `issues` fields as the server's JSON error body (see
 * docs/architecture.md#error-responses) so callers can branch on `code`
 * instead of parsing message text.
 */
export class ApiError extends Error {
  code: string
  issues?: ApiErrorIssue[]

  constructor(body: ApiErrorBody) {
    super(body.error)
    this.name = 'ApiError'
    this.code = body.code
    this.issues = body.issues
  }
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const isErrorBody =
      body !== null &&
      typeof body === 'object' &&
      'code' in body &&
      'error' in body

    throw new ApiError(
      isErrorBody
        ? (body as ApiErrorBody)
        : { code: 'UNKNOWN_ERROR', error: `Request failed with status ${response.status}` },
    )
  }

  return body as T
}

export async function fetchHealth(): Promise<{ ok: boolean }> {
  const response = await fetch('/api/health')
  return parseJsonOrThrow(response)
}

export async function listSpecs(): Promise<ProductSpec[]> {
  const response = await fetch('/api/specs')
  return parseJsonOrThrow(response)
}

export async function createSpec(input: CreateSpecInput): Promise<ProductSpec> {
  const response = await fetch('/api/specs', {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return parseJsonOrThrow(response)
}

export async function updateSpecStatus(id: string, status: SpecStatus): Promise<ProductSpec> {
  const response = await fetch(`/api/specs/${id}/status`, {
    body: JSON.stringify({ status }),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })

  return parseJsonOrThrow(response)
}
