import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { FileUp } from 'lucide-react'
import type { ProductSpec } from '../../shared/spec'
import { formatCount } from '../utils/pluralize'
import {
  buildMergePreview,
  mergeCounts,
  specsToImport,
  type IncomingFile,
  type MergeItem,
  type MergePreview,
} from '../local/specMerge'
import { Dialog } from './Dialog'

const importLimits = { files: 200, fileBytes: 4 * 1024 * 1024, totalBytes: 16 * 1024 * 1024 } as const

type ImportDialogProps = {
  savedSpecs: ProductSpec[]
  /** Which data the import goes into. Sample data is cleared by its reset action. */
  mode: 'sample' | 'workspace'
  /** Files dropped on the page before the dialog opened. */
  initialFiles?: File[]
  onImport: (specs: ProductSpec[], summary: string) => Promise<void>
  onClose: () => void
}

function formatDay(iso: string): string {
  return iso.slice(0, 10)
}

function ItemRow({ item, overwrite, onToggle }: { item: MergeItem; overwrite: boolean; onToggle: (id: string) => void }) {
  return (
    <li className="merge-row">
      <span className="merge-title">{item.spec.title}</span>
      <span className="merge-meta">
        <span className="mono">{item.spec.id}</span>, {item.fileName}
        {item.changedFields.length > 0 && <>, changes {item.changedFields.join(', ')}</>}
      </span>
      {item.kind === 'conflict' && item.saved && (
        <>
          <span className="merge-meta">
            Saved copy updated <span className="mono">{formatDay(item.saved.updatedAt)}</span>, file updated{' '}
            <span className="mono">{formatDay(item.spec.updatedAt)}</span>.
          </span>
          <label className="merge-choice">
            <input checked={overwrite} onChange={() => onToggle(item.spec.id)} type="checkbox" />
            Replace the saved copy with this file
          </label>
        </>
      )}
    </li>
  )
}

const groups: { kind: MergeItem['kind']; heading: string }[] = [
  { kind: 'new', heading: 'New' },
  { kind: 'changed', heading: 'Changed, will replace the saved copy' },
  { kind: 'conflict', heading: 'Conflicts, the saved copy is newer' },
  { kind: 'unchanged', heading: 'Unchanged' },
]

export function ImportDialog({ savedSpecs, mode, initialFiles, onImport, onClose }: ImportDialogProps) {
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [overwrite, setOverwrite] = useState<Set<string>>(new Set())
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const hasPreview = preview !== null
  const firstRender = useRef(true)

  // The control that had focus is replaced when the step changes, so move focus to the new step.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    bodyRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [hasPreview])

  async function readFiles(files: File[]) {
    setError(null)
    setReading(true)
    const incoming: IncomingFile[] = []
    const skipped: { fileName: string; message: string }[] = []
    let total = 0
    for (const file of files.slice(0, importLimits.files)) {
      if (file.size > importLimits.fileBytes) {
        skipped.push({ fileName: file.name, message: `The file is larger than ${importLimits.fileBytes / 1024 / 1024} MiB, so it was not read` })
      } else if (total + file.size > importLimits.totalBytes) {
        skipped.push({ fileName: file.name, message: `The files together are larger than ${importLimits.totalBytes / 1024 / 1024} MiB, so this one was not read` })
      } else {
        try {
          incoming.push({ name: file.name, text: await file.text() })
          total += file.size
        } catch {
          skipped.push({ fileName: file.name, message: 'The browser could not read this file' })
        }
      }
    }
    for (const file of files.slice(importLimits.files)) {
      skipped.push({ fileName: file.name, message: `Only the first ${importLimits.files} files are read at a time` })
    }

    const merged = buildMergePreview(savedSpecs, incoming)
    setPreview({ items: merged.items, problems: [...skipped, ...merged.problems] })
    setOverwrite(new Set())
    setReading(false)
  }

  useEffect(() => {
    if (started.current || !initialFiles?.length) return
    started.current = true
    void readFiles(initialFiles)
    // Runs once, for the files that were dropped on the page before this opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function choose(files: FileList | File[] | null | undefined) {
    const list = files ? Array.from(files) : []
    if (list.length > 0) void readFiles(list)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    choose(event.dataTransfer.files)
  }

  function toggle(id: string) {
    setOverwrite((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const counts = preview ? mergeCounts(preview, overwrite) : null
  const writes = counts ? counts.added + counts.replaced : 0

  async function confirm() {
    if (!preview || !counts) return
    setImporting(true)
    setError(null)
    const parts = [`${counts.added} added`, `${counts.replaced} replaced`]
    if (counts.keptSaved > 0) parts.push(`${counts.keptSaved} kept as saved`)
    try {
      await onImport(specsToImport(preview, overwrite), `Imported ${formatCount(writes, 'spec')}: ${parts.join(', ')}.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The import failed. Nothing was changed.')
      setImporting(false)
    }
  }

  return (
    <Dialog onClose={onClose} title="Import Markdown specs" wide>
      <div ref={bodyRef}>
      {!preview ? (
        <div className="import-choose">
          <p className="dialog-text">
            Choose one or more .md files, or drop them below. Each file holds one spec, or several split by a separator line. Nothing is saved until you confirm.
          </p>
          <div
            className={dragging ? 'drop-zone dragging' : 'drop-zone'}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDrop={onDrop}
          >
            <FileUp aria-hidden="true" size={24} strokeWidth={1.5} />
            <label className="drop-label">
              Markdown files
              <input
                accept=".md,.markdown,text/markdown,text/plain"
                data-autofocus
                disabled={reading}
                multiple
                onChange={(event) => {
                  choose(event.target.files)
                  event.target.value = ''
                }}
                type="file"
              />
            </label>
            <span className="drop-hint">or drop files here</span>
          </div>
          <p aria-live="polite" className="dialog-text" role="status">
            {reading ? 'Reading files' : ''}
          </p>
        </div>
      ) : (
        <div className="import-preview">
          {mode === 'sample' && (
            <p className="dialog-text">These specs go into sample data, and Reset sample data removes them. Switch to Your workspace to keep them.</p>
          )}
          {counts && (
            <p className="merge-summary" role="status">
              Add {counts.added}, replace {counts.replaced}, keep {counts.keptSaved} as saved, skip {counts.unchanged} unchanged
              {preview.problems.length > 0 && `, ${formatCount(preview.problems.length, 'file problem')}`}.
            </p>
          )}

          {groups.map((group) => {
            const items = preview.items.filter((item) => item.kind === group.kind)
            if (items.length === 0) return null
            return (
              <section className="merge-group" key={group.kind}>
                <h3 className="doc-heading">
                  {group.heading} ({items.length})
                </h3>
                <ul className="merge-list">
                  {items.map((item) => (
                    <ItemRow item={item} key={item.spec.id} onToggle={toggle} overwrite={overwrite.has(item.spec.id)} />
                  ))}
                </ul>
              </section>
            )
          })}
          {preview.problems.length > 0 && (
            <section className="merge-group">
              <h3 className="doc-heading">Could not read ({preview.problems.length})</h3>
              <ul className="merge-list">
                {preview.problems.map((problem, index) => (
                  <li className="merge-row" key={`${problem.fileName}-${index}`}>
                    <span className="merge-title">{problem.fileName}</span>
                    <span className="merge-problem">{problem.message}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {preview.items.length === 0 && preview.problems.length === 0 && <p className="dialog-text">No specs were found in those files.</p>}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="dialog-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setPreview(null)
                setError(null)
              }}
              type="button"
            >
              Choose other files
            </button>
            <button className="btn btn-primary" data-autofocus disabled={writes === 0 || importing} onClick={() => void confirm()} type="button">
              {writes === 0 ? 'Nothing to import' : `Import ${formatCount(writes, 'spec')}`}
            </button>
          </div>
        </div>
      )}
      </div>
    </Dialog>
  )
}
