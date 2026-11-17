import { criteriaState, statusOrder, type ProductSpec, type SpecPriority, type SpecStatus } from '../../shared/spec'
import { criteriaHeading, hasCriteriaHeadingLine, specFieldLimits } from '../../shared/validation'

/**
 * One spec per Markdown file:
 *
 *   ---
 *   id: spec-intake-dashboard
 *   title: Spec intake dashboard
 *   status: In progress
 *   priority: High
 *   owner: Frontend
 *   updated: 2026-09-10T00:00:00.000Z
 *   ---
 *
 *   The requirement as prose, any number of paragraphs.
 *
 *   ## Acceptance criteria
 *
 *   - [x] A ticked criterion
 *   - [ ] A criterion still open
 *
 * The front matter is a strict subset of YAML: one `key: value` per line, values
 * are plain text or a double or single quoted string. Keys other than the six
 * above are kept (see `ProductSpec.extra`) and written back on export.
 */

/** A file that is not a valid spec. `line` is 1-based and counted in the file as written. */
export class SpecMarkdownError extends Error {
  line: number | undefined

  constructor(message: string, line?: number) {
    super(line === undefined ? message : `Line ${line}: ${message}`)
    this.name = 'SpecMarkdownError'
    this.line = line
  }
}

/** Written between specs in a combined file, and read back by `parseSpecDocuments`. */
export const combinedSeparator = '<!-- specship:next -->'

const knownKeys = ['id', 'title', 'status', 'priority', 'owner', 'updated'] as const
const requiredKeys = ['id', 'title', 'status', 'updated'] as const
const priorities: SpecPriority[] = ['High', 'Medium', 'Low']
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/
const keyPattern = /^([A-Za-z_][A-Za-z0-9_-]*):(?:[ \t]+(.*))?$/
const criterionPattern = /^-[ \t]+\[([ xX])\][ \t]+(\S.*?)[ \t]*$/

function normalize(text: string): string {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
}

function shorten(value: string): string {
  return value.length > 60 ? `${value.slice(0, 57)}...` : value
}

function parseScalar(raw: string, line: number): string {
  const value = raw.trim()
  if (value.startsWith('"')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new SpecMarkdownError(`The double quoted value ${shorten(value)} is not valid. Close the quote and escape inner quotes as \\".`, line)
    }
    if (typeof parsed !== 'string') {
      throw new SpecMarkdownError(`Expected a text value but found ${shorten(value)}`, line)
    }
    return parsed
  }
  if (value.startsWith("'")) {
    if (value.length < 2 || !value.endsWith("'")) {
      throw new SpecMarkdownError(`The single quoted value ${shorten(value)} is not closed`, line)
    }
    return value.slice(1, -1).replaceAll("''", "'")
  }
  return value
}

function parseUpdated(value: string, line: number): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/
  const dateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?$/
  const failure = new SpecMarkdownError(`updated must be a date like 2026-09-10 or 2026-09-10T08:30:00Z (found "${shorten(value)}")`, line)
  if (!dateOnly.test(value) && !dateTime.test(value)) throw failure
  const withTime = dateOnly.test(value) ? `${value}T00:00:00Z` : value
  // A time with no zone is read as UTC so the same file means the same moment everywhere.
  const withZone = /(Z|[+-]\d{2}:\d{2})$/.test(withTime) ? withTime : `${withTime}Z`
  const time = Date.parse(withZone)
  const day = value.slice(0, 10)
  if (Number.isNaN(time) || new Date(Date.parse(`${day}T00:00:00Z`)).toISOString().slice(0, 10) !== day) throw failure
  return new Date(time).toISOString()
}

/**
 * Reads one spec from Markdown. Throws SpecMarkdownError with a line number for the first problem.
 * `lineOffset` shifts reported lines when the text is one part of a larger file.
 */
export function parseSpecMarkdown(text: string, lineOffset = 0): ProductSpec {
  try {
    return parseDocument(text)
  } catch (error) {
    if (error instanceof SpecMarkdownError && error.line !== undefined && lineOffset > 0) {
      throw new SpecMarkdownError(error.message.replace(/^Line \d+: /, ''), error.line + lineOffset)
    }
    throw error
  }
}

function parseDocument(text: string): ProductSpec {
  const lines = normalize(text).split('\n')
  // Blank lines before the front matter are allowed, so files joined into one are easy to read.
  let opening = 0
  while (opening < lines.length - 1 && lines[opening].trim() === '') opening += 1
  if (lines[opening].trim() !== '---') {
    throw new SpecMarkdownError('A spec file starts with a "---" line that opens the front matter', opening + 1)
  }
  const close = lines.findIndex((line, index) => index > opening && (line.trim() === '---' || line.trim() === '...'))
  if (close === -1) {
    throw new SpecMarkdownError('The front matter is not closed. Add a "---" line after the last field.', opening + 1)
  }

  const fields = new Map<string, { value: string; line: number }>()
  for (let index = opening + 1; index < close; index += 1) {
    const raw = lines[index]
    const line = index + 1
    if (raw.trim() === '' || raw.startsWith('#')) continue
    if (/^\s/.test(raw)) {
      throw new SpecMarkdownError('Indented lines and nested values are not supported. Write one "key: value" per line.', line)
    }
    const match = keyPattern.exec(raw)
    if (!match) {
      throw new SpecMarkdownError(`Expected "key: value" but found "${shorten(raw)}"`, line)
    }
    if (fields.has(match[1])) {
      throw new SpecMarkdownError(`The key "${match[1]}" appears twice`, line)
    }
    fields.set(match[1], { value: parseScalar(match[2] ?? '', line), line })
  }

  for (const key of requiredKeys) {
    if (!fields.has(key)) {
      throw new SpecMarkdownError(`The front matter is missing the required field "${key}"`, close + 1)
    }
  }

  const field = (key: (typeof knownKeys)[number]) => fields.get(key)!
  const id = field('id')
  if (!idPattern.test(id.value)) {
    throw new SpecMarkdownError(`id "${shorten(id.value)}" must be letters, digits, dot, dash or underscore, up to 100 characters`, id.line)
  }
  const title = field('title')
  if (title.value.length < 3 || title.value.length > specFieldLimits.title) {
    throw new SpecMarkdownError(`title must be 3 to ${specFieldLimits.title} characters (found ${title.value.length})`, title.line)
  }
  const status = field('status')
  if (!statusOrder.includes(status.value as SpecStatus)) {
    throw new SpecMarkdownError(`status must be one of ${statusOrder.join(', ')} (found "${shorten(status.value)}")`, status.line)
  }
  const updated = parseUpdated(field('updated').value, field('updated').line)

  let priority: SpecPriority = 'Medium'
  const priorityField = fields.get('priority')
  if (priorityField) {
    if (!priorities.includes(priorityField.value as SpecPriority)) {
      throw new SpecMarkdownError(`priority must be one of ${priorities.join(', ')} (found "${shorten(priorityField.value)}")`, priorityField.line)
    }
    priority = priorityField.value as SpecPriority
  }

  let owner = ''
  const ownerField = fields.get('owner')
  if (ownerField && ownerField.value !== '') {
    if (ownerField.value.length < 2 || ownerField.value.length > specFieldLimits.owner) {
      throw new SpecMarkdownError(`owner must be 2 to ${specFieldLimits.owner} characters, or left out (found ${ownerField.value.length})`, ownerField.line)
    }
    owner = ownerField.value
  }

  // Everything after the front matter: the requirement, then the criteria section.
  const bodyStart = close + 1
  let headingIndex = -1
  for (let index = bodyStart; index < lines.length; index += 1) {
    if (lines[index].trim() !== criteriaHeading) continue
    if (headingIndex !== -1) {
      throw new SpecMarkdownError(`"${criteriaHeading}" appears twice. Keep one criteria section.`, index + 1)
    }
    headingIndex = index
  }
  if (headingIndex === -1) {
    let last = lines.length
    while (last > bodyStart && lines[last - 1].trim() === '') last -= 1
    throw new SpecMarkdownError(`The "${criteriaHeading}" section is missing. Add it after the requirement.`, Math.max(last, bodyStart + 1))
  }

  const requirement = lines.slice(bodyStart, headingIndex).join('\n').trim()
  if (requirement.length < 10 || requirement.length > specFieldLimits.requirement) {
    throw new SpecMarkdownError(
      `The requirement before "${criteriaHeading}" must be 10 to ${specFieldLimits.requirement} characters (found ${requirement.length})`,
      headingIndex + 1,
    )
  }

  const acceptanceCriteria: string[] = []
  const criteriaDone: boolean[] = []
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const raw = lines[index]
    if (raw.trim() === '') continue
    const match = criterionPattern.exec(raw)
    if (!match) {
      throw new SpecMarkdownError(`Expected a task list item like "- [ ] text" or "- [x] text" but found "${shorten(raw)}"`, index + 1)
    }
    if (match[2].length > specFieldLimits.criterion) {
      throw new SpecMarkdownError(`A criterion can be at most ${specFieldLimits.criterion} characters (found ${match[2].length})`, index + 1)
    }
    if (acceptanceCriteria.length === 25) {
      throw new SpecMarkdownError('A spec can have at most 25 acceptance criteria', index + 1)
    }
    acceptanceCriteria.push(match[2])
    criteriaDone.push(match[1] !== ' ')
  }
  if (acceptanceCriteria.length === 0) {
    throw new SpecMarkdownError('The criteria section needs at least one item like "- [ ] text"', headingIndex + 1)
  }

  const extra: Record<string, string> = {}
  for (const [key, { value }] of fields) {
    if (!(knownKeys as readonly string[]).includes(key)) extra[key] = value
  }

  const spec: ProductSpec = {
    id: id.value,
    title: title.value,
    owner,
    status: status.value as SpecStatus,
    priority,
    requirement,
    acceptanceCriteria,
    criteriaDone,
    updatedAt: updated,
  }
  if (Object.keys(extra).length > 0) spec.extra = extra
  return spec
}

function writeScalar(value: string): string {
  const plain =
    value !== '' &&
    value === value.trim() &&
    !/[\n\r\t]/.test(value) &&
    !/^[-?:,[\]{}#&*!|>'"%@`]/.test(value) &&
    !value.includes(': ') &&
    !value.includes(' #') &&
    !value.endsWith(':') &&
    !/^(true|false|null|yes|no|on|off|~|[-+]?[\d.]+)$/i.test(value)
  return plain ? value : JSON.stringify(value)
}

/** Writes one spec as Markdown with LF line endings. Throws SpecMarkdownError when the spec cannot be read back. */
export function serializeSpecMarkdown(spec: ProductSpec): string {
  const requirement = spec.requirement.replace(/\r\n?/g, '\n').trim()
  if (hasCriteriaHeadingLine(requirement)) {
    throw new SpecMarkdownError(`"${spec.title}" has a requirement line that reads "${criteriaHeading}". Reword that line before exporting.`)
  }

  const front = [`id: ${writeScalar(spec.id)}`, `title: ${writeScalar(spec.title)}`, `status: ${spec.status}`, `priority: ${spec.priority}`]
  if (spec.owner) front.push(`owner: ${writeScalar(spec.owner)}`)
  front.push(`updated: ${writeScalar(spec.updatedAt)}`)
  for (const [key, value] of Object.entries(spec.extra ?? {})) {
    if ((knownKeys as readonly string[]).includes(key) || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)) continue
    front.push(`${key}: ${writeScalar(value.replace(/\s*\n\s*/g, ' '))}`)
  }

  const done = criteriaState(spec)
  const criteria = spec.acceptanceCriteria.map((criterion, index) => `- [${done[index] ? 'x' : ' '}] ${criterion.replace(/\s*[\r\n]+\s*/g, ' ').trim()}`)
  return `---\n${front.join('\n')}\n---\n\n${requirement}\n\n${criteriaHeading}\n\n${criteria.join('\n')}\n`
}

/** All specs in one file, each document followed by a separator line that `parseSpecDocuments` understands. */
export function serializeCombined(specs: ProductSpec[]): string {
  return specs.map(serializeSpecMarkdown).join(`\n${combinedSeparator}\n\n`)
}

export type ParsedDocument = { ok: true; spec: ProductSpec } | { ok: false; message: string; line?: number }

/** Reads a file that holds one spec, or several split by the combined separator. Each document succeeds or fails on its own. */
export function parseSpecDocuments(text: string): ParsedDocument[] {
  const lines = normalize(text).split('\n')
  const chunks: { text: string; offset: number }[] = []
  let start = 0
  for (let index = 0; index <= lines.length; index += 1) {
    if (index === lines.length || lines[index].trim() === combinedSeparator) {
      chunks.push({ text: lines.slice(start, index).join('\n'), offset: start })
      start = index + 1
    }
  }
  const used = chunks.filter((chunk) => chunk.text.trim() !== '')
  if (used.length === 0) return [{ ok: false, message: 'The file is empty', line: undefined }]
  return used.map((chunk) => {
    try {
      return { ok: true, spec: parseSpecMarkdown(chunk.text, chunk.offset) }
    } catch (error) {
      if (error instanceof SpecMarkdownError) return { ok: false, message: error.message, line: error.line }
      throw error
    }
  })
}

/** A file name for one spec, safe on every system. */
export function specFileName(spec: Pick<ProductSpec, 'id'>): string {
  return `${spec.id.replace(/[^A-Za-z0-9._-]/g, '-')}.md`
}
