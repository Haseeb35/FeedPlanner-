import type { PostDetails, PostType, Project, Slot, TileAspect } from '../types'
import { createProject } from './db'
import { createId } from './id'
import { addDays, autoSchedule, getPost, toISODate } from './posts'
import { rgbToLab, toHex, type ColorInfo, type RGB } from './colors'

/**
 * Feed templates: a feed idea without the photos. A template describes each spot in the
 * grid (post type, a colour hint and a note), optional captions and a posting rhythm.
 * It is small enough to live entirely inside a link, so sharing needs no server: the
 * data sits in the URL fragment, which browsers never send to the web server.
 */

export interface TemplateTile {
  type: PostType
  color: string
  note: string
  caption?: string
}

export interface FeedTemplate {
  v: 1
  name: string
  description?: string
  aspect: TileAspect
  tiles: TemplateTile[]
  /** Posting rhythm, applied from tomorrow when the template is used. */
  cadence: { everyDays: number; time: string | null } | null
}

export const MAX_TEMPLATE_TILES = 60
const HASH_KEY = 't'
/** Links longer than this may be cut off by some chat apps. */
export const LONG_LINK = 6000

export class TemplateError extends Error {
  constructor(message = 'This template link is incomplete or damaged. Ask for a new link.') {
    super(message)
    this.name = 'TemplateError'
  }
}

// ---- Validation -----------------------------------------------------------------

const HEX = /^#[0-9a-f]{6}$/i
const TIME = /^\d{2}:\d{2}$/
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '')

export function normalizeTemplate(raw: unknown): FeedTemplate {
  const t = raw as Partial<FeedTemplate> | null
  if (!t || typeof t !== 'object' || t.v !== 1 || !Array.isArray(t.tiles) || t.tiles.length === 0) throw new TemplateError()
  const tiles: TemplateTile[] = t.tiles.slice(0, MAX_TEMPLATE_TILES).map((raw) => {
    const tile = (raw && typeof raw === 'object' ? raw : {}) as Partial<TemplateTile>
    const caption = text(tile.caption, 2200)
    return {
      type: tile.type === 'carousel' || tile.type === 'reel' ? tile.type : 'photo',
      color: typeof tile.color === 'string' && HEX.test(tile.color) ? tile.color.toLowerCase() : '#d9d4cb',
      note: text(tile.note, 60),
      ...(caption ? { caption } : {}),
    }
  })
  const cadence =
    t.cadence && typeof t.cadence === 'object' && Number.isFinite(t.cadence.everyDays)
      ? { everyDays: Math.min(30, Math.max(1, Math.round(t.cadence.everyDays))), time: typeof t.cadence.time === 'string' && TIME.test(t.cadence.time) ? t.cadence.time : null }
      : null
  const description = text(t.description, 200)
  return {
    v: 1,
    name: text(t.name, 80).trim() || 'Shared feed idea',
    ...(description ? { description } : {}),
    aspect: t.aspect === 'square' ? 'square' : 'portrait',
    tiles,
    cadence,
  }
}

// ---- Encoding (JSON → deflate → base64url) ------------------------------------------

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

/** Compact, URL-safe text for a template. Prefixed "z" when compressed, "j" when not. */
export async function encodeTemplate(template: FeedTemplate): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(template))
  if (typeof CompressionStream === 'function') return `z${toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))}`
  return `j${toBase64Url(json)}`
}

export async function decodeTemplate(value: string): Promise<FeedTemplate> {
  try {
    const kind = value[0]
    const bytes = fromBase64Url(value.slice(1))
    let json: Uint8Array
    if (kind === 'z') {
      if (typeof DecompressionStream !== 'function') throw new TemplateError('This browser can’t open template links. Try an up-to-date Chrome, Edge, Firefox or Safari.')
      json = await pipe(bytes, new DecompressionStream('deflate-raw'))
    } else if (kind === 'j') {
      json = bytes
    } else {
      throw new TemplateError()
    }
    return normalizeTemplate(JSON.parse(new TextDecoder().decode(json)))
  } catch (error) {
    throw error instanceof TemplateError ? error : new TemplateError()
  }
}

export function templateLink(encoded: string, base = `${location.origin}${location.pathname}`): string {
  return `${base}#${HASH_KEY}=${encoded}`
}

/** The encoded template in a URL fragment such as "#t=z…", if any. */
export function templateFromHash(hash: string): string | null {
  const match = /^#?t=([A-Za-z0-9_-]+)$/.exec(hash)
  return match ? match[1] : null
}

// ---- Project ↔ template ----------------------------------------------------------------

/** A plain-language hint for a colour, e.g. "Light · warm tones". */
export function describeColor(rgb: RGB): string {
  const [l, a, b] = rgbToLab(rgb)
  const light = l > 72 ? 'Light' : l < 38 ? 'Dark' : 'Mid-tone'
  const chroma = Math.hypot(a, b)
  const tone = chroma < 10 ? 'neutral' : b > 8 && a > -10 ? 'warm tones' : b < -6 || a < -12 ? 'cool tones' : 'soft colour'
  return `${light} · ${tone}`
}

/** Text colour that stays readable on an empty spot's background. */
export function slotTextColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const [l] = rgbToLab([(n >> 16) & 255, (n >> 8) & 255, n & 255])
  return l > 60 ? '#1b1916' : '#ffffff'
}

/** Most common gap between planned posts, and the most common time. */
function cadenceOf(project: Project): FeedTemplate['cadence'] {
  const posts = project.order.map((id) => getPost(project.posts, id)).filter((p) => p.date)
  if (posts.length < 2) return null
  const dates = [...new Set(posts.map((p) => p.date!))].sort()
  const gaps = new Map<number, number>()
  for (let i = 1; i < dates.length; i++) {
    const gap = Math.round((Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 86_400_000)
    if (gap > 0) gaps.set(gap, (gaps.get(gap) ?? 0) + 1)
  }
  const times = new Map<string, number>()
  for (const p of posts) if (p.time) times.set(p.time, (times.get(p.time) ?? 0) + 1)
  const most = <T,>(m: Map<T, number>) => [...m].sort((x, y) => y[1] - x[1])[0]?.[0]
  const everyDays = most(gaps)
  return everyDays ? { everyDays, time: most(times) ?? null } : null
}

export interface TemplateOptions {
  captions: boolean
  schedule: boolean
}

/** Turns a project into a shareable template. Photos are described, never included. */
export function templateFromProject(project: Project, colors: ReadonlyMap<string, ColorInfo>, options: TemplateOptions): FeedTemplate {
  const tiles = project.order.slice(0, MAX_TEMPLATE_TILES).map((id): TemplateTile => {
    const post = getPost(project.posts, id)
    const slot = project.slots[id]
    const info = colors.get(id)
    const color = slot?.color ?? (info ? toHex(info.average) : '#d9d4cb')
    const note = slot?.note ?? (info ? describeColor(info.average) : 'Photo')
    const caption = options.captions ? post.caption.trim() : ''
    return { type: post.type, color, note, ...(caption ? { caption } : {}) }
  })
  return { v: 1, name: project.name, aspect: project.aspect, tiles, cadence: options.schedule ? cadenceOf(project) : null }
}

/** Builds a new project whose grid is made of empty spots, ready to be filled with photos. */
export function projectFromTemplate(template: FeedTemplate, today = new Date()): Project {
  const project = createProject(template.name, template.aspect)
  const posts: Record<string, PostDetails> = {}
  const slots: Record<string, Slot> = {}
  for (const tile of template.tiles) {
    const id = createId()
    project.order.push(id)
    slots[id] = { note: tile.note, color: tile.color }
    posts[id] = { caption: tile.caption ?? '', date: null, time: null, type: tile.type, posted: false, crop: null }
  }
  if (template.cadence) {
    const patches = autoSchedule(project.order, posts, { start: addDays(toISODate(today), 1), everyDays: template.cadence.everyDays, time: template.cadence.time, overwrite: true })
    for (const [id, patch] of Object.entries(patches)) posts[id] = { ...posts[id], ...patch }
  }
  project.posts = posts
  project.slots = slots
  return project
}

// ---- Built-in ideas ------------------------------------------------------------------------

const tile = (note: string, color: string, type: PostType = 'photo', caption?: string): TemplateTile => ({ note, color, type, ...(caption ? { caption } : {}) })

function repeat(count: number, make: (i: number) => TemplateTile): TemplateTile[] {
  return Array.from({ length: count }, (_, i) => make(i))
}

export const BUILT_IN_TEMPLATES: FeedTemplate[] = [
  {
    v: 1,
    name: 'Checkerboard',
    description: 'Alternate photos with quote or text tiles for a calm, balanced grid.',
    aspect: 'portrait',
    cadence: { everyDays: 2, time: '18:00' },
    tiles: repeat(12, (i) => (i % 2 === 0 ? tile('Photo', '#c98b62') : tile('Quote or text tile', '#f1ece3'))),
  },
  {
    v: 1,
    name: 'Row by row',
    description: 'Each row tells one story: behind the scenes, product, people, details.',
    aspect: 'portrait',
    cadence: { everyDays: 1, time: '12:00' },
    tiles: [
      ...repeat(3, () => tile('Behind the scenes', '#8a6f5a')),
      ...repeat(3, (i) => tile('Product shot', '#e7dccb', i === 1 ? 'carousel' : 'photo')),
      ...repeat(3, (i) => tile('People / portrait', '#b9826b', i === 1 ? 'reel' : 'photo')),
      ...repeat(3, () => tile('Close-up detail', '#5f6b5a')),
    ],
  },
  {
    v: 1,
    name: 'Vertical stripes',
    description: 'Columns with a fixed role: portraits left, words in the middle, places right.',
    aspect: 'portrait',
    cadence: { everyDays: 2, time: '19:00' },
    tiles: repeat(12, (i) => [tile('Portrait', '#a7765c'), tile('Quote or text tile', '#efe8dc'), tile('Landscape', '#6f8a8f')][i % 3]),
  },
  {
    v: 1,
    name: 'Warm to cool',
    description: 'A colour gradient that drifts from warm sunsets down to cool blues.',
    aspect: 'portrait',
    cadence: { everyDays: 2, time: '18:00' },
    tiles: ['#e8a36b', '#e6965f', '#d98b5f', '#d9a37e', '#cfa58e', '#c4a89a', '#a9aaa4', '#9fb1b5', '#8fb0bd', '#7fa6b8', '#6f98ad', '#5d87a0'].map((c, i) =>
      tile(i < 4 ? 'Warm tones' : i < 8 ? 'Soft neutral tones' : 'Cool tones', c),
    ),
  },
  {
    v: 1,
    name: 'Launch countdown',
    description: 'Tease a launch for three days, reveal it, then show it in use.',
    aspect: 'portrait',
    cadence: { everyDays: 1, time: '18:00' },
    tiles: [
      tile('Product in use', '#d8c3a5', 'photo', 'Here’s how it looks in real life. Link in bio.'),
      tile('Customer / review', '#e9dfd2', 'carousel', 'Your first reactions are in — thank you!'),
      tile('Detail close-up', '#b48a6a', 'photo', 'The little details we obsessed over.'),
      tile('The reveal', '#2d2a26', 'reel', 'It’s here. Introducing our new collection ✨'),
      tile('Big picture · 1 of 2', '#c7a17a', 'photo', 'Tomorrow.'),
      tile('Big picture · 2 of 2', '#c7a17a', 'photo', 'Tomorrow.'),
      tile('Teaser: 1 day to go', '#3a3631', 'reel', '1 day to go…'),
      tile('Teaser: 2 days to go', '#4a443d', 'photo', '2 days to go…'),
      tile('Teaser: 3 days to go', '#5b544b', 'photo', 'Something new is coming. 3 days to go…'),
    ],
  },
  {
    v: 1,
    name: 'Big picture puzzle',
    description: 'One large image split across nine tiles, with a row of regular posts above.',
    aspect: 'portrait',
    cadence: { everyDays: 1, time: '18:00' },
    tiles: [...repeat(3, () => tile('Regular post', '#c9b8a3')), ...repeat(9, (i) => tile(`Big picture · tile ${i + 1} of 9`, '#7d8f86'))],
  },
]
