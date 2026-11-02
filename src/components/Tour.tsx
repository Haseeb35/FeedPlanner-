import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'

export interface TourStep {
  /** Value of the `data-tour` attribute to highlight. Without one, the card is centred. */
  target?: string
  title: string
  body: string
  /** Runs before the step shows, e.g. to switch to the view that contains the target. */
  before?: () => void
}

interface TourProps {
  steps: TourStep[]
  onClose: (completed: boolean) => void
}

type Rect = { top: number; left: number; width: number; height: number }

const PAD = 6
const CARD_WIDTH = 320

/** The first visible element for a tour target (the same control can exist in desktop and mobile layouts). */
function findTarget(name: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)
  for (const el of candidates) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  // Big targets (the whole grid) only need their visible part outlined.
  const top = Math.max(r.top, 8)
  const bottom = Math.min(r.bottom, window.innerHeight - 8)
  return { top: top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: Math.max(0, bottom - top) + PAD * 2 }
}

/** A short spotlight tour: dims the page, outlines one control at a time and explains it. */
export function Tour({ steps, onClose }: TourProps) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const step = steps[index]
  const last = index === steps.length - 1
  // Steps are rebuilt on every parent render; only a change of step should re-run its setup.
  const stepsRef = useRef(steps)
  useLayoutEffect(() => {
    stepsRef.current = steps
  })
  const target = step.target

  const update = useCallback(() => {
    const el = target ? findTarget(target) : null
    setRect(el ? measure(el) : null)
  }, [target])

  useLayoutEffect(() => {
    stepsRef.current[index].before?.()
    // Wait a frame so a view switched by `before` has rendered.
    const frame = requestAnimationFrame(() => {
      const el = target ? findTarget(target) : null
      el?.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior })
      update()
      nextRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [index, target, update])

  useEffect(() => {
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [update])

  const go = (delta: number) => {
    if (last && delta > 0) onClose(true)
    else setIndex((i) => Math.max(0, Math.min(steps.length - 1, i + delta)))
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onClose(false)
    else if (event.key === 'ArrowRight') go(1)
    else if (event.key === 'ArrowLeft') go(-1)
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  // Place the card under the target, or above it when there's no room, clamped to the screen.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const width = Math.min(CARD_WIDTH, vw - 24)
  let cardStyle: React.CSSProperties
  if (rect) {
    const below = rect.top + rect.height + 12
    const roomBelow = vh - below > 220
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), vw - width - 12)
    const top = Math.min(Math.max(16, rect.top + 24), vh - 240)
    const right = rect.left + rect.width + 16
    cardStyle = roomBelow
      ? { top: below, left, width }
      : rect.top > 232
        ? { bottom: vh - rect.top + 12, left, width }
        : // Tall targets like the grid: beside them when there's room, so the card doesn't cover them.
          vw - right > width + 12
          ? { top, left: right, width }
          : rect.left > width + 28
            ? { top, left: rect.left - width - 16, width }
            : { bottom: 16, left, width }
  } else {
    // Plain coordinates: a transform would be overridden by the pop-in animation.
    cardStyle = { top: Math.max(16, vh / 2 - 120), left: (vw - width) / 2, width }
  }

  return (
    <div className="fixed inset-0 z-[60]" onKeyDown={onKeyDown}>
      {/* Clicking the dimmed page does nothing, so a stray tap doesn't end the tour. */}
      <div className="absolute inset-0" aria-hidden />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-accent transition-all duration-200"
          style={{ ...rect, boxShadow: '0 0 0 9999px rgb(17 17 16 / 0.55)' }}
          aria-hidden
        />
      ) : (
        <div className="absolute inset-0 bg-[rgb(17_17_16/0.55)]" aria-hidden />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="animate-pop absolute rounded-2xl border border-line bg-surface p-4 text-fg shadow-soft"
        style={cardStyle}
        key={index}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-accent tabular-nums">
              {index + 1} of {steps.length}
            </p>
            <h2 id="tour-title" className="mt-0.5 text-[15px] font-semibold">
              {step.title}
            </h2>
          </div>
          <button type="button" className="btn btn-ghost btn-icon -m-1 h-8 w-8" onClick={() => onClose(false)} aria-label="Skip tour" title="Skip tour">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-muted">
          {step.body}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <div className="mr-auto flex gap-1" aria-hidden>
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-accent' : 'w-1.5 bg-line-strong'}`} />
            ))}
          </div>
          {index > 0 && (
            <button type="button" className="btn btn-ghost h-8 px-2.5 text-xs" onClick={() => go(-1)}>
              <ArrowLeft className="size-3.5" aria-hidden /> Back
            </button>
          )}
          <button ref={nextRef} type="button" className="btn btn-primary h-8 px-3 text-xs" onClick={() => go(1)}>
            {last ? 'Start planning' : index === 0 ? 'Show me around' : 'Next'}
            {!last && <ArrowRight className="size-3.5" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  )
}
