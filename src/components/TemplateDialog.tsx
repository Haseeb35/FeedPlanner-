import { CalendarClock, Clapperboard, Copy, Gift, LayoutGrid, MessageSquareText } from 'lucide-react'
import { Dialog } from './Dialog'
import { TemplatePreview } from './TemplatePreview'
import { BUILT_IN_TEMPLATES, type FeedTemplate } from '../lib/templates'
import { pluralize } from '../lib/format'

export type TemplateDialogState = { kind: 'gallery' } | { kind: 'shared'; template: FeedTemplate } | null

interface TemplateDialogProps {
  state: TemplateDialogState
  busy: boolean
  onUse: (template: FeedTemplate) => void
  onClose: () => void
}

function rhythm(template: FeedTemplate) {
  if (!template.cadence) return null
  const { everyDays, time } = template.cadence
  return `Every ${everyDays === 1 ? 'day' : everyDays === 7 ? 'week' : `${everyDays} days`}${time ? ` at ${time}` : ''}`
}

function Facts({ template }: { template: FeedTemplate }) {
  const count = (type: string) => template.tiles.filter((t) => t.type === type).length
  const captions = template.tiles.filter((t) => t.caption).length
  const facts: [React.ElementType, string][] = [[LayoutGrid, `${pluralize(template.tiles.length, 'post')} · ${template.aspect === 'portrait' ? '3:4' : '1:1'} tiles`]]
  if (count('carousel')) facts.push([Copy, pluralize(count('carousel'), 'carousel')])
  if (count('reel')) facts.push([Clapperboard, pluralize(count('reel'), 'Reel')])
  if (captions) facts.push([MessageSquareText, `${pluralize(captions, 'caption')} included`])
  if (template.cadence) facts.push([CalendarClock, rhythm(template)!])
  return (
    <ul className="space-y-1.5 text-sm">
      {facts.map(([Icon, text]) => (
        <li key={text} className="flex items-center gap-2 text-muted">
          <Icon className="size-4 shrink-0" aria-hidden /> {text}
        </li>
      ))}
    </ul>
  )
}

/** Browse built-in feed ideas, or preview one that was shared as a link. */
export function TemplateDialog({ state, busy, onUse, onClose }: TemplateDialogProps) {
  const shared = state?.kind === 'shared' ? state.template : null
  return (
    <Dialog
      open={state !== null}
      onClose={onClose}
      busy={busy}
      size="lg"
      title={shared ? 'Someone shared a feed idea' : 'Feed ideas'}
      description={
        shared
          ? 'Use it to start a new project with empty spots to fill with your own photos. Your existing projects aren’t changed.'
          : 'Start a project from a proven layout. Each one creates empty spots with notes on what to post where.'
      }
    >
      {shared ? (
        <div className="grid gap-5 sm:grid-cols-[1fr_1.1fr]">
          <TemplatePreview template={shared} />
          <div className="flex flex-col">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Gift className="size-5 text-accent" aria-hidden /> {shared.name}
            </p>
            {shared.description && <p className="mt-1 text-sm text-muted">{shared.description}</p>}
            <div className="mt-4">
              <Facts template={shared} />
            </div>
            <p className="mt-4 rounded-lg bg-subtle px-3 py-2.5 text-xs leading-relaxed text-muted">
              Feed ideas contain no photos. The coloured spots hint at the tone of each post{shared.cadence ? ', and dates start from tomorrow' : ''}.
            </p>
            <div className="mt-auto flex justify-end gap-2 pt-5">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                Not now
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onUse(shared)} disabled={busy}>
                Use this idea
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" aria-label="Feed ideas">
          {BUILT_IN_TEMPLATES.map((template) => (
            <li key={template.name} className="flex gap-3 rounded-xl border border-line p-3">
              <div className="w-24 shrink-0">
                <TemplatePreview template={template} limit={9} notes={false} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-sm font-semibold">{template.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{template.description}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {pluralize(template.tiles.length, 'post')}
                  {template.cadence ? ` · ${rhythm(template)!.toLowerCase()}` : ''}
                </p>
                <button type="button" className="btn btn-secondary mt-auto h-8 self-start px-3 text-xs" onClick={() => onUse(template)} disabled={busy} aria-label={`Use ${template.name}`}>
                  Use this idea
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
