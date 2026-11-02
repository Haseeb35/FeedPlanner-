import { CAPTION_LIMIT } from './posts'
import { createId } from './id'

/**
 * Saved hashtag sets and caption snippets ("New collection every Friday ✨"). They're shared by
 * every project in this browser, so they live in localStorage rather than in a project.
 */

export type SnippetKind = 'hashtags' | 'text'

export interface Snippet {
  id: string
  kind: SnippetKind
  name: string
  text: string
}

const KEY = 'fp-snippets'
const CHANGE = 'fp-snippets-change'
export const SNIPPET_NAME_LIMIT = 40
export const SNIPPET_LIMIT = 50

const HASHTAG_RE = /(?:^|\s)(#[\p{L}\p{N}_]+)/gu

/** Hashtags in a text, in order, each once (case-insensitive). */
export function extractHashtags(text: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const match of text.matchAll(HASHTAG_RE)) {
    const key = match[1].toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      tags.push(match[1])
    }
  }
  return tags
}

/** Hashtags that appear more than once in a caption. */
export function duplicateHashtags(text: string): string[] {
  const counts = new Map<string, number>()
  for (const match of text.matchAll(HASHTAG_RE)) counts.set(match[1].toLowerCase(), (counts.get(match[1].toLowerCase()) ?? 0) + 1)
  return [...counts].filter(([, n]) => n > 1).map(([tag]) => tag)
}

/** Turns "ceramics, #handmade  lisbon" into "#ceramics #handmade #lisbon". */
export function normalizeHashtagText(text: string): string {
  return extractHashtags(
    text
      .split(/[\s,]+/)
      .map((word) => word.trim())
      .filter(Boolean)
      .map((word) => (word.startsWith('#') ? word : `#${word}`))
      .join(' '),
  ).join(' ')
}

export interface InsertResult {
  caption: string
  /** Hashtags skipped because the caption already had them. */
  skipped: number
  truncated: boolean
}

/** Adds a snippet to the end of a caption. Hashtag sets only add tags the caption doesn't have yet. */
export function insertSnippet(caption: string, snippet: Pick<Snippet, 'kind' | 'text'>): InsertResult {
  let addition = snippet.text.trim()
  let skipped = 0
  if (snippet.kind === 'hashtags') {
    const existing = new Set(extractHashtags(caption).map((t) => t.toLowerCase()))
    const tags = extractHashtags(addition)
    const fresh = tags.filter((t) => !existing.has(t.toLowerCase()))
    skipped = tags.length - fresh.length
    addition = fresh.join(' ')
  }
  if (!addition) return { caption, skipped, truncated: false }
  const base = caption.replace(/\s+$/, '')
  // Hashtags usually sit on their own line under the caption; text snippets get a blank line before them.
  const separator = !base ? '' : snippet.kind === 'hashtags' ? (/(^|\n)\s*#\S+$/.test(base) ? ' ' : '\n\n') : '\n\n'
  const full = base + separator + addition
  return { caption: full.slice(0, CAPTION_LIMIT), skipped, truncated: full.length > CAPTION_LIMIT }
}

function normalize(raw: unknown): Snippet[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s): s is Snippet => !!s && typeof s === 'object' && typeof s.name === 'string' && typeof s.text === 'string')
    .slice(0, SNIPPET_LIMIT)
    .map((s) => ({
      id: typeof s.id === 'string' ? s.id : createId(),
      kind: s.kind === 'text' ? 'text' : 'hashtags',
      name: s.name.slice(0, SNIPPET_NAME_LIMIT),
      text: s.text.slice(0, CAPTION_LIMIT),
    }))
}

let cache: { raw: string | null; value: Snippet[] } | null = null

export function loadSnippets(): Snippet[] {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    // Storage blocked: start empty.
  }
  // Same array while the stored value is unchanged, as useSyncExternalStore requires.
  if (cache && cache.raw === raw) return cache.value
  let value: Snippet[]
  try {
    value = raw ? normalize(JSON.parse(raw)) : []
  } catch {
    value = []
  }
  cache = { raw, value }
  return value
}

/** Returns false when the browser refused to store them. */
export function saveSnippets(list: Snippet[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, SNIPPET_LIMIT)))
    window.dispatchEvent(new Event(CHANGE))
    return true
  } catch {
    return false
  }
}

export function subscribeSnippets(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => event.key === KEY && callback()
  window.addEventListener(CHANGE, callback)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE, callback)
    window.removeEventListener('storage', onStorage)
  }
}
