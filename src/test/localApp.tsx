import { IDBFactory } from 'fake-indexeddb'
import type { ComponentType } from 'react'
import { vi } from 'vitest'

type LoadOptions = {
  /** Text to put in the saved sample data before the app starts. */
  sampleStorage?: string
  /** A record to save as Your workspace, with workspace selected, before the app starts. */
  workspaceRecord?: unknown
}

/**
 * Loads a fresh copy of the app as the browser build runs it: demo mode on, an empty IndexedDB and
 * localStorage, and no server. Every call starts from nothing, so tests do not share saved data.
 */
export async function loadLocalApp(options: LoadOptions = {}): Promise<ComponentType> {
  vi.resetModules()
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('The browser build must not make network requests.')
  }))
  window.localStorage.clear()

  if (options.sampleStorage !== undefined) {
    window.localStorage.setItem('specship:demo:v1', options.sampleStorage)
  }
  if (options.workspaceRecord !== undefined) {
    const storage = await import('../local/workspace')
    await storage.saveWorkspace(options.workspaceRecord, { mode: 'workspace' })
  }

  const module = await import('../App')
  return module.default
}

/** Downloads made through the helper are captured here instead of leaving the test. */
export function captureDownloads() {
  const downloads: { name: string; blob: Blob }[] = []
  const blobs = new Map<string, Blob>()
  let counter = 0
  Object.assign(URL, {
    createObjectURL: (blob: Blob) => {
      const url = `blob:test/${counter++}`
      blobs.set(url, blob)
      return url
    },
    revokeObjectURL: () => undefined,
  })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, blob: blobs.get(this.href)! })
  })
  return { downloads, restore: () => click.mockRestore() }
}

export function markdownFile(name: string, text: string): File {
  return new File([text], name, { type: 'text/markdown' })
}
