import { useRef } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronsUp, Crop as CropIcon, ImagePlus, PenLine, Replace, Send, Trash2, Undo2, X } from 'lucide-react'
import type { FeedFilter, LoadedImage, PostDetails, PostType, Slot, TileAspect } from '../types'
import { gridPosition, postingNumber } from '../lib/grid'
import { formatBytes, pluralize } from '../lib/format'
import { ACCEPT_ATTRIBUTE } from '../lib/images'
import { POST_TYPES, formatPlanned } from '../lib/posts'
import { TileImage } from './GridPhotoTile'
import { PostDetailsForm } from './PostDetailsForm'
import { aspectClass } from '../lib/ui'

export interface PhotoActions {
  onMove: (delta: number) => void
  onMoveToTop: () => void
  onReplace: (file: File) => void
  onRemove: () => void
  onDeselect: () => void
  onEditCrop: () => void
  onPostChange: (patch: Partial<PostDetails>) => void
  onSlotChange: (patch: Partial<Slot>) => void
  onPostNow: () => void
}

interface PhotoInspectorProps extends PhotoActions {
  image: LoadedImage | undefined
  index: number
  total: number
  aspect: TileAspect
  post: PostDetails
  filter: FeedFilter
  conflict: boolean
}

export function ReplaceInput({ inputRef, onFile }: { inputRef: React.RefObject<HTMLInputElement | null>; onFile: (file: File) => void }) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT_ATTRIBUTE}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) onFile(file)
      }}
    />
  )
}

function postingHint(post: number, total: number) {
  return post === total ? 'This is your newest post — publish it last.' : post === 1 ? 'Publish this photo first.' : `Publish after post ${post - 1}.`
}

/** Preview, crop button and file info shared by the side inspector and the mobile details dialog. */
function PhotoSummary({ image, aspect, post, filter, onEditCrop }: Pick<PhotoInspectorProps, 'image' | 'aspect' | 'post' | 'filter' | 'onEditCrop'>) {
  return (
    <>
      <div className={`${aspectClass[aspect]} group relative overflow-hidden rounded-xl border border-line bg-subtle`}>
        <TileImage image={image} label={image?.name} crop={post.crop} filter={filter} />
        {image && !image.slot && (
          <button type="button" onClick={onEditCrop} className="btn absolute right-2 bottom-2 h-8 bg-black/60 px-2.5 text-xs text-white backdrop-blur hover:bg-black/75">
            <CropIcon className="size-3.5" aria-hidden /> {post.crop ? 'Edit crop' : 'Adjust crop'}
          </button>
        )}
      </div>
      <p className="mt-3 truncate text-sm font-medium" title={image?.name}>
        {image?.slot ? 'Empty spot' : (image?.name ?? 'Photo unavailable')}
      </p>
      {image && !image.slot && (
        <p className="mt-0.5 text-xs text-muted">
          {image.width} × {image.height} px · {formatBytes(image.size)}
        </p>
      )}
    </>
  )
}

/** Shortcut to the Post now steps for a photo that isn't posted yet. */
function PostNowButton({ image, post, onPostNow }: { image: LoadedImage | undefined; post: PostDetails; onPostNow: () => void }) {
  if (!image || image.slot || post.posted) return null
  return (
    <button type="button" className="btn btn-primary mt-4 w-full" onClick={onPostNow}>
      <Send className="size-4" aria-hidden /> Post now
    </button>
  )
}

/** For empty spots: what belongs here, and a button to add the photo. */
function SlotEditor({ slot, onAdd, onChange }: { slot: Slot; onAdd: () => void; onChange: (patch: Partial<Slot>) => void }) {
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-dashed border-line-strong p-3">
      <button type="button" className="btn btn-primary w-full" onClick={onAdd}>
        <ImagePlus className="size-4" aria-hidden /> Add photo here
      </button>
      <div>
        <label htmlFor="slot-note" className="label">
          What goes here
        </label>
        <div className="flex gap-2">
          <input id="slot-note" className="field" maxLength={60} value={slot.note} placeholder="e.g. Close-up detail" onChange={(e) => onChange({ note: e.target.value })} />
          <input type="color" aria-label="Colour hint" value={slot.color} onChange={(e) => onChange({ color: e.target.value })} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1" />
        </div>
      </div>
    </div>
  )
}

export function PhotoInspector({ image, index, total, aspect, post, filter, conflict, onMove, onMoveToTop, onReplace, onRemove, onDeselect, onEditCrop, onPostChange, onSlotChange, onPostNow }: PhotoInspectorProps) {
  const replaceInput = useRef<HTMLInputElement>(null)
  const { row, column } = gridPosition(index)
  const number = postingNumber(index, total)

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{image?.slot ? 'Empty spot' : 'Selected photo'}</h2>
        <button type="button" className="btn btn-ghost btn-icon h-8 w-8" onClick={onDeselect} aria-label="Deselect photo (Esc)" title="Deselect (Esc)">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <PhotoSummary image={image} aspect={aspect} post={post} filter={filter} onEditCrop={onEditCrop} />
      {image?.slot && <SlotEditor slot={image.slot} onAdd={() => replaceInput.current?.click()} onChange={onSlotChange} />}
      <PostNowButton image={image} post={post} onPostNow={onPostNow} />

      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
        <div className="bg-surface p-3">
          <dt className="text-xs text-muted">Grid position</dt>
          <dd className="mt-0.5 font-medium">
            Row {row}, col {column}
          </dd>
        </div>
        <div className="bg-surface p-3">
          <dt className="text-xs text-muted">Posting order</dt>
          <dd className="mt-0.5 font-medium">
            Post {number} of {total}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs leading-relaxed text-muted">{postingHint(number, total)}</p>

      <div className="mt-5 border-t border-line pt-5">
        <h3 className="eyebrow mb-3">Post details</h3>
        <PostDetailsForm post={post} conflict={conflict} onChange={onPostChange} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-line pt-5">
        <button type="button" className="btn btn-secondary" onClick={() => onMove(-1)} disabled={index === 0}>
          <ArrowLeft className="size-4" aria-hidden /> Earlier
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => onMove(1)} disabled={index === total - 1}>
          Later <ArrowRight className="size-4" aria-hidden />
        </button>
        <button type="button" className="btn btn-secondary col-span-2" onClick={onMoveToTop} disabled={index === 0}>
          <ChevronsUp className="size-4" aria-hidden /> Move to top-left
        </button>
        {!image?.slot && (
          <button type="button" className="btn btn-secondary col-span-2" onClick={() => replaceInput.current?.click()}>
            <Replace className="size-4" aria-hidden /> Replace photo
          </button>
        )}
        <button type="button" className="btn btn-ghost col-span-2 text-danger hover:bg-danger/10" onClick={onRemove}>
          <Trash2 className="size-4" aria-hidden /> {image?.slot ? 'Remove this spot' : 'Remove from grid'}
        </button>
      </div>
      <ReplaceInput inputRef={replaceInput} onFile={onReplace} />
    </div>
  )
}

/** Body of the mobile "Post details" dialog. */
export function PhotoDetailsSheet({ image, index, total, aspect, post, filter, conflict, onReplace, onMoveToTop, onEditCrop, onPostChange, onSlotChange, onPostNow }: PhotoInspectorProps) {
  const replaceInput = useRef<HTMLInputElement>(null)
  const number = postingNumber(index, total)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[7rem_1fr] gap-4">
        <div>
          <PhotoSummary image={image} aspect={aspect} post={post} filter={filter} onEditCrop={onEditCrop} />
        </div>
        <div className="min-w-0 space-y-2 text-sm">
          <p className="font-medium">
            Post {number} of {total}
          </p>
          <p className="text-xs leading-relaxed text-muted">{postingHint(number, total)}</p>
          {formatPlanned(post) && <p className="text-xs text-muted">Planned: {formatPlanned(post)}</p>}
          <div className="flex flex-col gap-2 pt-1">
            {!image?.slot && (
              <button type="button" className="btn btn-secondary h-8 text-xs" onClick={onEditCrop} disabled={!image}>
                <CropIcon className="size-3.5" aria-hidden /> Adjust crop
              </button>
            )}
            <button type="button" className="btn btn-secondary h-8 text-xs" onClick={onMoveToTop} disabled={index === 0}>
              <ChevronsUp className="size-3.5" aria-hidden /> Move to top-left
            </button>
            {!image?.slot && (
              <button type="button" className="btn btn-secondary h-8 text-xs" onClick={() => replaceInput.current?.click()}>
                <Replace className="size-3.5" aria-hidden /> Replace photo
              </button>
            )}
          </div>
        </div>
      </div>
      {image?.slot && <SlotEditor slot={image.slot} onAdd={() => replaceInput.current?.click()} onChange={onSlotChange} />}
      {image && !image.slot && !post.posted && (
        <button type="button" className="btn btn-primary w-full" onClick={onPostNow}>
          <Send className="size-4" aria-hidden /> Post now
        </button>
      )}
      <PostDetailsForm post={post} conflict={conflict} onChange={onPostChange} />
      <ReplaceInput inputRef={replaceInput} onFile={onReplace} />
    </div>
  )
}

interface SelectionBarProps {
  image: LoadedImage | undefined
  index: number
  total: number
  post: PostDetails
  onMove: (delta: number) => void
  onRemove: () => void
  onDeselect: () => void
  onOpenDetails: () => void
}

/** Compact actions for the selected photo on screens without the side inspector. */
export function SelectionBar({ image, index, total, post, onMove, onRemove, onDeselect, onOpenDetails }: SelectionBarProps) {
  const number = postingNumber(index, total)
  return (
    <div
      role="toolbar"
      aria-label="Selected photo actions"
      className="animate-fade-up fixed inset-x-3 bottom-[4.5rem] z-40 mx-auto flex max-w-md items-center gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-soft lg:bottom-5 xl:hidden"
    >
      <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-subtle">
        <TileImage image={image} crop={post.crop} />
      </div>
      <div className="mr-auto min-w-0 px-1.5">
        <p className="truncate text-xs font-medium">{image?.slot ? `Empty spot · ${image.slot.note || 'add a photo'}` : (image?.name ?? 'Photo unavailable')}</p>
        <p className="flex items-center gap-1 text-[11px] text-muted">
          Post {number} of {total}
          {post.posted && <Check className="size-3 text-success" aria-label="Posted" />}
        </p>
      </div>
      <button type="button" className="btn btn-ghost btn-icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move earlier" title="Move earlier">
        <ArrowLeft className="size-4" aria-hidden />
      </button>
      <button type="button" className="btn btn-ghost btn-icon" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move later" title="Move later">
        <ArrowRight className="size-4" aria-hidden />
      </button>
      <button type="button" className="btn btn-ghost btn-icon" onClick={onOpenDetails} aria-label="Post details" title="Caption, date & crop">
        <PenLine className="size-4" aria-hidden />
      </button>
      <button type="button" className="btn btn-ghost btn-icon text-danger" onClick={onRemove} aria-label="Remove from grid" title="Remove from grid">
        <Trash2 className="size-4" aria-hidden />
      </button>
      <button type="button" className="btn btn-ghost btn-icon" onClick={onDeselect} aria-label="Deselect photo" title="Deselect">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}

export interface BulkActions {
  count: number
  allPosted: boolean
  onMarkPosted: (posted: boolean) => void
  onSetType: (type: PostType) => void
  onMoveToTop: () => void
  onRemove: () => void
  onClear: () => void
}

/** Actions for several selected photos, shown in the side inspector. */
export function BulkPanel({ count, allPosted, onMarkPosted, onSetType, onMoveToTop, onRemove, onClear }: BulkActions) {
  return (
    <div className="animate-fade-up space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{pluralize(count, 'photo')} selected</h2>
        <button type="button" className="btn btn-ghost btn-icon h-8 w-8" onClick={onClear} aria-label="Clear selection (Esc)" title="Clear selection (Esc)">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <p className="text-xs leading-relaxed text-muted">Ctrl- or ⌘-click photos to add or remove them from the selection.</p>
      <button type="button" className="btn btn-secondary w-full" onClick={() => onMarkPosted(!allPosted)}>
        {allPosted ? <Undo2 className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
        {allPosted ? 'Mark as not posted' : 'Mark all as posted'}
      </button>
      <fieldset>
        <legend className="label">Set post type</legend>
        <div className="grid grid-cols-3 gap-1">
          {POST_TYPES.map((t) => (
            <button key={t.value} type="button" className="btn btn-secondary h-8 px-2 text-xs" onClick={() => onSetType(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>
      <button type="button" className="btn btn-secondary w-full" onClick={onMoveToTop}>
        <ChevronsUp className="size-4" aria-hidden /> Move to top-left
      </button>
      <button type="button" className="btn btn-ghost w-full text-danger hover:bg-danger/10" onClick={onRemove}>
        <Trash2 className="size-4" aria-hidden /> Remove {pluralize(count, 'photo')}
      </button>
    </div>
  )
}

/** Bulk actions for small screens. */
export function BulkBar({ count, allPosted, onMarkPosted, onMoveToTop, onRemove, onClear }: BulkActions) {
  return (
    <div
      role="toolbar"
      aria-label="Selected photos actions"
      className="animate-fade-up fixed inset-x-3 bottom-[4.5rem] z-40 mx-auto flex max-w-md items-center gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-soft lg:bottom-5 xl:hidden"
    >
      <p className="mr-auto px-2 text-sm font-medium tabular-nums">{count} selected</p>
      <button type="button" className="btn btn-ghost btn-icon" onClick={() => onMarkPosted(!allPosted)} aria-label={allPosted ? 'Mark as not posted' : 'Mark as posted'} title={allPosted ? 'Mark as not posted' : 'Mark as posted'}>
        {allPosted ? <Undo2 className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
      </button>
      <button type="button" className="btn btn-ghost btn-icon" onClick={onMoveToTop} aria-label="Move to top-left" title="Move to top-left">
        <ChevronsUp className="size-4" aria-hidden />
      </button>
      <button type="button" className="btn btn-ghost btn-icon text-danger" onClick={onRemove} aria-label={`Remove ${count} photos`} title="Remove">
        <Trash2 className="size-4" aria-hidden />
      </button>
      <button type="button" className="btn btn-ghost btn-icon" onClick={onClear} aria-label="Clear selection" title="Clear selection">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
