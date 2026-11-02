import { useMemo, useState } from 'react'
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CalendarClock, ChevronLeft, ChevronRight, CircleCheck, TriangleAlert, Wand2 } from 'lucide-react'
import type { FeedFilter, LoadedImage, PostDetails } from '../types'
import { postingNumber } from '../lib/grid'
import { getPost, parseISODate, toISODate } from '../lib/posts'
import { pluralize } from '../lib/format'
import { TileImage } from './GridPhotoTile'

interface ScheduleViewProps {
  order: string[]
  images: ReadonlyMap<string, LoadedImage>
  posts: Record<string, PostDetails>
  filter: FeedFilter
  conflicts: ReadonlySet<string>
  selectedIds: ReadonlySet<string>
  onSelect: (id: string, additive: boolean) => void
  onReschedule: (id: string, date: string | null) => void
  onAutoSchedule: () => void
}

const UNSCHEDULED = 'unscheduled'
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, i + 1).toLocaleDateString(undefined, { weekday: 'narrow' }))

/** Monday-first weeks covering the month. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  const weeks = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7)
  return Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

interface ChipProps {
  id: string
  number: number
  image: LoadedImage | undefined
  post: PostDetails
  filter: FeedFilter
  selected: boolean
  conflict: boolean
  onSelect: (id: string, additive: boolean) => void
}

function PostChip({ id, number, image, post, filter, selected, conflict, onSelect }: ChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled: post.posted })
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={(e) => onSelect(id, e.metaKey || e.ctrlKey || e.shiftKey)}
      aria-label={`Post ${number}: ${image?.name ?? 'photo'}${post.time ? ` at ${post.time}` : ''}${post.posted ? ', posted' : ''}${conflict ? ', out of order' : ''}`}
      aria-pressed={selected}
      className={`relative block aspect-[3/4] w-full touch-manipulation overflow-hidden rounded-[5px] bg-subtle ${isDragging ? 'opacity-30' : ''} ${
        selected ? 'ring-2 ring-accent' : conflict ? 'ring-2 ring-amber-400' : ''
      } ${post.posted ? 'cursor-pointer' : 'cursor-grab'}`}
    >
      <span className={`block size-full ${post.posted ? 'opacity-50' : ''}`}>
        <TileImage image={image} crop={post.crop} filter={filter} />
      </span>
      <span className={`absolute top-0.5 left-0.5 rounded px-1 text-[9px] leading-tight font-semibold tabular-nums ${post.posted ? 'bg-success text-white' : 'bg-white/90 text-[#1b1916]'}`}>
        {number}
      </span>
    </button>
  )
}

function DayCell({ date, inMonth, today, children, count }: { date: string; inMonth: boolean; today: boolean; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: date })
  const day = parseISODate(date).getDate()
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={`${parseISODate(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, ${pluralize(count, 'post')}`}
      className={`min-h-20 min-w-0 border-t border-l border-line p-1 transition-colors sm:min-h-24 ${inMonth ? 'bg-surface' : 'bg-bg text-muted'} ${isOver ? 'bg-accent-soft' : ''}`}
    >
      <span className={`mb-1 flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums ${today ? 'bg-accent font-semibold text-accent-fg' : ''}`}>{day}</span>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function Tray({ children, count }: { children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNSCHEDULED })
  return (
    <section ref={setNodeRef} aria-label="Unscheduled posts" className={`rounded-xl border border-dashed p-3 transition-colors ${isOver ? 'border-accent bg-accent-soft' : 'border-line-strong'}`}>
      <h3 className="mb-2 text-xs font-semibold">
        Unscheduled <span className="font-normal text-muted">· {count}</span>
      </h3>
      {count === 0 ? (
        <p className="text-xs text-muted">Every post has a date. Drag one here to unschedule it.</p>
      ) : (
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">{children}</div>
      )}
    </section>
  )
}

export function ScheduleView({ order, images, posts, filter, conflicts, selectedIds, onSelect, onReschedule, onAutoSchedule }: ScheduleViewProps) {
  const todayISO = toISODate(new Date())
  // Open on the month of the next planned post, or the current month.
  const [cursor, setCursor] = useState(() => {
    const upcoming = order
      .map((id) => getPost(posts, id))
      .filter((p) => p.date && !p.posted && p.date >= todayISO)
      .map((p) => p.date!)
      .sort()[0]
    const d = upcoming ? parseISODate(upcoming) : new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const byDate = useMemo(() => {
    const map = new Map<string, { id: string; number: number; post: PostDetails }[]>()
    order.forEach((id, index) => {
      const post = getPost(posts, id)
      if (!post.date) return
      const list = map.get(post.date) ?? []
      list.push({ id, number: postingNumber(index, order.length), post })
      map.set(post.date, list)
    })
    for (const list of map.values()) list.sort((a, b) => (a.post.time ?? '').localeCompare(b.post.time ?? '') || a.number - b.number)
    return map
  }, [order, posts])

  const unscheduled = order
    .map((id, index) => ({ id, number: postingNumber(index, order.length), post: getPost(posts, id) }))
    .filter((p) => !p.post.date)
    .sort((a, b) => a.number - b.number)
  const scheduledCount = order.length - unscheduled.length
  const postedCount = order.filter((id) => getPost(posts, id).posted).length

  const days = monthGrid(cursor.year, cursor.month)
  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })

  const handleEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const id = String(event.active.id)
    const target = event.over ? String(event.over.id) : null
    if (!target) return
    const date = target === UNSCHEDULED ? null : target
    if (getPost(posts, id).date !== date) onReschedule(id, date)
  }

  const chip = (item: { id: string; number: number; post: PostDetails }) => (
    <PostChip
      key={item.id}
      id={item.id}
      number={item.number}
      image={images.get(item.id)}
      post={item.post}
      filter={filter}
      selected={selectedIds.has(item.id)}
      conflict={conflicts.has(item.id)}
      onSelect={onSelect}
    />
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5" aria-hidden /> {scheduledCount} of {order.length} scheduled
        </span>
        <span className="flex items-center gap-1.5">
          <CircleCheck className="size-3.5 text-success" aria-hidden /> {postedCount} posted
        </span>
        <button type="button" className="btn btn-secondary ml-auto h-8 px-3 text-xs" onClick={onAutoSchedule} disabled={order.length === 0}>
          <Wand2 className="size-3.5" aria-hidden /> Auto-schedule
        </button>
      </div>

      {conflicts.size > 0 && (
        <p role="note" className="flex gap-2 rounded-xl bg-amber-400/15 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {pluralize(conflicts.size, 'post')} {conflicts.size === 1 ? 'is' : 'are'} scheduled out of posting order. Publish in number order so the grid comes out as planned.
        </p>
      )}

      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={handleEnd} onDragCancel={() => setActiveId(null)}>
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="flex items-center justify-between bg-surface px-2 py-2">
            <button type="button" className="btn btn-ghost btn-icon h-8 w-8" onClick={() => shift(-1)} aria-label="Previous month">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold" aria-live="polite">
                {title}
              </h2>
              <button
                type="button"
                className="rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-subtle hover:text-fg"
                onClick={() => setCursor({ year: new Date().getFullYear(), month: new Date().getMonth() })}
              >
                Today
              </button>
            </div>
            <button type="button" className="btn btn-ghost btn-icon h-8 w-8" onClick={() => shift(1)} aria-label="Next month">
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <div role="grid" aria-label={title} className="grid grid-cols-7 border-r border-b border-line">
            {WEEKDAYS.map((d, i) => (
              <div key={i} role="columnheader" className="border-t border-l border-line bg-subtle py-1 text-center text-[11px] font-medium text-muted">
                {d}
              </div>
            ))}
            {days.map((d) => {
              const iso = toISODate(d)
              const items = byDate.get(iso) ?? []
              return (
                <DayCell key={iso} date={iso} inMonth={d.getMonth() === cursor.month} today={iso === todayISO} count={items.length}>
                  {items.map(chip)}
                </DayCell>
              )
            })}
          </div>
        </div>

        <Tray count={unscheduled.length}>{unscheduled.map(chip)}</Tray>

        <DragOverlay>
          {activeId ? (
            <div className="aspect-[3/4] w-12 overflow-hidden rounded-md shadow-xl ring-2 ring-accent">
              <TileImage image={images.get(activeId)} crop={getPost(posts, activeId).crop} filter={filter} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <p className="text-xs leading-relaxed text-muted">Drag posts between days to reschedule, or select one to set an exact date and time. Published posts are locked.</p>
    </div>
  )
}
