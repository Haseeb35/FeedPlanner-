import type { Crop, FeedFilter, PostType, Project, TileAspect } from '../types'
import { COLUMNS } from './grid'
import { coverCrop, loadDrawable, encodeCanvas } from './images'
import { filterCss, getPost, isNeutralFilter, warmthOverlay } from './posts'
import { slugify } from './format'
import { initials } from './ui'

/**
 * Renders the planned grid (or a framed profile preview) onto a canvas using the
 * original photo blobs, so the export is sharper than the on-screen thumbnails.
 */

export type ExportMode = 'grid' | 'profile'
export type ExportFormat = 'png' | 'jpeg'

export interface ExportOptions {
  mode: ExportMode
  width: number
  theme: 'light' | 'dark'
  format: ExportFormat
  /** Number of rows to include, or null for every row. */
  rows: number | null
  gaps: boolean
  /** Draw carousel and Reel icons on tiles, like Instagram does. */
  typeIcons: boolean
}

export const defaultExportOptions: ExportOptions = {
  mode: 'grid',
  width: 1080,
  theme: 'light',
  format: 'png',
  rows: null,
  gaps: true,
  typeIcons: true,
}

/** Browsers cap canvas dimensions; 16384px is safe across current engines. */
export const MAX_CANVAS_SIDE = 16384

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function tileRatio(aspect: TileAspect): number {
  return aspect === 'portrait' ? 4 / 3 : 1
}

/** Integer-aligned tile rectangles for a three-column grid, so tiles never show seams. */
export function computeGridLayout(count: number, width: number, gap: number, aspect: TileAspect): { rects: Rect[]; height: number } {
  const tileW = (width - gap * (COLUMNS - 1)) / COLUMNS
  const tileH = Math.round(tileW * tileRatio(aspect))
  const rects: Rect[] = []
  for (let i = 0; i < count; i++) {
    const col = i % COLUMNS
    const row = Math.floor(i / COLUMNS)
    const x = Math.round(col * (tileW + gap))
    const right = col === COLUMNS - 1 ? width : Math.round(col * (tileW + gap) + tileW)
    const y = row * (tileH + gap)
    rects.push({ x, y, w: right - x, h: tileH })
  }
  const rows = Math.ceil(count / COLUMNS)
  return { rects, height: rows === 0 ? 0 : rows * tileH + (rows - 1) * gap }
}

export function selectExportIds(order: string[], rows: number | null): string[] {
  return rows === null ? [...order] : order.slice(0, rows * COLUMNS)
}

export function exportFileName(projectName: string, mode: ExportMode, format: ExportFormat): string {
  return `${slugify(projectName)}-${mode === 'grid' ? 'grid' : 'profile'}.${format === 'png' ? 'png' : 'jpg'}`
}

const palette = {
  light: { bg: '#ffffff', text: '#0f0f0f', muted: '#737373', line: '#dbdbdb', empty: '#efefef', link: '#00376b' },
  dark: { bg: '#000000', text: '#f5f5f5', muted: '#a8a8a8', line: '#262626', empty: '#1c1c1c', link: '#e0f1ff' },
}

const FONT = '"Inter Variable", Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate
      else {
        lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
    kept[maxLines - 1] = `${last}…`
    return kept
  }
  return lines
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawTabIcons(ctx: CanvasRenderingContext2D, top: number, width: number, height: number, s: number, colors: typeof palette.light) {
  const size = 22 * s
  const centers = [width / 6, width / 2, (width * 5) / 6]
  ctx.lineWidth = 1.8 * s
  ctx.lineJoin = 'round'
  centers.forEach((cx, i) => {
    const cy = top + height / 2
    const x = cx - size / 2
    const y = cy - size / 2
    ctx.strokeStyle = i === 0 ? colors.text : colors.muted
    ctx.fillStyle = ctx.strokeStyle
    roundRectPath(ctx, x, y, size, size, 4 * s)
    ctx.stroke()
    if (i === 0) {
      for (const f of [1 / 3, 2 / 3]) {
        ctx.beginPath()
        ctx.moveTo(x + size * f, y)
        ctx.lineTo(x + size * f, y + size)
        ctx.moveTo(x, y + size * f)
        ctx.lineTo(x + size, y + size * f)
        ctx.stroke()
      }
    } else if (i === 1) {
      ctx.beginPath()
      ctx.moveTo(cx - 4 * s, cy - 5 * s)
      ctx.lineTo(cx + 6 * s, cy)
      ctx.lineTo(cx - 4 * s, cy + 5 * s)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(cx, cy - 2.5 * s, 4 * s, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy + 11 * s, 8 * s, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
    }
  })
  // Active tab indicator
  ctx.fillStyle = colors.text
  ctx.fillRect(0, top + height - 2 * s, width / 3, 2 * s)
}

export interface RenderInput {
  project: Project
  loadBlob: (id: string) => Promise<Blob | undefined>
}

export interface RenderResult {
  blob: Blob
  width: number
  height: number
  missing: number
}

interface PhotoLook {
  crop?: Crop | null
  filter?: FeedFilter
}

async function drawPhoto(ctx: CanvasRenderingContext2D, blob: Blob | undefined, rect: Rect, fallback: string, look: PhotoLook = {}): Promise<boolean> {
  if (blob) {
    try {
      const img = await loadDrawable(blob)
      try {
        const crop = coverCrop(img.width, img.height, rect.w, rect.h, look.crop)
        const filtered = look.filter && !isNeutralFilter(look.filter)
        if (filtered) ctx.filter = filterCss(look.filter!)
        ctx.drawImage(img.source, crop.sx, crop.sy, crop.sw, crop.sh, rect.x, rect.y, rect.w, rect.h)
        if (filtered) ctx.filter = 'none'
        const overlay = look.filter && warmthOverlay(look.filter)
        if (overlay) {
          ctx.save()
          ctx.globalAlpha = overlay.opacity
          ctx.fillStyle = overlay.color
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
          ctx.restore()
        }
        return true
      } finally {
        img.release()
      }
    } catch {
      // Draw the placeholder below.
    }
  }
  ctx.fillStyle = fallback
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  return false
}

/** White carousel / Reel glyph in a tile's top-right corner, with a soft shadow for contrast. */
function drawTypeIcon(ctx: CanvasRenderingContext2D, type: PostType, rect: Rect, s: number) {
  if (type === 'photo') return
  const size = 18 * s
  const x = rect.x + rect.w - size - 8 * s
  const y = rect.y + 8 * s
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 4 * s
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.lineWidth = 1.8 * s
  ctx.lineJoin = 'round'
  if (type === 'carousel') {
    const box = size * 0.72
    roundRectPath(ctx, x + size - box, y, box, box, 2.5 * s)
    ctx.stroke()
    roundRectPath(ctx, x, y + size - box, box, box, 2.5 * s)
    ctx.fill()
  } else {
    roundRectPath(ctx, x, y, size, size, 4.5 * s)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + size * 0.4, y + size * 0.32)
    ctx.lineTo(x + size * 0.7, y + size * 0.5)
    ctx.lineTo(x + size * 0.4, y + size * 0.68)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function drawVerified(ctx: CanvasRenderingContext2D, x: number, cy: number, s: number) {
  const r = 7.5 * s
  ctx.save()
  ctx.fillStyle = '#0095f6'
  ctx.beginPath()
  ctx.arc(x + r, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.8 * s
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x + r - 3.4 * s, cy)
  ctx.lineTo(x + r - 0.9 * s, cy + 2.6 * s)
  ctx.lineTo(x + r + 3.6 * s, cy - 2.6 * s)
  ctx.stroke()
  ctx.restore()
}

interface HeaderLine {
  text: string
  font: string
  color: string
}

export async function renderExport({ project, loadBlob }: RenderInput, options: ExportOptions): Promise<RenderResult> {
  const ids = selectExportIds(project.order, options.rows)
  if (ids.length === 0 && options.mode === 'grid') throw new Error('Add at least one photo before exporting the grid.')

  try {
    await document.fonts?.load(`600 16px "Inter Variable"`)
  } catch {
    // Fonts are a nicety; fall back to system fonts.
  }

  const colors = palette[options.theme]
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('Your browser doesn’t support image export.')

  // Plan the layout at the requested width, then shrink if it would exceed canvas limits.
  const plan = (width: number) => {
    const s = width / 540
    const gap = options.gaps ? Math.max(1, Math.round(2 * s)) : 0
    const grid = computeGridLayout(ids.length, width, gap, project.aspect)
    let headerHeight = 0
    const lines: HeaderLine[] = []
    let highlightsTop = 0
    if (options.mode === 'profile') {
      const p = project.profile
      const maxW = width - 40 * s
      const regular = `400 ${14 * s}px ${FONT}`
      const bold = `600 ${14 * s}px ${FONT}`
      measure.font = regular
      const fit = (text: string) => wrapText(measure, text, maxW, 1)[0]
      if (p.displayName.trim()) lines.push({ text: p.displayName.trim(), font: bold, color: colors.text })
      if (p.category.trim()) lines.push({ text: fit(p.category.trim()), font: regular, color: colors.muted })
      if (p.bio.trim()) for (const text of wrapText(measure, p.bio.trim(), maxW, 6)) lines.push({ text, font: regular, color: colors.text })
      if (p.link.trim()) lines.push({ text: fit(p.link.trim().replace(/^https?:\/\//, '')), font: bold, color: colors.link })
      const textTop = 20 * s + 86 * s + 14 * s
      const textHeight = lines.length ? 16 * s + (lines.length - 1) * 19 * s + 4 * s : 0
      highlightsTop = textTop + textHeight + 16 * s
      const highlightsHeight = p.highlights.length ? 16 * s + 92 * s : 0
      headerHeight = textTop + textHeight + highlightsHeight + 18 * s + 46 * s
    }
    return { s, gap, grid, headerHeight, lines, highlightsTop, height: Math.max(1, Math.round(headerHeight + grid.height)) }
  }

  let width = Math.round(options.width)
  let layout = plan(width)
  // Gaps and tiles are rounded, so height doesn't scale exactly with width: shrink until it fits.
  while (layout.height > MAX_CANVAS_SIDE && width > 3) {
    width = Math.min(width - 1, Math.floor(width * (MAX_CANVAS_SIDE / layout.height)))
    layout = plan(width)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = layout.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser doesn’t support image export.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, width, layout.height)

  if (options.mode === 'profile') {
    const { s } = layout
    const p = project.profile
    const pad = 20 * s
    const avatar = 86 * s
    const ax = pad
    const ay = pad

    // Avatar
    ctx.save()
    ctx.beginPath()
    ctx.arc(ax + avatar / 2, ay + avatar / 2, avatar / 2, 0, Math.PI * 2)
    ctx.clip()
    const avatarBlob = p.avatarId ? await loadBlob(p.avatarId) : undefined
    const drewAvatar = await drawPhoto(ctx, avatarBlob, { x: ax, y: ay, w: avatar, h: avatar }, colors.empty)
    if (!drewAvatar) {
      ctx.fillStyle = colors.muted
      ctx.font = `600 ${28 * s}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(initials(p.displayName || p.username), ax + avatar / 2, ay + avatar / 2)
    }
    ctx.restore()
    ctx.strokeStyle = colors.line
    ctx.lineWidth = Math.max(1, s)
    ctx.beginPath()
    ctx.arc(ax + avatar / 2, ay + avatar / 2, avatar / 2, 0, Math.PI * 2)
    ctx.stroke()

    // Username and stats
    const colX = ax + avatar + 24 * s
    const colW = width - colX - pad
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = colors.text
    ctx.font = `600 ${19 * s}px ${FONT}`
    const username = wrapText(ctx, p.username || 'username', colW - (p.verified ? 22 * s : 0), 1)[0]
    ctx.fillText(username, colX, ay + 28 * s)
    if (p.verified) drawVerified(ctx, colX + ctx.measureText(username).width + 6 * s, ay + 21.5 * s, s)

    const stats: [string, string][] = [
      [String(project.order.length), 'posts'],
      [p.followers || '0', 'followers'],
      [p.following || '0', 'following'],
    ]
    const statW = colW / 3
    stats.forEach(([value, label], i) => {
      const x = colX + statW * i
      ctx.fillStyle = colors.text
      ctx.font = `600 ${16 * s}px ${FONT}`
      ctx.fillText(wrapText(ctx, value, statW - 6 * s, 1)[0], x, ay + 62 * s)
      ctx.fillStyle = colors.muted
      ctx.font = `400 ${13 * s}px ${FONT}`
      ctx.fillText(label, x, ay + 80 * s)
    })

    // Name, category, bio and link
    let y = ay + avatar + 14 * s + 16 * s
    for (const line of layout.lines) {
      ctx.font = line.font
      ctx.fillStyle = line.color
      ctx.fillText(line.text, pad, y)
      y += 19 * s
    }

    // Story highlights
    if (p.highlights.length) {
      const size = 64 * s
      const step = size + 18 * s
      for (let i = 0; i < p.highlights.length; i++) {
        const h = p.highlights[i]
        const cx = pad + size / 2 + i * step
        if (cx - size / 2 > width) break
        const cy = layout.highlightsTop + size / 2 + 4 * s
        ctx.strokeStyle = colors.line
        ctx.lineWidth = Math.max(1, s)
        ctx.beginPath()
        ctx.arc(cx, cy, size / 2 + 3 * s, 0, Math.PI * 2)
        ctx.stroke()
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
        ctx.clip()
        const cover = h.coverId ? await loadBlob(h.coverId) : undefined
        await drawPhoto(ctx, cover, { x: cx - size / 2, y: cy - size / 2, w: size, h: size }, colors.empty)
        ctx.restore()
        ctx.fillStyle = colors.text
        ctx.font = `500 ${12 * s}px ${FONT}`
        ctx.textAlign = 'center'
        ctx.fillText(wrapText(ctx, h.title || ' ', size + 12 * s, 1)[0], cx, cy + size / 2 + 20 * s)
        ctx.textAlign = 'left'
      }
    }

    // Tabs
    const tabsTop = layout.headerHeight - 46 * s
    ctx.fillStyle = colors.line
    ctx.fillRect(0, tabsTop, width, Math.max(1, s))
    drawTabIcons(ctx, tabsTop, width, 46 * s, s, colors)
  }

  // Photos, decoded one at a time to keep memory use flat.
  let missing = 0
  for (let i = 0; i < ids.length; i++) {
    const rect = layout.grid.rects[i]
    const slot = project.slots[ids[i]]
    if (slot) {
      // Empty spot from a template: draw its colour hint.
      const r = layout.grid.rects[i]
      ctx.fillStyle = slot.color
      ctx.fillRect(r.x, r.y + layout.headerHeight, r.w, r.h)
      continue
    }
    const blob = await loadBlob(ids[i])
    const post = getPost(project.posts, ids[i])
    const tile = { ...rect, y: rect.y + layout.headerHeight }
    const ok = await drawPhoto(ctx, blob, tile, colors.empty, { crop: post.crop, filter: project.filter })
    if (!ok) missing++
    else if (options.typeIcons) drawTypeIcon(ctx, post.type, tile, layout.s)
  }

  const blob = await encodeCanvas(canvas, options.format === 'png' ? 'image/png' : 'image/jpeg', 0.95)
  const result = { blob, width: canvas.width, height: canvas.height, missing }
  canvas.width = 0
  canvas.height = 0
  return result
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
