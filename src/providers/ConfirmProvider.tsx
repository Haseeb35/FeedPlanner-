import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Dialog } from '../components/Dialog'
import { ConfirmContext, type ConfirmOptions } from './contexts'

/** Promise-based confirmation dialog: `if (await confirm({...})) { ... }`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false)
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={options !== null}
        onClose={() => settle(false)}
        size="sm"
        title={options?.title ?? ''}
        description={options?.description}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => settle(false)}>
              {options?.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              autoFocus
              className={`btn ${options?.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => settle(true)}
            >
              {options?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      />
    </ConfirmContext.Provider>
  )
}
