import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedSpecs } from '../shared/spec'
import App from './App'
import appCss from './App.css?raw'
import indexCss from './index.css?raw'

// Class selectors whose rule lets content scroll sideways (overflow or overflow-x set to auto or scroll).
function sidewaysScrollSelectors(css: string): string[] {
  const selectors: string[] = []
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/overflow(-x)?\s*:\s*(auto|scroll)/.test(body)) {
      selectors.push(...selector.split(',').map((part) => part.trim()).filter((part) => /^[.#]?[\w-]+$/.test(part)))
    }
  }
  return selectors
}

function expectScrollRegionsLabelled(container: HTMLElement) {
  const selectors = [...sidewaysScrollSelectors(appCss), ...sidewaysScrollSelectors(indexCss)]
  for (const selector of selectors) {
    for (const element of container.querySelectorAll(selector)) {
      expect(element.getAttribute('role'), selector).toBe('region')
      expect(element.getAttribute('tabindex'), selector).toBe('0')
      expect(element.getAttribute('aria-label')?.trim(), selector).toBeTruthy()
    }
  }
}

describe('Scrollable regions', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => seedSpecs })) as unknown as typeof fetch,
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('labels and focuses every sideways scroll container in the list and document view', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(await screen.findByRole('button', { name: /Spec intake dashboard/ }))
    await screen.findByRole('button', { name: /^Move Spec intake dashboard/ })
    expectScrollRegionsLabelled(container)
  })

  it('labels and focuses every sideways scroll container in the new spec dialog', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await screen.findByRole('button', { name: /Spec intake dashboard/ })
    await user.click(screen.getByRole('button', { name: 'New spec' }))
    await screen.findByRole('dialog', { name: 'New spec' })
    expectScrollRegionsLabelled(container)
  })
})
