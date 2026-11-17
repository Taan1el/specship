import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedSpecs, type ProductSpec } from '../shared/spec'
import { combinedSeparator, serializeCombined, serializeSpecMarkdown } from './local/specMarkdown'
import { captureDownloads, loadLocalApp, markdownFile } from './test/localApp'

let App: ComponentType
let downloads: ReturnType<typeof captureDownloads>

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

async function openSpec(title: string) {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${title}`) }))
}

async function startWorkspace() {
  await screen.findByRole('button', { name: /^Spec intake dashboard/ })
  await userEvent.click(screen.getByRole('button', { name: 'Your workspace' }))
  await screen.findByText(/Your workspace has no specs yet/)
}

async function createWorkspaceSpec(title: string) {
  await userEvent.click(screen.getByRole('button', { name: 'New spec' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), title)
  await userEvent.type(screen.getByRole('textbox', { name: 'Owner' }), 'Platform')
  await userEvent.type(screen.getByRole('textbox', { name: 'Requirement' }), 'A requirement long enough to pass.')
  await userEvent.type(screen.getByRole('textbox', { name: 'Acceptance criterion' }), 'It works')
  await userEvent.click(screen.getByRole('button', { name: 'Create spec' }))
  await screen.findByRole('heading', { name: title, level: 2 })
}

beforeEach(async () => {
  App = await loadLocalApp()
  downloads = captureDownloads()
  window.print = vi.fn()
})

afterEach(() => {
  cleanup()
  downloads.restore()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('data source and the local note', () => {
  it('says where the data is, offers both sources and keeps Reset to sample data', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /^Spec intake dashboard/ })

    expect(screen.getByText(/Sample data: specs stay in this browser and nothing is uploaded/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sample data' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Reset sample data' })).toBeInTheDocument()
    expect(screen.getByText(/does not sync between browsers or connect to an issue tracker/)).toBeInTheDocument()
  })

  it('starts Your workspace empty, hides the sample reset and keeps the workspace across a reload', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startWorkspace()

    expect(screen.getByText(/Your workspace: specs stay in this browser and nothing is uploaded/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset sample data' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Spec intake dashboard/ })).not.toBeInTheDocument()

    await createWorkspaceSpec('Workspace spec')
    cleanup()
    // A reload keeps the same browser storage.
    const storage = globalThis.indexedDB
    vi.resetModules()
    vi.stubGlobal('indexedDB', storage)
    const Reloaded = (await import('./App')).default
    render(<Reloaded />)
    expect(await screen.findByRole('button', { name: /^Workspace spec/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Your workspace' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Sample data' }))
    expect(await screen.findByRole('button', { name: /^Spec intake dashboard/ })).toBeInTheDocument()
  })
})

describe('acceptance criteria', () => {
  it('ticks criteria, suggests the next status once all are ticked, and does not move the spec by itself', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSpec('Release checklist')

    const boxes = await screen.findAllByRole('checkbox')
    expect(boxes).toHaveLength(3)
    expect(screen.getByText('0 of 3 ticked')).toBeInTheDocument()

    await user.click(boxes[0])
    await user.click(screen.getAllByRole('checkbox')[1])
    expect(screen.getByText('2 of 3 ticked')).toBeInTheDocument()
    expect(screen.queryByText(/All acceptance criteria are ticked/)).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('checkbox')[2])
    expect(await screen.findByText(/All acceptance criteria are ticked. This spec could move to In progress./)).toBeInTheDocument()
    // Still in Backlog: the note only suggests.
    expect(within(screen.getByRole('article')).getByText('Backlog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Move to In progress' }))
    await waitFor(() => expect(within(screen.getByRole('article')).getByText('In progress')).toBeInTheDocument())
  })

  it('keeps ticked criteria after a reload of the saved data', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSpec('Release checklist')
    await user.click((await screen.findAllByRole('checkbox'))[1])
    await screen.findByText('1 of 3 ticked')

    const saved = JSON.parse(window.localStorage.getItem('specship:demo:v1') ?? '[]') as ProductSpec[]
    expect(saved.find((spec) => spec.id === 'spec-release-checklist')?.criteriaDone).toEqual([false, true, false])
  })
})

describe('editing a spec', () => {
  it('saves a changed title, status, owner and criteria list', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSpec('Release checklist')
    await user.click(await screen.findByRole('button', { name: 'Edit Release checklist' }))

    const dialog = await screen.findByRole('dialog', { name: 'Edit spec' })
    expect(within(dialog).getByRole('textbox', { name: 'Title' })).toHaveFocus()
    await user.clear(within(dialog).getByRole('textbox', { name: 'Title' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Release gate')
    await user.clear(within(dialog).getByRole('textbox', { name: 'Owner (optional)' }))
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Status' }), 'Review')
    await user.click(within(dialog).getByRole('button', { name: 'Remove criterion 3' }))
    await user.click(within(dialog).getByRole('button', { name: 'Add criterion' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Criterion 3' }), 'Notify the team')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const article = screen.getByRole('article')
    expect(within(article).getByRole('heading', { name: 'Release gate', level: 2 })).toBeInTheDocument()
    expect(within(article).getByText('Review')).toBeInTheDocument()
    expect(within(article).getByText('No owner')).toBeInTheDocument()
    expect(within(article).getByText('Notify the team')).toBeInTheDocument()
    expect(within(article).getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Edit Release gate' })).toHaveFocus()
  })

  it('keeps ticked criteria on the rows that stay', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSpec('Release checklist')
    await user.click((await screen.findAllByRole('checkbox'))[2])
    await screen.findByText('1 of 3 ticked')
    await user.click(screen.getByRole('button', { name: 'Edit Release checklist' }))
    await user.click(await screen.findByRole('button', { name: 'Remove criterion 1' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByText('1 of 2 ticked')
    expect(screen.getAllByRole('checkbox').map((box) => (box as HTMLInputElement).checked)).toEqual([false, true])
  })

  it('shows a problem, focuses the field and saves nothing', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSpec('Release checklist')
    await user.click(await screen.findByRole('button', { name: 'Edit Release checklist' }))

    const title = await screen.findByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'ab')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Title must be 3 to 200 characters.')
    expect(title).toHaveFocus()
    expect(title).toHaveAttribute('aria-invalid', 'true')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByRole('heading', { name: 'Release checklist', level: 2 })).toBeInTheDocument()
  })

  it('refuses a requirement line that would break the Markdown file', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSpec('Release checklist')
    await user.click(await screen.findByRole('button', { name: 'Edit Release checklist' }))

    const requirement = await screen.findByRole('textbox', { name: 'Requirement' })
    await user.clear(requirement)
    await user.type(requirement, 'Some intro text.{Enter}## Acceptance criteria')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('cannot contain a line that reads "## Acceptance criteria"')
    expect(requirement).toHaveFocus()
  })
})

describe('deleting a spec', () => {
  it('asks first, keeps the spec on cancel, and moves focus to the list when it is deleted', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSpec('Release checklist')
    await user.click(await screen.findByRole('button', { name: 'Delete Release checklist' }))

    const dialog = await screen.findByRole('dialog', { name: 'Delete this spec?' })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(dialog).toHaveTextContent('"Release checklist" will be removed from the sample data. This cannot be undone.')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Release checklist/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Release checklist' }))
    await user.click(await screen.findByRole('button', { name: 'Delete spec' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: /^Release checklist/ })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Specs by delivery status' })).toHaveFocus()
    expect(screen.getByText('Deleted "Release checklist".')).toBeInTheDocument()
    const saved = JSON.parse(window.localStorage.getItem('specship:demo:v1') ?? '[]') as ProductSpec[]
    expect(saved.map((spec) => spec.id)).not.toContain('spec-release-checklist')
  })
})

describe('importing Markdown', () => {
  const incoming = [
    markdownFile('new.md', serializeSpecMarkdown({ ...seedSpecs[0], id: 'brand-new', title: 'Brand new spec' })),
    markdownFile('changed.md', serializeSpecMarkdown({ ...seedSpecs[1], title: 'Release gate v2', updatedAt: '2026-10-01T00:00:00.000Z' })),
    markdownFile('same.md', serializeSpecMarkdown(seedSpecs[2])),
    markdownFile('conflict.md', serializeSpecMarkdown({ ...seedSpecs[0], title: 'Older edit', updatedAt: '2026-08-01T00:00:00.000Z' })),
    markdownFile('broken.md', 'This is not a spec.'),
  ]

  async function openImport() {
    await screen.findByRole('button', { name: /^Spec intake dashboard/ })
    await userEvent.click(screen.getByRole('button', { name: 'Import Markdown' }))
    return screen.findByRole('dialog', { name: 'Import Markdown specs' })
  }

  it('shows new, changed, unchanged and conflicting specs and the files it could not read, before saving anything', async () => {
    const user = userEvent.setup()
    render(<App />)
    const dialog = await openImport()
    await user.upload(within(dialog).getByLabelText('Markdown files'), incoming)

    expect(await within(dialog).findByText(/Add 1, replace 1, keep 1 as saved, skip 1 unchanged, 1 file problem/)).toBeInTheDocument()
    for (const heading of ['New (1)', 'Changed, will replace the saved copy (1)', 'Conflicts, the saved copy is newer (1)', 'Unchanged (1)', 'Could not read (1)']) {
      expect(within(dialog).getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(within(dialog).getByText('Brand new spec')).toBeInTheDocument()
    expect(within(dialog).getAllByText(/changes title/)).toHaveLength(2)
    expect(within(dialog).getByText(/Saved copy updated/)).toHaveTextContent('2026-09-10')
    expect(within(dialog).getByText(/^Line 1: A spec file starts with/)).toBeInTheDocument()
    expect(within(dialog).getByRole('checkbox', { name: 'Replace the saved copy with this file' })).not.toBeChecked()
    expect(within(dialog).getByRole('button', { name: 'Import 2 specs' })).toHaveFocus()

    // Cancel: nothing was written.
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('button', { name: /^Brand new spec/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Release checklist/ })).toBeInTheDocument()
  })

  it('imports what was confirmed, including a chosen conflict, and says what happened', async () => {
    const user = userEvent.setup()
    render(<App />)
    const dialog = await openImport()
    await user.upload(within(dialog).getByLabelText('Markdown files'), incoming)
    await within(dialog).findByText(/Add 1, replace 1/)

    await user.click(within(dialog).getByRole('checkbox', { name: 'Replace the saved copy with this file' }))
    expect(within(dialog).getByText(/Add 1, replace 2, keep 0 as saved/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Import 3 specs' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Imported 3 specs: 1 added, 2 replaced.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Brand new spec/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Release gate v2/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Older edit/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Spec intake dashboard/ })).not.toBeInTheDocument()
  })

  it('keeps the saved copy of a conflict when it is not chosen', async () => {
    const user = userEvent.setup()
    render(<App />)
    const dialog = await openImport()
    await user.upload(within(dialog).getByLabelText('Markdown files'), incoming)
    await user.click(await within(dialog).findByRole('button', { name: 'Import 2 specs' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /^Spec intake dashboard/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Older edit/ })).not.toBeInTheDocument()
  })

  it('reads every spec in a combined file', async () => {
    const user = userEvent.setup()
    render(<App />)
    const dialog = await openImport()
    const combined = serializeCombined([
      { ...seedSpecs[0], id: 'one', title: 'Imported one' },
      { ...seedSpecs[0], id: 'two', title: 'Imported two' },
    ])
    expect(combined).toContain(combinedSeparator)
    await user.upload(within(dialog).getByLabelText('Markdown files'), markdownFile('all.md', combined))
    await user.click(await within(dialog).findByRole('button', { name: 'Import 2 specs' }))

    expect(await screen.findByRole('button', { name: /^Imported one/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Imported two/ })).toBeInTheDocument()
  })

  it('accepts files dropped in the dialog', async () => {
    render(<App />)
    const dialog = await openImport()
    const zone = within(dialog).getByText('or drop files here').parentElement as HTMLElement
    fireEvent.drop(zone, { dataTransfer: { files: [incoming[0]], types: ['Files'] } })
    expect(await within(dialog).findByText(/Add 1, replace 0/)).toBeInTheDocument()
  })

  it('opens the preview when files are dropped anywhere on the page', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /^Spec intake dashboard/ })
    fireEvent.drop(document.body, { dataTransfer: { files: [incoming[0]], types: ['Files'] } })

    const dialog = await screen.findByRole('dialog', { name: 'Import Markdown specs' })
    expect(await within(dialog).findByText(/Add 1, replace 0/)).toBeInTheDocument()
  })

  it('tells the person that sample data is cleared by its reset', async () => {
    render(<App />)
    const dialog = await openImport()
    await userEvent.upload(within(dialog).getByLabelText('Markdown files'), incoming[0])
    expect(await within(dialog).findByText(/These specs go into sample data/)).toBeInTheDocument()
  })

  it('keeps focus inside when there is nothing to import, and Escape still closes the dialog', async () => {
    const user = userEvent.setup()
    render(<App />)
    const dialog = await openImport()
    await user.upload(within(dialog).getByLabelText('Markdown files'), incoming[4])

    expect(await within(dialog).findByRole('button', { name: 'Nothing to import' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Choose other files' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import Markdown' })).toHaveFocus()
  })

  it('reads files over the size limit as a problem instead of loading them', async () => {
    render(<App />)
    const dialog = await openImport()
    const big = markdownFile('big.md', 'x')
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 })
    await userEvent.upload(within(dialog).getByLabelText('Markdown files'), big)
    expect(await within(dialog).findByText(/larger than 4 MiB/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Nothing to import' })).toBeDisabled()
  })
})

describe('exporting and printing', () => {
  it('downloads one spec as Markdown named by its id', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSpec('Spec intake dashboard')
    await user.click(await screen.findByRole('button', { name: 'Export .md' }))

    expect(downloads.downloads).toHaveLength(1)
    expect(downloads.downloads[0].name).toBe('spec-intake-dashboard.md')
    expect(await readBlob(downloads.downloads[0].blob)).toBe(serializeSpecMarkdown(seedSpecs[0]))
  })

  it('downloads every spec as one zip with one file each, and as one combined file', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: /^Spec intake dashboard/ })

    await user.click(screen.getByRole('button', { name: 'Download all (.zip)' }))
    const zip = downloads.downloads[0]
    expect(zip.name).toMatch(/^specship-specs-\d{4}-\d{2}-\d{2}\.zip$/)
    expect(zip.blob.type).toBe('application/zip')
    const bytes = await readBytes(zip.blob)
    const view = new DataView(bytes.buffer)
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50)
    expect(view.getUint16(bytes.length - 22 + 10, true)).toBe(seedSpecs.length)

    await user.click(screen.getByRole('button', { name: 'Download one .md file' }))
    const combined = await readBlob(downloads.downloads[1].blob)
    expect(downloads.downloads[1].name).toMatch(/^specship-specs-\d{4}-\d{2}-\d{2}\.md$/)
    expect(combined.split(combinedSeparator)).toHaveLength(seedSpecs.length)
    expect(screen.getByText(/Downloaded 3 specs as one Markdown file/)).toBeInTheDocument()
  })

  it('reminds the person to keep a backup after a change and stops once everything was downloaded', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startWorkspace()
    expect(screen.queryByText(/saved only in this browser/)).not.toBeInTheDocument()

    await createWorkspaceSpec('Workspace spec')
    expect(await screen.findByText(/1 spec saved only in this browser, with changes not yet in a file/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Download all (.zip)' }))
    await waitFor(() => expect(screen.queryByText(/saved only in this browser/)).not.toBeInTheDocument())
  })

  it('opens the print dialog for the spec in view', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openSpec('Spec intake dashboard')
    await user.click(await screen.findByRole('button', { name: 'Print or save PDF' }))
    expect(window.print).toHaveBeenCalledOnce()
    expect(document.querySelector('.print-footer')).toHaveTextContent('spec id spec-intake-dashboard')
  })

  it('says so when a spec cannot be written as Markdown', async () => {
    const user = userEvent.setup()
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'New spec' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), 'Odd requirement')
    await userEvent.type(screen.getByRole('textbox', { name: 'Owner' }), 'Platform')
    fireEvent.change(screen.getByRole('textbox', { name: 'Requirement' }), { target: { value: 'Intro text here.\n## Acceptance criteria' } })
    await userEvent.type(screen.getByRole('textbox', { name: 'Acceptance criterion' }), 'It works')
    await userEvent.click(screen.getByRole('button', { name: 'Create spec' }))
    await screen.findByRole('heading', { name: 'Odd requirement', level: 2 })

    await user.click(screen.getByRole('button', { name: 'Export .md' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Reword that line before exporting')
    expect(downloads.downloads).toHaveLength(0)
  })
})

describe('saved data that cannot be used', () => {
  it('leaves out invalid sample specs and tells the person', async () => {
    cleanup()
    App = await loadLocalApp({ sampleStorage: JSON.stringify([seedSpecs[0], { ...seedSpecs[1], status: 'Done' }]) })
    render(<App />)

    expect(await screen.findByRole('button', { name: /^Spec intake dashboard/ })).toBeInTheDocument()
    expect(await screen.findByText(/1 saved sample spec could not be read and was left out/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText(/could not be read/)).not.toBeInTheDocument()
  })

  it('explains an unreadable workspace and clears it on request', async () => {
    cleanup()
    App = await loadLocalApp({ workspaceRecord: { version: 1, unbacked: false, specs: [{ broken: true }] } })
    const user = userEvent.setup()
    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The saved workspace in this browser cannot be read (spec 1, ')
    expect(screen.queryByRole('button', { name: 'Import Markdown' })).not.toBeInTheDocument()
    expect(screen.getByText('The saved workspace cannot be read. See the message above.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear workspace' }))
    const dialog = await screen.findByRole('dialog', { name: 'Clear your workspace?' })
    expect(dialog).toHaveTextContent('which cannot be read')
    await user.click(within(dialog).getByRole('button', { name: 'Clear workspace' }))

    await screen.findByText(/Your workspace has no specs yet/)
    expect(screen.queryByText(/cannot be read/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import Markdown' })).toBeInTheDocument()
    expect(screen.getByText('Workspace cleared.')).toBeInTheDocument()
  })

  it('asks before clearing a workspace and says how many specs go', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startWorkspace()
    await createWorkspaceSpec('Workspace spec')

    await user.click(screen.getByRole('button', { name: 'Clear workspace' }))
    const dialog = await screen.findByRole('dialog', { name: 'Clear your workspace?' })
    expect(dialog).toHaveTextContent('This removes 1 spec saved in this browser. It cannot be undone.')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: /^Workspace spec/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear workspace' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clear workspace' }))
    await screen.findByText(/Your workspace has no specs yet/)
  })
})

describe('the browser build makes no network requests', () => {
  it('works through create, edit, import and export without calling fetch', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startWorkspace()
    await createWorkspaceSpec('Workspace spec')
    await user.click(screen.getByRole('button', { name: 'Edit Workspace spec' }))
    await user.click(await screen.findByRole('button', { name: 'Save changes' }))
    await user.click(screen.getByRole('button', { name: 'Export .md' }))
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
