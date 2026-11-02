import type { PostDetails, Project } from '../types'
import { postingNumber } from './grid'
import { addDays, getPost, nextToPost, parseISODate } from './posts'

/** One post in the daily agenda. */
export interface AgendaItem {
  id: string
  /** Posting number: 1 is published first. */
  number: number
  post: PostDetails
  /** True for template spots that still need a photo. */
  empty: boolean
}

export interface Agenda {
  next: AgendaItem | null
  overdue: AgendaItem[]
  today: AgendaItem[]
  /** The next seven days after today. */
  upcoming: AgendaItem[]
  missingCaption: AgendaItem[]
  unscheduled: AgendaItem[]
  emptySpots: AgendaItem[]
  posted: number
  total: number
}

/** Everything still to do in a project, grouped for the Today screen. Posts are listed in publishing order. */
export function buildAgenda(project: Pick<Project, 'order' | 'posts' | 'slots'>, photoIds: ReadonlySet<string>, today: string): Agenda {
  const { order, posts } = project
  const items: AgendaItem[] = order
    .map((id, index) => ({ id, number: postingNumber(index, order.length), post: getPost(posts, id), empty: !photoIds.has(id) && !!project.slots[id] }))
    .sort((a, b) => a.number - b.number)
  const open = items.filter((i) => !i.post.posted)
  const weekEnd = addDays(today, 7)
  const nextId = nextToPost(order, posts)
  return {
    next: items.find((i) => i.id === nextId) ?? null,
    overdue: open.filter((i) => i.post.date && i.post.date < today),
    today: open.filter((i) => i.post.date === today),
    upcoming: open.filter((i) => i.post.date && i.post.date > today && i.post.date <= weekEnd).sort((a, b) => (a.post.date! < b.post.date! ? -1 : 1)),
    missingCaption: open.filter((i) => !i.post.caption.trim()),
    unscheduled: open.filter((i) => !i.post.date),
    emptySpots: open.filter((i) => i.empty),
    posted: items.length - open.length,
    total: items.length,
  }
}

/** "Today", "Tomorrow", "In 3 days", "2 days late"… relative to `today`. */
export function relativeDay(date: string, today: string): string {
  const days = Math.round((parseISODate(date).getTime() - parseISODate(today).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days < 0) return `${-days} days late`
  if (days < 7) return parseISODate(date).toLocaleDateString(undefined, { weekday: 'long' })
  return `In ${days} days`
}

const ARRANGED_KEY = 'fp-arranged'

/** Set once the person has reordered photos in any project. */
export function arrangedFlag(): boolean {
  try {
    return localStorage.getItem(ARRANGED_KEY) === '1'
  } catch {
    return true
  }
}

export function markArranged() {
  try {
    localStorage.setItem(ARRANGED_KEY, '1')
  } catch {
    // Not critical.
  }
}
