import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import type { PostDetails } from '../types'
import { Dialog } from './Dialog'
import { addDays, autoSchedule, formatPlanned, getPost, toISODate } from '../lib/posts'
import { pluralize } from '../lib/format'

interface AutoScheduleDialogProps {
  open: boolean
  order: string[]
  posts: Record<string, PostDetails>
  onClose: () => void
  onApply: (patches: Record<string, Partial<PostDetails>>) => void
}

export function AutoScheduleDialog(props: AutoScheduleDialogProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} size="sm" title="Auto-schedule posts" description="Spread your posts out in posting order, starting with post 1. Posts already marked as posted are skipped.">
      <AutoScheduleForm {...props} />
    </Dialog>
  )
}

function AutoScheduleForm({ order, posts, onClose, onApply }: AutoScheduleDialogProps) {
  const [start, setStart] = useState(() => addDays(toISODate(new Date()), 1))
  const [everyDays, setEveryDays] = useState(2)
  const [time, setTime] = useState('18:00')
  const [overwrite, setOverwrite] = useState(true)

  const patches = start ? autoSchedule(order, posts, { start, everyDays, time: time || null, overwrite }) : {}
  const count = Object.keys(patches).length
  const dates = Object.values(patches)
    .map((p) => p.date!)
    .sort()
  const unposted = order.filter((id) => !getPost(posts, id).posted).length

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (count) onApply(patches)
        onClose()
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="as-start" className="label">
            First post on
          </label>
          <input id="as-start" type="date" className="field" value={start} required onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label htmlFor="as-time" className="label">
            At
          </label>
          <input id="as-time" type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor="as-every" className="label">
          Post every
        </label>
        <select id="as-every" className="field" value={everyDays} onChange={(e) => setEveryDays(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 7, 14].map((n) => (
            <option key={n} value={n}>
              {n === 1 ? 'day' : n === 7 ? 'week' : n === 14 ? 'two weeks' : `${n} days`}
            </option>
          ))}
        </select>
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--app-accent)]" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
        <span>
          Replace existing dates
          <span className="block text-xs text-muted">When off, only unscheduled posts get a date.</span>
        </span>
      </label>
      <p className="rounded-lg bg-subtle px-3 py-2.5 text-xs leading-relaxed text-muted">
        {count === 0
          ? unposted === 0
            ? 'Every post is already marked as posted.'
            : 'No posts need a date.'
          : `${pluralize(count, 'post')} from ${formatPlanned({ date: dates[0], time: null })} to ${formatPlanned({ date: dates[dates.length - 1], time: null })}.`}
      </p>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={count === 0}>
          <Wand2 className="size-4" aria-hidden /> Schedule {count ? pluralize(count, 'post') : ''}
        </button>
      </div>
    </form>
  )
}
