import { useMemo, useState } from 'react'
import { CircleAlert, LoaderCircle, X } from 'lucide-react'
import { Dialog } from './Dialog'
import { UploadDropzone } from './UploadDropzone'
import { MAX_BATCH, stageFiles, type StagedFile } from '../lib/ui'
import { formatBytes, pluralize } from '../lib/format'
import type { InsertPosition } from '../lib/grid'
import { useObjectUrls } from '../hooks/useObjectUrls'

export type AddPosition = InsertPosition | 'fill'

export interface AddResult {
  added: number
  failed: { key: string; name: string; reason: string }[]
}

interface UploadDialogProps {
  open: boolean
  initialFiles: File[]
  hasPhotos: boolean
  /** Empty template spots that new photos can fill. */
  emptySpots: number
  onClose: () => void
  onAdd: (files: { key: string; file: File; type: string }[], position: AddPosition, onProgress: (done: number) => void, posted: boolean) => Promise<AddResult>
}

export function UploadDialog(props: UploadDialogProps) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      size="lg"
      title="Add photos"
      description="Review your photos before adding them to the grid. Nothing is uploaded to a server — photos stay in this browser."
    >
      <UploadStaging {...props} />
    </Dialog>
  )
}

function UploadStaging({ initialFiles, hasPhotos, emptySpots, onClose, onAdd }: UploadDialogProps) {
  const [staged, setStaged] = useState<StagedFile[]>(() => stageFiles(initialFiles.slice(0, MAX_BATCH)))
  const [notice, setNotice] = useState<string | null>(initialFiles.length > MAX_BATCH ? `Only the first ${MAX_BATCH} files were added. Add the rest in another batch.` : null)
  const [position, setPosition] = useState<AddPosition>(emptySpots > 0 ? 'fill' : 'start')
  const [progress, setProgress] = useState<number | null>(null)
  const [failures, setFailures] = useState<AddResult['failed']>([])
  const [posted, setPosted] = useState(false)

  const valid = staged.filter((s) => s.type)
  const invalid = staged.filter((s) => s.error)

  const previewBlobs = useMemo(() => new Map(staged.filter((s) => s.type).map((s) => [s.key, s.file as Blob])), [staged])
  const previews = useObjectUrls(previewBlobs)

  const addFiles = (files: File[]) => {
    setFailures([])
    const room = Math.max(0, MAX_BATCH - staged.length)
    setNotice(files.length > room ? `You can review up to ${MAX_BATCH} photos at a time. Add the rest in another batch.` : null)
    setStaged([...staged, ...stageFiles(files.slice(0, room))])
  }

  const busy = progress !== null

  const submit = async () => {
    setProgress(0)
    const result = await onAdd(
      valid.map((s) => ({ key: s.key, file: s.file, type: s.type! })),
      position,
      (done) => setProgress(done),
      posted,
    )
    setProgress(null)
    if (result.failed.length === 0) {
      onClose()
      return
    }
    setFailures(result.failed)
    // Keep only what still needs attention: invalid files and the ones that failed to process.
    const reasons = new Map(result.failed.map((f) => [f.key, f.reason]))
    setStaged((current) =>
      current
        .filter((s) => s.error || reasons.has(s.key))
        .map((s) => (reasons.has(s.key) ? { ...s, type: null, error: reasons.get(s.key)! } : s)),
    )
  }

  return (
    <div className="space-y-4">
      <UploadDropzone onFiles={addFiles} compact={staged.length > 0} title={staged.length ? 'Add more photos' : 'Choose photos'} />

      {notice && <p className="rounded-lg bg-subtle px-3 py-2 text-sm text-muted">{notice}</p>}

      {staged.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-medium">
              {pluralize(valid.length, 'photo')} ready
              {invalid.length > 0 && <span className="font-normal text-danger"> · {invalid.length} can’t be added</span>}
            </p>
            <button type="button" className="text-xs font-medium text-muted hover:text-fg" onClick={() => setStaged([])} disabled={busy}>
              Clear all
            </button>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Photos to add">
            {staged.map((item) => (
              <li key={item.key} className="group relative">
                <div className={`aspect-square overflow-hidden rounded-lg border ${item.error ? 'border-danger/40 bg-subtle' : 'border-line bg-subtle'}`}>
                  {item.error ? (
                    <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
                      <CircleAlert className="size-4 text-danger" aria-hidden />
                      <span className="line-clamp-3 text-[11px] leading-tight text-danger">{item.error}</span>
                    </div>
                  ) : previews.get(item.key) ? (
                    <img src={previews.get(item.key)} alt="" className="size-full object-cover" decoding="async" />
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[11px] text-muted" title={item.file.name}>
                  {item.file.name} · {formatBytes(item.file.size)}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStaged((current) => current.filter((s) => s.key !== item.key))}
                  aria-label={`Remove ${item.file.name}`}
                  className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-90 hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {staged.length > 0 && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-subtle/70 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--app-accent)]"
            checked={posted}
            disabled={busy}
            onChange={(e) => {
              setPosted(e.target.checked)
              // Posts that are already live sit below the planned ones.
              setPosition(e.target.checked ? 'end' : emptySpots > 0 ? 'fill' : 'start')
            }}
          />
          <span>
            These are already on my profile
            <span className="block text-xs text-muted">They’re marked as posted, so the preview matches your real feed below the new plan.</span>
          </span>
        </label>
      )}

      {failures.length > 0 && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {pluralize(failures.length, 'photo')} couldn’t be processed and {failures.length === 1 ? 'was' : 'were'} not added.
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        {hasPhotos ? (
          <fieldset className="flex items-center gap-1 rounded-lg bg-subtle p-1 text-sm" disabled={busy}>
            <legend className="sr-only">Where to place new photos</legend>
            {(
              [
                ...(emptySpots > 0 ? ([['fill', `Fill empty spots (${emptySpots})`]] as const) : []),
                ['start', emptySpots > 0 ? 'Top' : 'Top of grid (newest)'],
                ['end', emptySpots > 0 ? 'Bottom' : 'Bottom of grid'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className={`cursor-pointer rounded-md px-2.5 py-1.5 ${position === value ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:text-fg'}`}>
                <input type="radio" name="position" value={value} checked={position === value} onChange={() => setPosition(value)} className="sr-only" />
                {label}
              </label>
            ))}
          </fieldset>
        ) : (
          <span className="text-xs text-muted">The first photo you add appears top-left, like your newest post.</span>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary min-w-32" onClick={submit} disabled={busy || valid.length === 0}>
            {busy ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                Adding {Math.min(progress! + 1, valid.length)} of {valid.length}
              </>
            ) : (
              `Add ${valid.length ? pluralize(valid.length, 'photo') : 'photos'}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
