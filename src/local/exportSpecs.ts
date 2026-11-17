import type { ProductSpec } from '../../shared/spec'
import { downloadFile } from './files'
import { serializeCombined, serializeSpecMarkdown, specFileName } from './specMarkdown'
import { createZip } from './zip'

const markdownType = 'text/markdown;charset=utf-8'

/** YYYY-MM-DD in local time, used in the names of bundled downloads. */
export function dayStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** One file name per spec, with a number added when two names match ignoring case. */
export function uniqueFileNames(specs: ProductSpec[]): string[] {
  const used = new Set<string>()
  return specs.map((spec) => {
    const base = specFileName(spec)
    let name = base
    for (let attempt = 2; used.has(name.toLowerCase()); attempt += 1) {
      name = base.replace(/\.md$/, `-${attempt}.md`)
    }
    used.add(name.toLowerCase())
    return name
  })
}

/** Builds the archive of one .md file per spec. Throws SpecMarkdownError when a spec cannot be written as Markdown. */
export function buildSpecZip(specs: ProductSpec[], now: Date = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const names = uniqueFileNames(specs)
  return createZip(
    specs.map((spec, index) => ({ name: names[index], data: encoder.encode(serializeSpecMarkdown(spec)) })),
    now,
  )
}

export function exportSpecFile(spec: ProductSpec): void {
  downloadFile(specFileName(spec), serializeSpecMarkdown(spec), markdownType)
}

export function exportAllZip(specs: ProductSpec[], now: Date = new Date()): void {
  downloadFile(`specship-specs-${dayStamp(now)}.zip`, buildSpecZip(specs, now), 'application/zip')
}

export function exportAllCombined(specs: ProductSpec[], now: Date = new Date()): void {
  downloadFile(`specship-specs-${dayStamp(now)}.md`, serializeCombined(specs), markdownType)
}
