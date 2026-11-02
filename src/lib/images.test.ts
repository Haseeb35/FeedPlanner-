import { describe, expect, it } from 'vitest'
import { MAX_FILE_SIZE, thumbnailSize, validateFile } from './images'
import { stageFiles } from './ui'

const file = (name: string, type: string, size = 1000) => ({ name, type, size })

describe('validateFile', () => {
  it('accepts JPG, PNG and WebP', () => {
    expect(validateFile(file('a.jpg', 'image/jpeg'))).toEqual({ ok: true, type: 'image/jpeg' })
    expect(validateFile(file('a.png', 'image/png'))).toEqual({ ok: true, type: 'image/png' })
    expect(validateFile(file('a.webp', 'image/webp'))).toEqual({ ok: true, type: 'image/webp' })
  })

  it('falls back to the extension when the browser gives no type', () => {
    expect(validateFile(file('photo.JPEG', ''))).toEqual({ ok: true, type: 'image/jpeg' })
  })

  it('rejects other types with a readable message', () => {
    const gif = validateFile(file('anim.gif', 'image/gif'))
    expect(gif.ok).toBe(false)
    expect(!gif.ok && gif.reason).toMatch(/GIF files aren’t supported/)
    expect(validateFile(file('vector.svg', 'image/svg+xml')).ok).toBe(false)
    expect(validateFile(file('notes.txt', 'text/plain')).ok).toBe(false)
    // A misleading extension doesn't override a known, unsupported MIME type.
    expect(validateFile(file('evil.png', 'text/html')).ok).toBe(false)
  })

  it('rejects empty and oversized files', () => {
    expect(validateFile(file('a.jpg', 'image/jpeg', 0)).ok).toBe(false)
    const big = validateFile(file('a.jpg', 'image/jpeg', MAX_FILE_SIZE + 1))
    expect(!big.ok && big.reason).toMatch(/larger than 30 MB/)
  })

  it('stages a mixed batch, flagging only the invalid files', () => {
    const staged = stageFiles([new File(['x'], 'ok.png', { type: 'image/png' }), new File(['x'], 'doc.pdf', { type: 'application/pdf' })])
    expect(staged[0]).toMatchObject({ type: 'image/png', error: null })
    expect(staged[1].type).toBeNull()
    expect(staged[1].error).toMatch(/PDF/)
    expect(staged[0].key).not.toBe(staged[1].key)
  })
})

describe('thumbnailSize', () => {
  it('scales the short edge down and never upscales', () => {
    expect(thumbnailSize(4000, 3000, 540)).toEqual({ width: 720, height: 540 })
    expect(thumbnailSize(300, 200, 540)).toEqual({ width: 300, height: 200 })
  })
})
