import type { Crop, StoredImage } from '../types'
import { createId } from './id'

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ACCEPT_ATTRIBUTE = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
export const MAX_FILE_SIZE = 30 * 1024 * 1024
/** Thumbnails are sized so the short edge covers a grid tile on high-density screens. */
export const THUMB_SHORT_EDGE = 540

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export type Validation = { ok: true; type: string } | { ok: false; reason: string }

/** Resolves the file type from its MIME type, falling back to the extension (some systems omit the type). */
export function resolveType(file: Pick<File, 'name' | 'type'>): string | null {
  if ((ACCEPTED_TYPES as readonly string[]).includes(file.type)) return file.type
  if (file.type && file.type !== 'application/octet-stream') return null
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_TYPES[ext] ?? null
}

export function validateFile(file: Pick<File, 'name' | 'type' | 'size'>): Validation {
  const type = resolveType(file)
  if (!type) {
    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toUpperCase() : 'This file type'
    return { ok: false, reason: `${ext} files aren’t supported. Use JPG, PNG or WebP.` }
  }
  if (file.size === 0) return { ok: false, reason: 'This file is empty.' }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, reason: `This photo is larger than ${MAX_FILE_SIZE / (1024 * 1024)} MB.` }
  }
  return { ok: true, type }
}

export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageProcessingError'
  }
}

type Drawable = ImageBitmap | HTMLImageElement

async function decode(blob: Blob): Promise<{ source: Drawable; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
    } catch {
      // Fall through to the <img> decoder, which some browsers handle more leniently.
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => undefined }
  } catch {
    throw new ImageProcessingError('This file couldn’t be read as an image. It may be damaged.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function loadDrawable(blob: Blob) {
  return decode(blob)
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ImageProcessingError('Couldn’t create an image.'))), type, quality)
  })
}

export async function encodeCanvas(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg' | 'image/webp', quality = 0.92): Promise<Blob> {
  const blob = await canvasToBlob(canvas, type, quality)
  // Browsers without WebP encoding silently return PNG; fall back to JPEG to keep thumbnails small.
  if (type === 'image/webp' && blob.type !== 'image/webp') return canvasToBlob(canvas, 'image/jpeg', quality)
  return blob
}

export function thumbnailSize(width: number, height: number, shortEdge = THUMB_SHORT_EDGE): { width: number; height: number } {
  const scale = Math.min(1, shortEdge / Math.min(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Decodes a photo, creates a thumbnail and returns a record ready for storage. */
export async function processImage(file: Blob, name: string, projectId: string, type = file.type): Promise<StoredImage> {
  const decoded = await decode(file)
  try {
    if (!decoded.width || !decoded.height) throw new ImageProcessingError('This image has no visible pixels.')
    const size = thumbnailSize(decoded.width, decoded.height)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageProcessingError('Your browser couldn’t process this image.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(decoded.source, 0, 0, size.width, size.height)
    const thumb = await encodeCanvas(canvas, 'image/webp', 0.86)
    canvas.width = 0
    canvas.height = 0
    return {
      id: createId(),
      projectId,
      name,
      type,
      size: file.size,
      width: decoded.width,
      height: decoded.height,
      blob: file,
      thumb,
      createdAt: Date.now(),
    }
  } finally {
    decoded.release()
  }
}

/**
 * Source rectangle that crops an image to fill a target box (CSS object-fit: cover).
 * An optional crop zooms in and moves the visible window towards its focal point.
 */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number, crop?: Crop | null) {
  const scale = Math.max(dstW / srcW, dstH / srcH) * (crop?.zoom ?? 1)
  const sw = dstW / scale
  const sh = dstH / scale
  return { sx: (srcW - sw) * (crop?.x ?? 0.5), sy: (srcH - sh) * (crop?.y ?? 0.5), sw, sh }
}

/** Yields to the browser so long batches don't freeze the interface. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
