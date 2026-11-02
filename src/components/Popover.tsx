import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

interface PopoverProps {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  className?: string
  label: string
}

/** Lightweight disclosure panel: closes on outside click or Escape and restores focus. */
export function Popover({ trigger, children, align = 'start', className = '', label }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        root.current?.querySelector<HTMLElement>('[aria-controls]')?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v), id: panelId })}
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={label}
          className={`animate-pop absolute top-full z-50 mt-2 rounded-xl border border-line bg-surface shadow-soft ${align === 'end' ? 'right-0' : 'left-0'} ${className}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
