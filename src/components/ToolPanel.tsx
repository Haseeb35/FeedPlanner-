import { Check, HardDrive, ListOrdered, MousePointerClick, RotateCcw, Scissors, TriangleAlert, X } from 'lucide-react'
import type { FeedFilter, LoadedImage, PostDetails } from '../types'
import { formatPlanned, getPost } from '../lib/posts'
import { pluralize } from '../lib/format'
import { gridPosition, postingNumber, rowCount } from '../lib/grid'
import { UploadDropzone } from './UploadDropzone'
import { TileImage } from './GridPhotoTile'

interface ToolPanelProps {
  order: string[]
  images: ReadonlyMap<string, LoadedImage>
  postingMode: boolean
  posts: Record<string, PostDetails>
  filter: FeedFilter
  nextId: string | null
  conflicts: ReadonlySet<string>
  showHint: boolean
  onDismissHint: () => void
  onFiles: (files: File[]) => void
  onSplit: () => void
  onTogglePostingMode: () => void
  onSelect: (id: string) => void
  onReset: () => void
}

export function DragHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="relative rounded-xl border border-line bg-surface p-3.5 pr-9">
      <div className="flex gap-2.5">
        <MousePointerClick className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <div className="text-xs leading-relaxed text-muted">
          <p className="font-medium text-fg">Drag photos to rearrange</p>
          <p className="mt-1">
            Click a photo to select it. On touch screens, press and hold to drag. With a keyboard, focus a photo and press{' '}
            <kbd className="rounded border border-line bg-subtle px-1 font-sans">Space</kbd>, then use the arrow keys.
          </p>
        </div>
      </div>
      <button type="button" onClick={onDismiss} className="absolute top-2 right-2 rounded-md p-1 text-muted hover:bg-subtle hover:text-fg" aria-label="Dismiss tip">
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}

export function ToolPanel({ order, images, postingMode, posts, filter, nextId, conflicts, showHint, onDismissHint, onFiles, onSplit, onTogglePostingMode, onSelect, onReset }: ToolPanelProps) {
  const total = order.length
  // Posting sequence: the bottom-right photo is posted first, the top-left last.
  const sequence = [...order].reverse()
  const posted = order.filter((id) => getPost(posts, id).posted).length

  return (
    <div className="flex min-h-full flex-col gap-6 p-5">
      <section aria-labelledby="photos-heading">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 id="photos-heading" className="eyebrow">
            Photos
          </h2>
          <span className="text-xs text-muted tabular-nums">
            {pluralize(total, 'photo')} · {pluralize(rowCount(total), 'row')}
          </span>
        </div>
        <div data-tour="add">
          <UploadDropzone onFiles={onFiles} compact />
        </div>
        <button type="button" className="btn btn-ghost mt-2 h-8 w-full text-xs text-muted hover:text-fg" onClick={onSplit}>
          <Scissors className="size-3.5" aria-hidden /> Split one photo across the grid
        </button>
      </section>

      {showHint && total > 0 && <DragHint onDismiss={onDismissHint} />}

      {total > 0 && (
        <section aria-labelledby="plan-heading" className="flex flex-col">
          <h2 id="plan-heading" className="eyebrow mb-2.5">
            Posting plan
          </h2>
          <p className="text-xs leading-relaxed text-muted">
            Instagram shows your newest post top-left. To end up with this grid, publish from the bottom-right photo to the top-left one.
          </p>
          <div className="mt-3">
            <div className="flex justify-between text-xs">
              <span className="font-medium">
                {posted} of {total} posted
              </span>
              <span className="text-muted tabular-nums">{Math.round((posted / total) * 100)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-label="Posting progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={posted}>
              <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${(posted / total) * 100}%` }} />
            </div>
          </div>
          <button type="button" onClick={onTogglePostingMode} aria-pressed={postingMode} className={`btn mt-3 w-full ${postingMode ? 'btn-primary' : 'btn-secondary'}`}>
            <ListOrdered className="size-4" aria-hidden />
            {postingMode ? 'Hide posting order' : 'Show posting order'}
          </button>

          {postingMode && (
            <ol className="mt-3 -mx-1 space-y-0.5" aria-label="Publish in this order">
              {sequence.map((id) => {
                const index = order.indexOf(id)
                const { row, column } = gridPosition(index)
                const image = images.get(id)
                const post = getPost(posts, id)
                const planned = formatPlanned(post)
                const next = id === nextId
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onSelect(id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-subtle ${next ? 'bg-accent-soft/70 hover:bg-accent-soft' : ''}`}
                    >
                      <span className={`flex w-5 justify-end text-xs font-semibold tabular-nums ${post.posted ? 'text-success' : next ? 'text-accent' : 'text-muted'}`}>
                        {post.posted ? <Check className="size-3.5" strokeWidth={3} aria-label="Posted" /> : postingNumber(index, total)}
                      </span>
                      <span className={`size-8 shrink-0 overflow-hidden rounded-md bg-subtle ${post.posted ? 'opacity-50' : ''}`}>
                        <TileImage image={image} crop={post.crop} filter={filter} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-xs font-medium ${post.posted ? 'text-muted line-through' : ''}`}>{image?.name ?? 'Photo unavailable'}</span>
                        <span className="flex items-center gap-1 text-[11px] text-muted">
                          {next ? <span className="font-semibold text-accent">Next up</span> : null}
                          {next && ' · '}
                          {planned ?? `Row ${row}, col ${column}`}
                          {conflicts.has(id) && <TriangleAlert className="size-3 shrink-0 text-amber-500" aria-label="Out of order" />}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      )}

      <div className="mt-auto space-y-3 border-t border-line pt-4">
        {total > 0 && (
          <button type="button" onClick={onReset} className="btn btn-ghost h-8 w-full justify-start px-2 text-muted hover:text-danger">
            <RotateCcw className="size-4" aria-hidden /> Reset grid
          </button>
        )}
        <p className="flex gap-2 px-2 text-xs leading-relaxed text-muted">
          <HardDrive className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Saved in this browser only. Projects don’t sync across devices.
        </p>
      </div>
    </div>
  )
}
