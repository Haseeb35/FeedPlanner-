import { CalendarCheck, ListChecks, MousePointerClick, Send, Sparkles } from 'lucide-react'
import { Dialog } from './Dialog'

interface HelpDialogProps {
  open: boolean
  onClose: () => void
  onTour: () => void
  onChecklist: () => void
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl'

const SHORTCUTS: [string[], string][] = [
  [[mod, 'K'], 'Search actions, projects and captions'],
  [['?'], 'Open this help'],
  [['A'], 'Add photos'],
  [['P'], 'Post the next photo'],
  [['T'], 'Today'],
  [['G'], 'Grid'],
  [['C'], 'Calendar'],
  [[mod, 'Z'], 'Undo'],
  [[mod, 'Shift', 'Z'], 'Redo'],
  [['Delete'], 'Remove selected photos'],
  [['Esc'], 'Clear selection'],
  [['Space', '←↑→↓'], 'Move a focused photo with the keyboard'],
]

const STEPS = [
  { icon: MousePointerClick, title: 'Plan', text: 'Add photos and drag them around until your profile looks right. Top-left is your newest post.' },
  { icon: CalendarCheck, title: 'Schedule', text: 'Write captions and give each post a date. FeedPlanner keeps them in the right order.' },
  { icon: Send, title: 'Post', text: 'Each day, open Today and press Post now. It copies the caption and hands the photo to Instagram.' },
]

export function HelpDialog({ open, onClose, onTour, onChecklist }: HelpDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} size="md" title="Help & shortcuts" description="FeedPlanner helps you plan your Instagram grid before you post. Everything stays in this browser.">
      <div className="space-y-6">
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-xl border border-line p-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                {i + 1}. {title}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={onTour}>
            <Sparkles className="size-4" aria-hidden /> Take the tour again
          </button>
          <button type="button" className="btn btn-secondary" onClick={onChecklist}>
            <ListChecks className="size-4" aria-hidden /> Show getting started
          </button>
        </div>

        <section aria-labelledby="shortcuts-heading">
          <h3 id="shortcuts-heading" className="eyebrow mb-2">
            Keyboard shortcuts
          </h3>
          <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line text-sm">
            {SHORTCUTS.map(([keys, label]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-3 py-2">
                <dt className="text-muted">{label}</dt>
                <dd className="flex shrink-0 gap-1">
                  {keys.map((k) => (
                    <kbd key={k} className="min-w-6 rounded border border-line bg-subtle px-1.5 py-0.5 text-center text-xs font-medium">
                      {k}
                    </kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted">Single-letter shortcuts work when you’re not typing in a field.</p>
        </section>
      </div>
    </Dialog>
  )
}
