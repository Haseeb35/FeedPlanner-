export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-fg" />
      <g className="fill-accent">
        <rect x="7" y="7" width="5" height="5" rx="1" />
        <rect x="13.5" y="7" width="5" height="5" rx="1" />
        <rect x="20" y="7" width="5" height="5" rx="1" />
        <rect x="7" y="13.5" width="5" height="5" rx="1" />
        <rect x="13.5" y="13.5" width="5" height="5" rx="1" className="fill-bg" />
        <rect x="20" y="13.5" width="5" height="5" rx="1" />
        <rect x="7" y="20" width="5" height="5" rx="1" />
        <rect x="13.5" y="20" width="5" height="5" rx="1" />
        <rect x="20" y="20" width="5" height="5" rx="1" />
      </g>
    </svg>
  )
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className={`text-[15px] font-semibold tracking-tight ${compact ? 'sr-only sm:not-sr-only' : ''}`}>FeedPlanner</span>
    </span>
  )
}
