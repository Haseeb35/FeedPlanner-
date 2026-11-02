import type { ReactNode } from 'react'
import { ArrowRight, CalendarClock, CalendarPlus, Check, CircleCheck, Clapperboard, Copy, ImagePlus, MessageSquareText, PartyPopper, PenLine, Send, Shuffle, SquareUser, TriangleAlert, Wand2, X } from 'lucide-react'
import type { FeedFilter, LoadedImage, Project } from '../types'
import type { Agenda, AgendaItem } from '../lib/today'
import { arrangedFlag, relativeDay } from '../lib/today'
import { defaultProfile } from '../lib/db'
import { formatPlanned, parseISODate } from '../lib/posts'
import { pluralize } from '../lib/format'
import { TileImage } from './GridPhotoTile'

interface TodayViewProps {
  project: Project
  images: ReadonlyMap<string, LoadedImage>
  agenda: Agenda
  today: string
  hasPhotos: boolean
  conflicts: number
  checklistHidden: boolean
  onHideChecklist: () => void
  onPostNow: (id: string) => void
  onOpenPost: (id: string) => void
  onAddPhotos: () => void
  onAutoSchedule: () => void
  onCalendar: () => void
  onEditProfile: () => void
  onShowGrid: () => void
}

function Thumb({ image, filter, className = 'size-11' }: { image: LoadedImage | undefined; filter: FeedFilter; className?: string }) {
  return (
    <div className={`${className} shrink-0 overflow-hidden rounded-lg bg-subtle`}>
      <TileImage image={image} filter={filter} />
    </div>
  )
}

function typeLabel(item: AgendaItem) {
  return item.post.type === 'reel' ? 'Reel' : item.post.type === 'carousel' ? 'Carousel' : 'Photo'
}

function DueBadge({ date, today }: { date: string | null; today: string }) {
  if (!date) return <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-medium text-muted">No date yet</span>
  const late = date < today
  const now = date === today
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${late ? 'bg-danger/12 text-danger' : now ? 'bg-accent-soft text-accent' : 'bg-subtle text-muted'}`}>
      {relativeDay(date, today)}
    </span>
  )
}

/** "What do I need to do?" — the screen people see when they open FeedPlanner each day. */
export function TodayView(props: TodayViewProps) {
  const { project, images, agenda, today, hasPhotos, conflicts, checklistHidden, onHideChecklist, onPostNow, onOpenPost, onAddPhotos, onAutoSchedule, onCalendar, onEditProfile, onShowGrid } = props
  const { filter } = project
  const next = agenda.next
  const scheduled = agenda.total - agenda.posted - agenda.unscheduled.length
  const dateLabel = parseISODate(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  const steps: { key: string; done: boolean; title: string; text: string; action: ReactNode }[] = [
    {
      key: 'photos',
      done: hasPhotos,
      title: 'Add the photos you plan to post',
      text: 'Pick them from your phone or computer — or drag them onto the page.',
      action: (
        <button type="button" className="btn btn-primary h-8 text-xs" onClick={onAddPhotos}>
          <ImagePlus className="size-3.5" aria-hidden /> Add photos
        </button>
      ),
    },
    {
      key: 'arrange',
      done: hasPhotos && arrangedFlag(),
      title: 'Arrange your grid',
      text: 'See how your profile will look and drag photos until it feels right.',
      action: (
        <button type="button" className="btn btn-secondary h-8 text-xs" onClick={onShowGrid} disabled={!hasPhotos}>
          <Shuffle className="size-3.5" aria-hidden /> Open the grid
        </button>
      ),
    },
    {
      key: 'profile',
      done: project.profile.username !== defaultProfile.username,
      title: 'Add your username',
      text: 'So the preview looks like your real profile.',
      action: (
        <button type="button" className="btn btn-secondary h-8 text-xs" onClick={onEditProfile}>
          <SquareUser className="size-3.5" aria-hidden /> Edit profile
        </button>
      ),
    },
    {
      key: 'plan',
      done: scheduled > 0 || agenda.posted > 0,
      title: 'Plan your posting dates',
      text: 'Choose a start date and how often you post — every photo gets a date in the right order.',
      action: (
        <button type="button" className="btn btn-secondary h-8 text-xs" onClick={onAutoSchedule} disabled={!hasPhotos}>
          <Wand2 className="size-3.5" aria-hidden /> Plan dates
        </button>
      ),
    },
    {
      key: 'post',
      done: agenda.posted > 0,
      title: 'Post your first one',
      text: 'Post now copies the caption and hands the photo to Instagram.',
      action: (
        <button type="button" className="btn btn-secondary h-8 text-xs" onClick={() => next && onPostNow(next.id)} disabled={!next || next.empty}>
          <Send className="size-3.5" aria-hidden /> Post now
        </button>
      ),
    },
  ]
  const doneSteps = steps.filter((s) => s.done).length
  const firstOpen = steps.find((s) => !s.done)
  const showChecklist = !checklistHidden && doneSteps < steps.length

  const attention: { key: string; icon: ReactNode; text: string; onClick: () => void }[] = []
  if (agenda.emptySpots.length) attention.push({ key: 'empty', icon: <ImagePlus className="size-3.5" aria-hidden />, text: `${pluralize(agenda.emptySpots.length, 'empty spot')} to fill`, onClick: () => onOpenPost(agenda.emptySpots[0].id) })
  if (agenda.missingCaption.length) attention.push({ key: 'caption', icon: <MessageSquareText className="size-3.5" aria-hidden />, text: `${pluralize(agenda.missingCaption.length, 'post')} without a caption`, onClick: () => onOpenPost(agenda.missingCaption[0].id) })
  if (agenda.unscheduled.length) attention.push({ key: 'date', icon: <CalendarClock className="size-3.5" aria-hidden />, text: `${pluralize(agenda.unscheduled.length, 'post')} without a date`, onClick: onAutoSchedule })
  if (conflicts) attention.push({ key: 'order', icon: <TriangleAlert className="size-3.5" aria-hidden />, text: `${pluralize(conflicts, 'date')} out of posting order`, onClick: onAutoSchedule })

  const row = (item: AgendaItem, action: boolean) => (
    <li key={item.id}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpenPost(item.id)} aria-label={`Open post ${item.number}`}>
          <Thumb image={images.get(item.id)} filter={filter} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              Post {item.number}
              <span className="font-normal text-muted">· {typeLabel(item)}</span>
            </span>
            <span className="block truncate text-xs text-muted">{item.empty ? `Empty spot — ${images.get(item.id)?.slot?.note || 'add a photo'}` : item.post.caption.trim() || 'No caption yet'}</span>
          </span>
        </button>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <DueBadge date={item.post.date} today={today} />
          {item.post.time && <span className="text-[11px] text-muted tabular-nums">{item.post.time}</span>}
        </span>
        {action && !item.empty && (
          <button type="button" className="btn btn-secondary h-8 px-2.5 text-xs" onClick={() => onPostNow(item.id)} aria-label={`Post ${item.number} now`}>
            <Send className="size-3.5" aria-hidden /> Post
          </button>
        )}
      </div>
    </li>
  )

  const section = (id: string, title: string, items: AgendaItem[], action: boolean, tone?: 'danger') =>
    items.length > 0 && (
      <section aria-labelledby={id} className="animate-fade-up">
        <h2 id={id} className={`eyebrow mb-2 ${tone === 'danger' ? 'text-danger' : ''}`}>
          {title} · {items.length}
        </h2>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{items.map((i) => row(i, action))}</ul>
      </section>
    )

  // Overdue, today and upcoming without repeating the "Up next" post.
  const without = (items: AgendaItem[]) => items.filter((i) => i.id !== next?.id)

  return (
    <div className="space-y-6" data-tour="today">
      <div>
        <p className="text-sm text-muted">{dateLabel}</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{!hasPhotos ? 'Let’s plan your feed' : agenda.overdue.length ? 'A few posts are waiting' : agenda.today.length ? 'You have a post today' : next ? 'You’re on track' : 'All caught up'}</h1>
        {agenda.total > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-label="Posted" aria-valuemin={0} aria-valuemax={agenda.total} aria-valuenow={agenda.posted}>
              <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${(agenda.posted / agenda.total) * 100}%` }} />
            </div>
            <span className="text-xs text-muted tabular-nums">
              {agenda.posted} of {agenda.total} posted
            </span>
          </div>
        )}
      </div>

      {showChecklist && (
        <section aria-labelledby="getting-started" className="relative rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
          <button type="button" onClick={onHideChecklist} className="absolute top-3 right-3 rounded-md p-1 text-muted hover:bg-subtle hover:text-fg" aria-label="Hide getting started" title="Hide">
            <X className="size-4" aria-hidden />
          </button>
          <h2 id="getting-started" className="pr-8 text-sm font-semibold">
            Getting started · {doneSteps} of {steps.length} done
          </h2>
          <p className="mt-0.5 text-xs text-muted">Five steps from photos to your first post. Each one ticks itself off.</p>
          <ol className="mt-3 space-y-1">
            {steps.map((s, i) => {
              const current = s === firstOpen
              return (
                <li key={s.key} className={`rounded-xl px-2.5 py-2 ${current ? 'bg-surface shadow-sm' : ''}`}>
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${s.done ? 'bg-success text-white dark:text-[#06210f]' : current ? 'bg-accent text-accent-fg' : 'border border-line-strong text-muted'}`}
                      aria-hidden
                    >
                      {s.done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${s.done ? 'text-muted line-through decoration-muted/50' : 'font-medium'}`}>
                        {s.title}
                        {s.done && <span className="sr-only"> (done)</span>}
                      </p>
                      {current && (
                        <>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted">{s.text}</p>
                          <div className="mt-2">{s.action}</div>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {next ? (
        <section aria-labelledby="up-next" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 id="up-next" className="eyebrow">
              Up next
            </h2>
            <DueBadge date={next.post.date} today={today} />
          </div>
          <div className="flex gap-4 p-4">
            <button type="button" className="w-24 shrink-0 sm:w-28" onClick={() => onOpenPost(next.id)} aria-label={`Open post ${next.number}`}>
              <div className={`${project.aspect === 'portrait' ? 'aspect-[3/4]' : 'aspect-square'} overflow-hidden rounded-lg bg-subtle`}>
                <TileImage image={images.get(next.id)} crop={next.post.crop} filter={filter} />
              </div>
            </button>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="flex items-center gap-1.5 text-base font-semibold">
                Post {next.number}
                <span className="flex items-center gap-1 text-sm font-normal text-muted">
                  · {next.post.type === 'reel' ? <Clapperboard className="size-3.5" aria-hidden /> : next.post.type === 'carousel' ? <Copy className="size-3.5" aria-hidden /> : null}
                  {typeLabel(next)}
                </span>
              </p>
              <p className="text-xs text-muted">{formatPlanned(next.post) ?? 'No date planned'}</p>
              <p className={`mt-2 line-clamp-3 text-sm leading-relaxed break-words ${next.post.caption.trim() ? '' : 'text-muted italic'}`}>
                {next.empty ? `Empty spot — ${images.get(next.id)?.slot?.note || 'add a photo first'}` : next.post.caption.trim() || 'No caption yet'}
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-3">
                {next.empty ? (
                  <button type="button" className="btn btn-primary" onClick={() => onOpenPost(next.id)}>
                    <ImagePlus className="size-4" aria-hidden /> Add photo
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={() => onPostNow(next.id)} data-tour="post-now">
                    <Send className="size-4" aria-hidden /> Post now
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => onOpenPost(next.id)}>
                  <PenLine className="size-4" aria-hidden /> Edit details
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        hasPhotos && (
          <section className="rounded-2xl border border-line bg-surface p-6 text-center">
            <PartyPopper className="mx-auto size-7 text-success" aria-hidden />
            <p className="mt-2 font-semibold">Everything in this plan is posted</p>
            <p className="mt-1 text-sm text-muted">Add your next batch of photos to keep going.</p>
            <button type="button" className="btn btn-primary mt-4" onClick={onAddPhotos}>
              <ImagePlus className="size-4" aria-hidden /> Add photos
            </button>
          </section>
        )
      )}

      {section('overdue', 'Overdue', without(agenda.overdue), true, 'danger')}
      {section('due-today', 'Due today', without(agenda.today), true)}
      {section('this-week', 'Coming up this week', without(agenda.upcoming), false)}

      {attention.length > 0 && (
        <section aria-labelledby="attention">
          <h2 id="attention" className="eyebrow mb-2">
            Needs attention
          </h2>
          <ul className="flex flex-wrap gap-2">
            {attention.map((a) => (
              <li key={a.key}>
                <button type="button" onClick={a.onClick} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs hover:border-line-strong hover:bg-subtle">
                  {a.icon} {a.text} <ArrowRight className="size-3 text-muted" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasPhotos && (
        <section aria-labelledby="reminders" className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-subtle">
            <CalendarPlus className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="reminders" className="text-sm font-semibold">
              Get reminders
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {scheduled > 0
                ? `Add your ${pluralize(scheduled, 'planned post')} to Google, Apple or Outlook calendar. Each one comes with a reminder, even when FeedPlanner is closed.`
                : 'Plan your posting dates first, then add them to your calendar to get a reminder before each post.'}
            </p>
            <button type="button" className="btn btn-secondary mt-2.5 h-8 text-xs" onClick={scheduled > 0 ? onCalendar : onAutoSchedule}>
              {scheduled > 0 ? <CalendarPlus className="size-3.5" aria-hidden /> : <Wand2 className="size-3.5" aria-hidden />}
              {scheduled > 0 ? 'Add to calendar' : 'Plan dates'}
            </button>
          </div>
        </section>
      )}

      {agenda.total > 0 && !next && agenda.posted === agenda.total && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
          <CircleCheck className="size-3.5 text-success" aria-hidden /> {pluralize(agenda.posted, 'post')} published from this plan.
        </p>
      )}
    </div>
  )
}
