import { useEffect, useMemo, useState } from 'react'
import { CircleAlert, LoaderCircle, Scissors } from 'lucide-react'
import type { TileAspect } from '../types'
import { Dialog } from './Dialog'
import { UploadDropzone } from './UploadDropzone'
import { SPLIT_ROWS, splitRects } from '../lib/split'
import { loadDrawable, validateFile } from '../lib/images'
import type { InsertPosition } from '../lib/grid'
import { COLUMNS } from '../lib/grid'
import { tileRatio } from '../lib/export'
import { useObjectUrls } from '../hooks/useObjectUrls'

interface SplitDialogProps {
  open: boolean
  aspect: TileAspect
  photoCount: number
  onClose: () => void
  onSplit: (file: File, rows: number, position: InsertPosition) => Promise<boolean>
}

export function SplitDialog(props: SplitDialogProps) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={props.open} onClose={props.onClose} busy={busy} title="Split a photo across the grid" description="Cut one image into a block of tiles so it shows as one big picture on your profile.">
      <SplitForm {...props} busy={busy} setBusy={setBusy} />
    </Dialog>
  )
}

function SplitForm({ aspect, photoCount, onClose, onSplit, busy, setBusy }: SplitDialogProps & { busy: boolean; setBusy: (busy: boolean) => void }) {
  const [file, setFile] = useState<{ file: File } | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState(3)
  const [position, setPosition] = useState<InsertPosition>('start')

  const blobs = useMemo(() => new Map(file ? [['src', file.file as Blob]] : []), [file])
  const url = useObjectUrls(blobs).get('src')

  useEffect(() => {
    if (!file) return
    let cancelled = false
    loadDrawable(file.file)
      .then((img) => {
        img.release()
        if (!cancelled) setSize({ width: img.width, height: img.height })
      })
      .catch(() => {
        if (!cancelled) {
          setError('This file couldn’t be read as an image. It may be damaged.')
          setFile(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [file])

  const choose = (files: File[]) => {
    const picked = files[0]
    if (!picked) return
    const validation = validateFile(picked)
    setSize(null)
    if (!validation.ok) {
      setError(validation.reason)
      setFile(null)
      return
    }
    setError(null)
    setFile({ file: picked })
  }

  // Preview: the part of the photo that will be used, with the cut lines drawn over it.
  const region = size ? splitRects(size.width, size.height, rows, aspect) : null
  const area = region && {
    sx: region[0].sx,
    sy: region[0].sy,
    sw: region[0].sw * COLUMNS,
    sh: region[0].sh * rows,
  }
  const endMisaligned = position === 'end' && photoCount % COLUMNS !== 0

  const submit = async () => {
    if (!file) return
    setBusy(true)
    const ok = await onSplit(file.file, rows, position)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <div className="space-y-4">
      {!file ? (
        <UploadDropzone onFiles={choose} title="Choose a photo to split" multiple={false} />
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="mx-auto w-full max-w-[240px] shrink-0">
            {url && size && area ? (
              <div className="relative w-full overflow-hidden rounded-lg border border-line bg-subtle" style={{ aspectRatio: `${COLUMNS} / ${rows * tileRatio(aspect)}` }}>
                <img
                  src={url}
                  alt="Photo to split"
                  className="absolute max-w-none"
                  style={{
                    width: `${(size.width / area.sw) * 100}%`,
                    height: `${(size.height / area.sh) * 100}%`,
                    left: `${(-area.sx / area.sw) * 100}%`,
                    top: `${(-area.sy / area.sh) * 100}%`,
                  }}
                />
                <div className="absolute inset-0 grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }} aria-hidden>
                  {Array.from({ length: COLUMNS * rows }, (_, i) => (
                    <span key={i} className="flex items-start justify-start p-1 outline outline-1 outline-white/80">
                      <span className="rounded bg-black/55 px-1 text-[10px] font-semibold text-white tabular-nums">{i + 1}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg bg-subtle">
                <LoaderCircle className="size-5 animate-spin text-muted" aria-hidden />
              </div>
            )}
            <button type="button" className="mt-2 w-full text-center text-xs font-medium text-muted hover:text-fg" onClick={() => setFile(null)} disabled={busy}>
              Choose a different photo
            </button>
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <fieldset disabled={busy}>
              <legend className="label">Size</legend>
              <div className="flex gap-1 rounded-lg bg-subtle p-1">
                {SPLIT_ROWS.map((n) => (
                  <label
                    key={n}
                    className={`flex-1 cursor-pointer rounded-md px-2 py-1.5 text-center text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring ${rows === n ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:text-fg'}`}
                  >
                    <input type="radio" className="sr-only" name="split-rows" checked={rows === n} onChange={() => setRows(n)} />3 × {n}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {COLUMNS * rows} tiles · {rows === 1 ? 'a panorama row' : `${rows} rows`}
              </p>
            </fieldset>
            {photoCount > 0 && (
              <fieldset disabled={busy}>
                <legend className="label">Place it</legend>
                <div className="flex gap-1 rounded-lg bg-subtle p-1 text-sm">
                  {(
                    [
                      ['start', 'Top of grid'],
                      ['end', 'Bottom of grid'],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className={`flex-1 cursor-pointer rounded-md px-2 py-1.5 text-center ${position === value ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:text-fg'}`}>
                      <input type="radio" className="sr-only" name="split-position" checked={position === value} onChange={() => setPosition(value)} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <p className="text-xs leading-relaxed text-muted">
              Post all {COLUMNS * rows} tiles together, in order. Any later post that isn’t a multiple of three will shift the picture out of line.
            </p>
            {endMisaligned && (
              <p className="flex gap-1.5 rounded-lg bg-amber-400/15 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Your grid has {photoCount} photos, which isn’t a multiple of three, so tiles added at the bottom won’t line up.
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="flex gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary min-w-36" onClick={() => void submit()} disabled={!file || !size || busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Scissors className="size-4" aria-hidden />}
          {busy ? 'Splitting…' : `Add ${COLUMNS * rows} tiles`}
        </button>
      </div>
    </div>
  )
}
