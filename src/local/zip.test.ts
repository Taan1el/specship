import { describe, expect, it } from 'vitest'
import { crc32, createZip } from './zip'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

type ReadEntry = { name: string; data: Uint8Array; crc: number; method: number; flags: number; time: number; day: number }

/** Reads an archive the way an unzip tool does: from the end-of-central-directory record, through the central directory, to each file. */
function readZip(bytes: Uint8Array): ReadEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.byteLength - 22
  expect(view.getUint32(end, true)).toBe(0x06054b50)
  const count = view.getUint16(end + 10, true)
  expect(view.getUint16(end + 8, true)).toBe(count)
  const centralSize = view.getUint32(end + 12, true)
  const centralStart = view.getUint32(end + 16, true)
  expect(centralStart + centralSize).toBe(end)

  const entries: ReadEntry[] = []
  let offset = centralStart
  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(offset, true)).toBe(0x02014b50)
    const flags = view.getUint16(offset + 8, true)
    const method = view.getUint16(offset + 10, true)
    const time = view.getUint16(offset + 12, true)
    const day = view.getUint16(offset + 14, true)
    const crc = view.getUint32(offset + 16, true)
    const compressed = view.getUint32(offset + 20, true)
    const size = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    expect(compressed).toBe(size)

    // The local header repeats the name and sizes, and the data follows it.
    expect(view.getUint32(localOffset, true)).toBe(0x04034b50)
    expect(view.getUint32(localOffset + 14, true)).toBe(crc)
    expect(view.getUint32(localOffset + 22, true)).toBe(size)
    const localNameLength = view.getUint16(localOffset + 26, true)
    expect(decoder.decode(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength))).toBe(name)
    const dataStart = localOffset + 30 + localNameLength + view.getUint16(localOffset + 28, true)
    entries.push({ name, data: bytes.slice(dataStart, dataStart + size), crc, method, flags, time, day })
    offset += 46 + nameLength + extraLength + commentLength
  }
  expect(offset).toBe(end)
  return entries
}

describe('crc32', () => {
  it('matches the published check values', () => {
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
    expect(crc32(encoder.encode('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339)
  })
})

describe('createZip', () => {
  it('lists every file and extracts the same bytes with a matching CRC-32', () => {
    const files = [
      { name: 'spec-a.md', data: encoder.encode('---\nid: spec-a\n---\n\nFirst spec.\n') },
      { name: 'spec-b.md', data: encoder.encode('Second spec with unicode: éè ✓\n') },
      { name: 'empty.md', data: new Uint8Array() },
    ]
    const zip = createZip(files, new Date(2026, 10, 16, 14, 30, 10))
    const entries = readZip(zip)

    expect(entries.map((entry) => entry.name)).toEqual(['spec-a.md', 'spec-b.md', 'empty.md'])
    entries.forEach((entry, index) => {
      expect(Array.from(entry.data)).toEqual(Array.from(files[index].data))
      expect(crc32(entry.data)).toBe(entry.crc)
      expect(entry.method).toBe(0)
      expect(entry.flags & 0x0800).toBe(0x0800)
    })
  })

  it('stamps the time and date in DOS format', () => {
    const [entry] = readZip(createZip([{ name: 'a.md', data: encoder.encode('x') }], new Date(2026, 10, 16, 14, 30, 10)))
    expect(entry.day).toBe(((2026 - 1980) << 9) | (11 << 5) | 16)
    expect(entry.time).toBe((14 << 11) | (30 << 5) | 5)
  })

  it('writes an archive with no files', () => {
    const zip = createZip([])
    expect(zip.byteLength).toBe(22)
    expect(readZip(zip)).toEqual([])
  })

  it('refuses duplicate names', () => {
    expect(() => createZip([{ name: 'a.md', data: new Uint8Array() }, { name: 'a.md', data: new Uint8Array() }])).toThrow('unique')
  })

  it('has the exact size of its parts', () => {
    const zip = createZip([{ name: 'ab.md', data: new Uint8Array(10) }])
    // local header 30 + name 5 + data 10, central 46 + name 5, end record 22
    expect(zip.byteLength).toBe(30 + 5 + 10 + 46 + 5 + 22)
  })
})
