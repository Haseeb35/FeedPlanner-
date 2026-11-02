import type { Crop, FeedFilter, PostDetails, PostType } from '../types'
import { postingNumber } from './grid'

/** Instagram's caption and hashtag limits. */
export const CAPTION_LIMIT = 2200
export const HASHTAG_LIMIT = 30

export const emptyPost: PostDetails = { caption: '', date: null, time: null, type: 'photo', posted: false, crop: null }

export const neutralFilter: FeedFilter = { brightness: 100, contrast: 100, saturation: 100, warmth: 0 }

export const POST_TYPES: { value: PostType; label: string }[] = [
  { value: 'photo', label: 'Photo' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'reel', label: 'Reel' },
]

export function getPost(posts: Record<string, PostDetails>, id: string): PostDetails {
  return posts[id] ?? emptyPost
}

export function countHashtags(caption: string): number {
  return caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu)?.length ?? 0
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

export function normalizeCrop(raw: unknown): Crop | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Partial<Crop>
  const crop = { x: clamp(c.x, 0, 1, 0.5), y: clamp(c.y, 0, 1, 0.5), zoom: clamp(c.zoom, 1, 4, 1) }
  return isDefaultCrop(crop) ? null : crop
}

export function isDefaultCrop(crop: Crop | null): boolean {
  return !crop || (crop.x === 0.5 && crop.y === 0.5 && crop.zoom === 1)
}

export function normalizePost(raw: unknown): PostDetails {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<PostDetails>
  return {
    caption: typeof p.caption === 'string' ? p.caption.slice(0, CAPTION_LIMIT) : '',
    date: typeof p.date === 'string' && DATE_RE.test(p.date) ? p.date : null,
    time: typeof p.time === 'string' && TIME_RE.test(p.time) ? p.time : null,
    type: p.type === 'carousel' || p.type === 'reel' ? p.type : 'photo',
    posted: p.posted === true,
    crop: normalizeCrop(p.crop),
  }
}

export function normalizeFilter(raw: unknown): FeedFilter {
  const f = (raw && typeof raw === 'object' ? raw : {}) as Partial<FeedFilter>
  return {
    brightness: clamp(f.brightness, 50, 150, 100),
    contrast: clamp(f.contrast, 50, 150, 100),
    saturation: clamp(f.saturation, 0, 200, 100),
    warmth: clamp(f.warmth, -100, 100, 0),
  }
}

export function isNeutralFilter(f: FeedFilter): boolean {
  return f.brightness === 100 && f.contrast === 100 && f.saturation === 100 && f.warmth === 0
}

export const FILTER_PRESETS: { name: string; filter: FeedFilter }[] = [
  { name: 'Original', filter: neutralFilter },
  { name: 'Warm', filter: { brightness: 104, contrast: 102, saturation: 108, warmth: 35 } },
  { name: 'Cool', filter: { brightness: 102, contrast: 104, saturation: 92, warmth: -35 } },
  { name: 'Faded', filter: { brightness: 108, contrast: 84, saturation: 82, warmth: 10 } },
  { name: 'Vivid', filter: { brightness: 102, contrast: 112, saturation: 130, warmth: 0 } },
  { name: 'Mono', filter: { brightness: 102, contrast: 110, saturation: 0, warmth: 0 } },
]

/** CSS / canvas filter string for brightness, contrast and saturation. Warmth is applied as an overlay. */
export function filterCss(f: FeedFilter): string {
  return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%)`
}

/**
 * Colour and opacity of the tint that warms or cools a photo. A plain translucent layer
 * (no blend mode) is cheap to render on every tile and draws identically on canvas.
 */
export function warmthOverlay(f: FeedFilter): { color: string; opacity: number } | null {
  if (f.warmth === 0) return null
  return { color: f.warmth > 0 ? '#ff8a1f' : '#2f7bff', opacity: (Math.abs(f.warmth) / 100) * 0.22 }
}

// ---- Dates and scheduling ---------------------------------------------------

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(value: string, days: number): string {
  const date = parseISODate(value)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function formatPlanned(post: Pick<PostDetails, 'date' | 'time'>): string | null {
  if (!post.date) return null
  const label = parseISODate(post.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return post.time ? `${label} · ${post.time}` : label
}

/** Sortable key for a planned moment; posts without a time sort to the start of their day. */
function plannedKey(post: PostDetails): string | null {
  return post.date ? `${post.date}T${post.time ?? '00:00'}` : null
}

/**
 * Ids of posts whose planned date comes before a post that must be published earlier.
 * Publishing out of order would shuffle the final grid, so these are flagged.
 */
export function scheduleConflicts(order: string[], posts: Record<string, PostDetails>): Set<string> {
  const conflicts = new Set<string>()
  // Walk in publishing order (bottom-right first) and track the latest planned moment so far.
  let latest: { key: string; id: string } | null = null
  for (let index = order.length - 1; index >= 0; index--) {
    const id = order[index]
    const post = getPost(posts, id)
    if (post.posted) continue
    const key = plannedKey(post)
    if (!key) continue
    if (latest && key < latest.key) {
      conflicts.add(id)
      conflicts.add(latest.id)
    } else {
      latest = { key, id }
    }
  }
  return conflicts
}

export interface AutoScheduleOptions {
  start: string
  everyDays: number
  time: string | null
  /** When false, posts that already have a date keep it. */
  overwrite: boolean
}

/** Assigns dates in publishing order, skipping published posts. Returns patches keyed by id. */
export function autoSchedule(order: string[], posts: Record<string, PostDetails>, options: AutoScheduleOptions): Record<string, Partial<PostDetails>> {
  const patches: Record<string, Partial<PostDetails>> = {}
  let date = options.start
  const step = Math.max(1, Math.round(options.everyDays))
  const sequence = order
    .map((id, index) => ({ id, n: postingNumber(index, order.length) }))
    .sort((a, b) => a.n - b.n)
  for (const { id } of sequence) {
    const post = getPost(posts, id)
    if (post.posted) continue
    if (!options.overwrite && post.date) continue
    patches[id] = { date, time: options.time }
    date = addDays(date, step)
  }
  return patches
}

/** Id of the next photo to publish: the lowest posting number that isn't marked as posted. */
export function nextToPost(order: string[], posts: Record<string, PostDetails>): string | null {
  for (let index = order.length - 1; index >= 0; index--) {
    if (!getPost(posts, order[index]).posted) return order[index]
  }
  return null
}
