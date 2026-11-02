import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { ToastContext, type ToastOptions } from './contexts'

interface Toast extends ToastOptions {
  id: number
  title: string
}

const icons = {
  success: <CircleCheck className="size-4.5 text-success" aria-hidden />,
  error: <CircleAlert className="size-4.5 text-danger" aria-hidden />,
  info: <Info className="size-4.5 text-muted" aria-hidden />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
  }, [])

  const toast = useCallback(
    (title: string, options: ToastOptions = {}) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-3), { id, title, ...options }])
      const duration = options.duration ?? (options.action ? 6000 : options.tone === 'error' ? 6000 : 3500)
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      )
    },
    [dismiss],
  )

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((timer) => clearTimeout(timer))
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex flex-col items-center gap-2 px-4 lg:top-auto lg:bottom-6 lg:items-end lg:px-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-soft"
          >
            <span className="mt-0.5">{icons[t.tone ?? 'success']}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
            </div>
            {t.action && (
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm font-semibold text-accent hover:bg-accent-soft"
                onClick={() => {
                  t.action!.onClick()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss notification"
              className="-m-1 rounded-md p-1 text-muted hover:bg-subtle hover:text-fg"
              onClick={() => dismiss(t.id)}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
