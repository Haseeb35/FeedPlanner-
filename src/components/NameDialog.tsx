import { useId, useState } from 'react'
import { Dialog } from './Dialog'

interface NameDialogProps {
  open: boolean
  title: string
  description?: string
  initialValue: string
  submitLabel: string
  onSubmit: (name: string) => void
  onClose: () => void
}

export function NameDialog(props: NameDialogProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title={props.title} description={props.description} size="sm">
      {/* Mounted only while open so the field resets each time. */}
      <NameForm {...props} />
    </Dialog>
  )
}

function NameForm({ initialValue, submitLabel, onSubmit, onClose }: NameDialogProps) {
  const [value, setValue] = useState(initialValue)
  const id = useId()
  const trimmed = value.trim()
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (trimmed) onSubmit(trimmed.slice(0, 80))
      }}
    >
      <label htmlFor={id} className="label">
        Project name
      </label>
      <input
        id={id}
        className="field"
        value={value}
        maxLength={80}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!trimmed}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
