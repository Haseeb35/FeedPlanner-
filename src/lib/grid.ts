/**
 * Pure helpers for grid ordering and undo/redo history.
 *
 * Grid order convention: index 0 is the top-left tile. On Instagram that tile is the
 * most recent post, so it must be published last. The grid is never reversed silently;
 * posting numbers are derived from it instead.
 */

export const COLUMNS = 3
export const HISTORY_LIMIT = 100

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return [...list]
  const target = Math.max(0, Math.min(to, list.length - 1))
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(target, 0, item)
  return next
}

export function removeId(order: readonly string[], id: string): string[] {
  return order.filter((x) => x !== id)
}

export function replaceId(order: readonly string[], oldId: string, newId: string): string[] {
  return order.map((x) => (x === oldId ? newId : x))
}

export type InsertPosition = 'start' | 'end'

export function insertIds(order: readonly string[], ids: readonly string[], position: InsertPosition): string[] {
  const fresh = ids.filter((id) => !order.includes(id))
  return position === 'start' ? [...fresh, ...order] : [...order, ...fresh]
}

/** 1-based number telling the user in which sequence to publish the photo at `index`. */
export function postingNumber(index: number, total: number): number {
  return total - index
}

export function rowCount(total: number): number {
  return Math.ceil(total / COLUMNS)
}

export function gridPosition(index: number): { row: number; column: number } {
  return { row: Math.floor(index / COLUMNS) + 1, column: (index % COLUMNS) + 1 }
}

export interface History {
  past: string[][]
  future: string[][]
}

export const emptyHistory: History = { past: [], future: [] }

/** Record `previous` before applying a new order. Clears the redo stack. */
export function record(history: History, previous: string[]): History {
  const past = [...history.past, previous]
  if (past.length > HISTORY_LIMIT) past.shift()
  return { past, future: [] }
}

export function undo(history: History, present: string[]): { history: History; present: string[] } | null {
  if (history.past.length === 0) return null
  const past = history.past.slice(0, -1)
  const previous = history.past[history.past.length - 1]
  return { history: { past, future: [present, ...history.future] }, present: previous }
}

export function redo(history: History, present: string[]): { history: History; present: string[] } | null {
  if (history.future.length === 0) return null
  const [next, ...future] = history.future
  return { history: { past: [...history.past, present], future }, present: next }
}
