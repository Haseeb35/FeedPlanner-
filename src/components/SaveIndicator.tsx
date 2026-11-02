import { Check, CircleAlert, LoaderCircle } from 'lucide-react'
import type { SaveStatus } from '../types'

interface SaveIndicatorProps {
  status: SaveStatus
  error: string | null
  onRetry: () => void
}

export function SaveIndicator({ status, error, onRetry }: SaveIndicatorProps) {
  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        title={error ?? undefined}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-subtle"
      >
        <CircleAlert className="size-3.5" aria-hidden />
        <span className="sr-only md:not-sr-only">Not saved · Retry</span>
      </button>
    )
  }
  const content = {
    saved: { icon: <Check className="size-3.5 text-success" aria-hidden />, text: 'Saved' },
    saving: { icon: <LoaderCircle className="size-3.5 animate-spin" aria-hidden />, text: 'Saving…' },
    unsaved: { icon: <span className="size-1.5 rounded-full bg-accent" aria-hidden />, text: 'Unsaved changes' },
  }[status]
  return (
    <span className="inline-flex items-center gap-1.5 px-2 text-xs text-muted" title="Projects are saved in this browser">
      {content.icon}
      <span className="sr-only md:not-sr-only">{content.text}</span>
    </span>
  )
}
