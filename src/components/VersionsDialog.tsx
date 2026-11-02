import { useState } from 'react'
import { ArchiveRestore, Bookmark, Trash2 } from 'lucide-react'
import type { FeedFilter, LoadedImage, PostDetails, Snapshot } from '../types'
import { Dialog } from './Dialog'
import { TileImage } from './GridPhotoTile'
import { formatRelative, pluralize } from '../lib/format'
import { getPost } from '../lib/posts'

interface VersionsDialogProps {
  open: boolean
  order: string[]
  snapshots: Snapshot[]
  images: ReadonlyMap<string, LoadedImage>
  posts: Record<string, PostDetails>
  filter: FeedFilter
  onClose: () => void
  onSave: (name: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}

const PREVIEW_TILES = 9

function MiniGrid({ order, images, posts, filter, label }: { order: string[]; images: ReadonlyMap<string, LoadedImage>; posts: Record<string, PostDetails>; filter: FeedFilter; label: string }) {
  return (
    <div className="grid w-full grid-cols-3 gap-px overflow-hidden rounded-md bg-line" role="img" aria-label={label}>
      {Array.from({ length: PREVIEW_TILES }, (_, i) => {
        const id = order[i]
        return (
          <div key={i} className="aspect-[3/4] bg-subtle">
            {id && <TileImage image={images.get(id)} crop={getPost(posts, id).crop} filter={filter} />}
          </div>
        )
      })}
    </div>
  )
}

function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

export function VersionsDialog({ open, order, snapshots, images, posts, filter, onClose, onSave, onRestore, onDelete }: VersionsDialogProps) {
  const [name, setName] = useState('')
  const suggested = `Option ${String.fromCharCode(65 + (snapshots.length % 26))}`

  return (
    <Dialog open={open} onClose={onClose} size="lg" title="Saved versions" description="Save the current arrangement before trying something new, then compare and switch back any time.">
      <div className="space-y-5">
        <form
          className="flex gap-3 rounded-xl border border-line bg-bg/50 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            onSave(name.trim() || suggested)
            setName('')
          }}
        >
          <div className="w-20 shrink-0">
            <MiniGrid order={order} images={images} posts={posts} filter={filter} label="Current arrangement" />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="version-name" className="label">
              Current arrangement · {pluralize(order.length, 'photo')}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="version-name" className="field" placeholder={suggested} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
              <button type="submit" className="btn btn-primary" disabled={order.length === 0}>
                <Bookmark className="size-4" aria-hidden /> Save version
              </button>
            </div>
          </div>
        </form>

        {snapshots.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No saved versions yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Saved versions">
            {snapshots.map((snapshot) => {
              const current = sameOrder(snapshot.order, order)
              return (
                <li key={snapshot.id} className={`rounded-xl border p-2.5 ${current ? 'border-accent' : 'border-line'}`}>
                  <MiniGrid order={snapshot.order} images={images} posts={posts} filter={filter} label={`Preview of ${snapshot.name}`} />
                  <p className="mt-2 truncate text-sm font-medium" title={snapshot.name}>
                    {snapshot.name}
                  </p>
                  <p className="text-[11px] text-muted">
                    {pluralize(snapshot.order.length, 'photo')} · {formatRelative(snapshot.createdAt)}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <button type="button" className="btn btn-secondary h-8 flex-1 px-2 text-xs" onClick={() => onRestore(snapshot.id)} disabled={current}>
                      <ArchiveRestore className="size-3.5" aria-hidden /> {current ? 'Current' : 'Restore'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon h-8 w-8 text-muted hover:text-danger" onClick={() => onDelete(snapshot.id)} aria-label={`Delete ${snapshot.name}`}>
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-muted">Versions keep the order of your photos. Captions, dates and crops are shared across versions.</p>
      </div>
    </Dialog>
  )
}
