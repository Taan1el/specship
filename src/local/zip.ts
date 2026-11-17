/**
 * A minimal ZIP writer: every file is stored as it is (no compression) with a
 * CRC-32, UTF-8 names and the classic 32-bit layout. That is enough for a few
 * hundred Markdown files and opens in every unzip tool.
 */

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let value = n
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[n] = value >>> 0
  }
  return table
})()

/** CRC-32 (IEEE 802.3), as used by ZIP and PNG. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

export type ZipEntry = { name: string; data: Uint8Array }

function dosDateTime(date: Date): { time: number; day: number } {
  // ZIP cannot store a date before 1980. Local time, as most tools write it.
  const year = Math.max(date.getFullYear(), 1980)
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

/** Builds a ZIP archive. File names must be unique and are written as UTF-8. */
export function createZip(entries: ZipEntry[], modified: Date = new Date()): Uint8Array<ArrayBuffer> {
  if (entries.length > 0xffff) throw new Error('A zip file made here holds at most 65535 files.')
  const encoder = new TextEncoder()
  const { time, day } = dosDateTime(modified)
  const names = entries.map((entry) => encoder.encode(entry.name))
  if (new Set(entries.map((entry) => entry.name)).size !== entries.length) throw new Error('Zip file names must be unique.')

  const localSize = entries.reduce((total, entry, index) => total + 30 + names[index].length + entry.data.length, 0)
  const centralSize = names.reduce((total, name) => total + 46 + name.length, 0)
  const total = localSize + centralSize + 22
  if (total > 0xffffffff) throw new Error('This archive is too large for a plain zip file.')

  const output = new Uint8Array(total)
  const view = new DataView(output.buffer)
  const central: number[] = []
  let offset = 0
  entries.forEach((entry, index) => {
    const name = names[index]
    const crc = crc32(entry.data)
    central.push(offset)
    view.setUint32(offset, 0x04034b50, true)
    view.setUint16(offset + 4, 20, true) // version needed
    view.setUint16(offset + 6, 0x0800, true) // flag: names are UTF-8
    view.setUint16(offset + 8, 0, true) // method: stored
    view.setUint16(offset + 10, time, true)
    view.setUint16(offset + 12, day, true)
    view.setUint32(offset + 14, crc, true)
    view.setUint32(offset + 18, entry.data.length, true) // compressed size
    view.setUint32(offset + 22, entry.data.length, true) // uncompressed size
    view.setUint16(offset + 26, name.length, true)
    view.setUint16(offset + 28, 0, true) // extra field length
    output.set(name, offset + 30)
    output.set(entry.data, offset + 30 + name.length)
    offset += 30 + name.length + entry.data.length
  })

  const centralStart = offset
  entries.forEach((entry, index) => {
    const name = names[index]
    view.setUint32(offset, 0x02014b50, true)
    view.setUint16(offset + 4, 20, true) // version made by
    view.setUint16(offset + 6, 20, true) // version needed
    view.setUint16(offset + 8, 0x0800, true)
    view.setUint16(offset + 10, 0, true)
    view.setUint16(offset + 12, time, true)
    view.setUint16(offset + 14, day, true)
    view.setUint32(offset + 16, crc32(entry.data), true)
    view.setUint32(offset + 20, entry.data.length, true)
    view.setUint32(offset + 24, entry.data.length, true)
    view.setUint16(offset + 28, name.length, true)
    view.setUint16(offset + 30, 0, true) // extra field length
    view.setUint16(offset + 32, 0, true) // comment length
    view.setUint16(offset + 34, 0, true) // disk number
    view.setUint16(offset + 36, 0, true) // internal attributes
    view.setUint32(offset + 38, 0, true) // external attributes
    view.setUint32(offset + 42, central[index], true) // local header offset
    output.set(name, offset + 46)
    offset += 46 + name.length
  })

  view.setUint32(offset, 0x06054b50, true)
  view.setUint16(offset + 4, 0, true) // this disk
  view.setUint16(offset + 6, 0, true) // disk with the central directory
  view.setUint16(offset + 8, entries.length, true)
  view.setUint16(offset + 10, entries.length, true)
  view.setUint32(offset + 12, offset - centralStart, true)
  view.setUint32(offset + 16, centralStart, true)
  view.setUint16(offset + 20, 0, true) // comment length
  return output
}
