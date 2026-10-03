import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedSpecs } from '../shared/spec'
import App from './App'
import { axe } from './test/axe'

describe('SpecShip accessibility', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => seedSpecs,
      })) as unknown as typeof fetch,
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('has no violations in the list and document view', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(await screen.findByRole('button', { name: /Spec intake dashboard/ }))
    await screen.findByRole('button', { name: /^Move Spec intake dashboard/ })

    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no violations in the new spec dialog', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await screen.findByRole('button', { name: /Spec intake dashboard/ })
    await user.click(screen.getByRole('button', { name: 'New spec' }))
    await screen.findByRole('dialog', { name: 'New spec' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
