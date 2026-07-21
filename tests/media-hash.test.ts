import { describe, expect, it, vi } from 'vitest'

import { sha256Hex } from '@/platform/media/sha256'

describe('media SHA-256', () => {
  it('uses the cross-platform fallback when Web Crypto is unavailable', async () => {
    vi.stubGlobal('crypto', undefined)
    try {
      await expect(sha256Hex(ascii(''))).resolves.toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      )
      await expect(sha256Hex(ascii('abc'))).resolves.toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      )
      await expect(sha256Hex(ascii('The quick brown fox jumps over the lazy dog'))).resolves.toBe(
        'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
      )
      await expect(sha256Hex(ascii('a'.repeat(1_000)))).resolves.toBe(
        '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

function ascii(value: string): Uint8Array {
  return Uint8Array.from([...value].map((character) => character.charCodeAt(0)))
}
