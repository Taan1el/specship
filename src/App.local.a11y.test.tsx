import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedSpecs } from '../shared/spec'
import { serializeSpecMarkdown } from './local/specMarkdown'
import { axe } from './test/axe'
import { loadLocalApp, markdownFile } from './test/localApp'

let App: ComponentType

beforeEach(async () => {
  App = await loadLocalApp()
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

async function openSpec() {
  await userEvent.click(await screen.findByRole('button', { name: /^Release checklist/ }))
  await screen.findByRole('button', { name: 'Edit Release checklist' })
}

describe('browser build accessibility', () => {
  it('has no violations in the data source bar and the checklist view', async () => {
    const { container } = render(<App />)
    await openSpec()
    await userEvent.click(screen.getAllByRole('checkbox')[0])
    await screen.findByText('1 of 3 ticked')

    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no violations when every criterion is ticked and a move is suggested', async () => {
    const { container } = render(<App />)
    await openSpec()
    for (const box of screen.getAllByRole('checkbox')) {
      await userEvent.click(box)
    }
    await screen.findByText(/All acceptance criteria are ticked/)

    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no violations in the edit dialog, with and without a problem', async () => {
    const { container } = render(<App />)
    await openSpec()
    await userEvent.click(screen.getByRole('button', { name: 'Edit Release checklist' }))
    await screen.findByRole('dialog', { name: 'Edit spec' })
    expect(await axe(container)).toHaveNoViolations()

    const title = screen.getByRole('textbox', { name: 'Title' })
    await userEvent.clear(title)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByRole('alert')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no violations in the delete confirmation', async () => {
    const { container } = render(<App />)
    await openSpec()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Release checklist' }))
    await screen.findByRole('dialog', { name: 'Delete this spec?' })

    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no violations in the import dialog before and after files are chosen', async () => {
    const { container } = render(<App />)
    await screen.findByRole('button', { name: /^Release checklist/ })
    await userEvent.click(screen.getByRole('button', { name: 'Import Markdown' }))
    const dialog = await screen.findByRole('dialog', { name: 'Import Markdown specs' })
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.upload(within(dialog).getByLabelText('Markdown files'), [
      markdownFile('new.md', serializeSpecMarkdown({ ...seedSpecs[0], id: 'brand-new', title: 'Brand new spec' })),
      markdownFile('changed.md', serializeSpecMarkdown({ ...seedSpecs[1], title: 'Release gate v2', updatedAt: '2026-10-01T00:00:00.000Z' })),
      markdownFile('same.md', serializeSpecMarkdown(seedSpecs[2])),
      markdownFile('conflict.md', serializeSpecMarkdown({ ...seedSpecs[0], title: 'Older edit', updatedAt: '2026-08-01T00:00:00.000Z' })),
      markdownFile('broken.md', 'Not a spec'),
    ])
    await within(dialog).findByText(/Add 1, replace 1/)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no violations for an unreadable workspace and the clear confirmation', async () => {
    cleanup()
    App = await loadLocalApp({ workspaceRecord: { version: 1, unbacked: false, specs: [{ broken: true }] } })
    const { container } = render(<App />)
    await screen.findByRole('alert')
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.click(screen.getByRole('button', { name: 'Clear workspace' }))
    await screen.findByRole('dialog', { name: 'Clear your workspace?' })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no violations in a workspace with a backup reminder', async () => {
    cleanup()
    App = await loadLocalApp({
      workspaceRecord: { version: 1, unbacked: true, specs: [{ ...seedSpecs[0], criteriaDone: [false, false, false] }] },
    })
    const { container } = render(<App />)
    await screen.findByText(/saved only in this browser/)

    expect(await axe(container)).toHaveNoViolations()
  })
})
