import type { TileAspect } from '../types'
import { COLUMNS } from './grid'
import { coverCrop, encodeCanvas, loadDrawable } from './images'
import { tileRatio } from './export'

/**
 * Puzzle split: cuts one large image into a block of grid tiles, so a panorama or big
 * picture spreads across the profile. The grid is always three columns wide.
 */

export const SPLIT_ROWS = [1, 2, 3] as const

/** Longest edge of each generated tile, which keeps exports sharp without huge files. */
const MAX_PIECE_WIDTH = 1440

export interface PieceRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

/** Source rectangles for each piece, in grid order (row by row, left to right). */
export function splitRects(srcW: number, srcH: number, rows: number, aspect: TileAspect): PieceRect[] {
  const area = coverCrop(srcW, srcH, COLUMNS, rows * tileRatio(aspect))
  const pw = area.sw / COLUMNS
  const ph = area.sh / rows
  const rects: PieceRect[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLUMNS; c++) rects.push({ sx: area.sx + c * pw, sy: area.sy + r * ph, sw: pw, sh: ph })
  }
  return rects
}

export async function splitImage(blob: Blob, rows: number, aspect: TileAspect): Promise<Blob[]> {
  const img = await loadDrawable(blob)
  try {
    const rects = splitRects(img.width, img.height, rows, aspect)
    const width = Math.max(1, Math.round(Math.min(MAX_PIECE_WIDTH, rects[0].sw)))
    const height = Math.max(1, Math.round(width * tileRatio(aspect)))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Your browser couldn’t split this image.')
    ctx.imageSmoothingQuality = 'high'
    const pieces: Blob[] = []
    for (const r of rects) {
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(img.source, r.sx, r.sy, r.sw, r.sh, 0, 0, width, height)
      pieces.push(await encodeCanvas(canvas, 'image/jpeg', 0.92))
    }
    canvas.width = 0
    canvas.height = 0
    return pieces
  } finally {
    img.release()
  }
}
