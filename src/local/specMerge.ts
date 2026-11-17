import { criteriaState, type ProductSpec } from '../../shared/spec'
import { parseSpecDocuments } from './specMarkdown'

export type IncomingFile = { name: string; text: string }

/**
 * new: the id is not saved yet. unchanged: the saved copy has the same content.
 * changed: the content differs and the file is at least as new as the saved copy.
 * conflict: the content differs and the saved copy was updated after the file.
 */
export type MergeKind = 'new' | 'changed' | 'unchanged' | 'conflict'

export type MergeItem = {
  kind: MergeKind
  fileName: string
  spec: ProductSpec
  saved?: ProductSpec
  /** Names of the fields that differ from the saved copy. */
  changedFields: string[]
}

export type MergeProblem = { fileName: string; message: string }

export type MergePreview = {
  items: MergeItem[]
  problems: MergeProblem[]
}

const comparedFields: { label: string; same: (a: ProductSpec, b: ProductSpec) => boolean }[] = [
  { label: 'title', same: (a, b) => a.title === b.title },
  { label: 'status', same: (a, b) => a.status === b.status },
  { label: 'priority', same: (a, b) => a.priority === b.priority },
  { label: 'owner', same: (a, b) => a.owner === b.owner },
  { label: 'requirement', same: (a, b) => a.requirement === b.requirement },
  { label: 'criteria', same: (a, b) => JSON.stringify(a.acceptanceCriteria) === JSON.stringify(b.acceptanceCriteria) },
  { label: 'ticked criteria', same: (a, b) => JSON.stringify(criteriaState(a)) === JSON.stringify(criteriaState(b)) },
  { label: 'extra fields', same: (a, b) => JSON.stringify(Object.entries(a.extra ?? {}).sort()) === JSON.stringify(Object.entries(b.extra ?? {}).sort()) },
]

/** Names of the fields that differ. The update time is not a field: it only decides new against conflict. */
export function changedFields(incoming: ProductSpec, saved: ProductSpec): string[] {
  return comparedFields.filter((field) => !field.same(incoming, saved)).map((field) => field.label)
}

/**
 * Reads the files and sorts every spec in them against what is saved. Nothing is
 * written. A file that cannot be read, or an id that repeats inside the files,
 * is reported as a problem and left out.
 */
export function buildMergePreview(saved: ProductSpec[], files: IncomingFile[]): MergePreview {
  const savedById = new Map(saved.map((spec) => [spec.id, spec]))
  const firstFileForId = new Map<string, string>()
  const items: MergeItem[] = []
  const problems: MergeProblem[] = []

  for (const file of files) {
    const documents = parseSpecDocuments(file.text)
    for (const document of documents) {
      if (!document.ok) {
        problems.push({ fileName: file.name, message: document.message })
        continue
      }
      const spec = document.spec
      const earlier = firstFileForId.get(spec.id)
      if (earlier !== undefined) {
        problems.push({ fileName: file.name, message: `The id "${spec.id}" is already used by ${earlier}, so this one was left out` })
        continue
      }
      firstFileForId.set(spec.id, file.name)

      const existing = savedById.get(spec.id)
      if (!existing) {
        items.push({ kind: 'new', fileName: file.name, spec, changedFields: [] })
        continue
      }
      const differences = changedFields(spec, existing)
      if (differences.length === 0) {
        items.push({ kind: 'unchanged', fileName: file.name, spec, saved: existing, changedFields: [] })
        continue
      }
      const savedIsNewer = Date.parse(existing.updatedAt) > Date.parse(spec.updatedAt)
      items.push({ kind: savedIsNewer ? 'conflict' : 'changed', fileName: file.name, spec, saved: existing, changedFields: differences })
    }
  }

  return { items, problems }
}

export type MergeCounts = { added: number; replaced: number; keptSaved: number; unchanged: number }

/** `overwrite` holds the ids of conflicts the person chose to replace. Everything else about a conflict keeps the saved copy. */
export function mergeCounts(preview: MergePreview, overwrite: ReadonlySet<string>): MergeCounts {
  const counts: MergeCounts = { added: 0, replaced: 0, keptSaved: 0, unchanged: 0 }
  for (const item of preview.items) {
    if (item.kind === 'new') counts.added += 1
    else if (item.kind === 'changed') counts.replaced += 1
    else if (item.kind === 'unchanged') counts.unchanged += 1
    else if (overwrite.has(item.spec.id)) counts.replaced += 1
    else counts.keptSaved += 1
  }
  return counts
}

/** The specs to write: new ones, changed ones and the conflicts that were chosen. Their updated time comes from the file. */
export function specsToImport(preview: MergePreview, overwrite: ReadonlySet<string>): ProductSpec[] {
  return preview.items
    .filter((item) => item.kind === 'new' || item.kind === 'changed' || (item.kind === 'conflict' && overwrite.has(item.spec.id)))
    .map((item) => item.spec)
}
