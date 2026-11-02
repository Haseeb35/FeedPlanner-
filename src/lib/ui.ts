import type { CSSProperties } from 'react'
import type { Crop, TileAspect } from '../types'
import { validateFile } from './images'

export const aspectClass: Record<TileAspect, string> = {
  portrait: 'aspect-[3/4]',
  square: 'aspect-square',
}

/**
 * Styles that show the same window of a photo as the export's coverCrop: object-position
 * moves the visible area towards the focal point and the scale zooms in around it.
 */
export function cropStyle(crop: Crop | null | undefined): CSSProperties | undefined {
  if (!crop) return undefined
  const origin = `${crop.x * 100}% ${crop.y * 100}%`
  return { objectPosition: origin, transformOrigin: origin, transform: crop.zoom === 1 ? undefined : `scale(${crop.zoom})` }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.slice(0, 2).map((p) => p[0]).join('') || 'FP').toUpperCase()
}

export const BIO_LIMIT = 150
export const HIGHLIGHT_LIMIT = 8
export const HIGHLIGHT_TITLE_LIMIT = 15

/** Instagram usernames: letters, numbers, periods and underscores. */
export function cleanUsername(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30)
}

export function hasFiles(event: { dataTransfer: DataTransfer | null }): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

export const MAX_BATCH = 60

export interface StagedFile {
  key: string
  file: File
  type: string | null
  error: string | null
}

let keySeed = 0

export function stageFiles(files: File[]): StagedFile[] {
  return files.map((file) => {
    const validation = validateFile(file)
    return {
      key: `${++keySeed}`,
      file,
      type: validation.ok ? validation.type : null,
      error: validation.ok ? null : validation.reason,
    }
  })
}
