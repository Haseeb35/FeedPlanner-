import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, Clapperboard, Copy, ImageOff, ImagePlus, TriangleAlert } from 'lucide-react'
import type { Crop, FeedFilter, LoadedImage, PostDetails, PostType, TileAspect } from '../types'
import type { ColorInfo } from '../lib/colors'
import { toHex } from '../lib/colors'
import { gridPosition, postingNumber } from '../lib/grid'
import { filterCss, isNeutralFilter, warmthOverlay } from '../lib/posts'
import { aspectClass, cropStyle } from '../lib/ui'
import { slotTextColor } from '../lib/templates'

export type GridView = 'grid' | 'posting' | 'colors'

interface TileProps {
  id: string
  index: number
  total: number
  image: LoadedImage | undefined
  aspect: TileAspect
  selected: boolean
  view: GridView
  post: PostDetails
  filter: FeedFilter
  isNext: boolean
  conflict: boolean
  colors: ColorInfo | undefined
  similar: boolean
  onSelect: (id: string, additive: boolean) => void
}

interface TileImageProps {
  image: LoadedImage | undefined
  label?: string
  crop?: Crop | null
  filter?: FeedFilter
}

/** A photo filling its box, with the post's crop and the feed's filter applied. */
export function TileImage({ image, label, crop, filter }: TileImageProps) {
  if (!image) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1 bg-subtle p-2 text-center text-muted">
        <ImageOff className="size-5" aria-hidden />
        <span className="text-[11px] leading-tight">Photo unavailable</span>
      </div>
    )
  }
  if (image.slot) {
    const fg = slotTextColor(image.slot.color)
    return (
      <div className="@container flex size-full flex-col items-center justify-center gap-1 p-1.5 text-center" style={{ background: image.slot.color, color: fg }}>
        <ImagePlus className="size-4 shrink-0 opacity-70 @max-[60px]:size-3" aria-hidden />
        <span className="line-clamp-3 text-[11px] leading-tight font-medium opacity-90 @max-[60px]:hidden">{image.slot.note || 'Add a photo'}</span>
      </div>
    )
  }
  if (!image.thumbUrl) return <div className="size-full bg-subtle" />
  const overlay = filter && warmthOverlay(filter)
  return (
    <div className="relative size-full overflow-hidden">
      <img
        src={image.thumbUrl}
        alt={label ?? ''}
        draggable={false}
        loading="lazy"
        decoding="async"
        className="size-full object-cover select-none"
        style={{ ...cropStyle(crop), filter: filter && !isNeutralFilter(filter) ? filterCss(filter) : undefined }}
      />
      {overlay && <span className="pointer-events-none absolute inset-0" style={{ background: overlay.color, opacity: overlay.opacity }} aria-hidden />}
    </div>
  )
}

export function PostTypeIcon({ type, className = 'size-4.5' }: { type: PostType; className?: string }) {
  if (type === 'photo') return null
  const Icon = type === 'carousel' ? Copy : Clapperboard
  return <Icon className={`${className} text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.55)]`} aria-hidden />
}

const typeLabel: Record<PostType, string> = { photo: '', carousel: ' Carousel.', reel: ' Reel.' }

export const GridPhotoTile = memo(function GridPhotoTile({ id, index, total, image, aspect, selected, view, post, filter, isNext, conflict, colors, similar, onSelect }: TileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const { row, column } = gridPosition(index)
  const number = postingNumber(index, total)
  const posting = view === 'posting'
  const status = post.posted ? ' Posted.' : isNext ? ' Next to post.' : ''

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative ${aspectClass[aspect]} touch-manipulation ${isDragging ? 'z-10 opacity-30' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        aria-pressed={selected}
        aria-label={`${image?.slot ? `Empty spot: ${image.slot.note || 'add a photo'}` : (image?.name ?? 'Missing photo')}. Row ${row}, column ${column}. Post number ${number} of ${total}.${typeLabel[post.type]}${status}`}
        onClick={(event) => onSelect(id, event.metaKey || event.ctrlKey || event.shiftKey)}
        onKeyDown={(event) => {
          listeners?.onKeyDown?.(event)
          if (event.key === 'Enter' && !event.defaultPrevented) {
            event.preventDefault()
            onSelect(id, event.metaKey || event.ctrlKey || event.shiftKey)
          }
        }}
        className="group absolute inset-0 cursor-grab overflow-hidden bg-subtle outline-none active:cursor-grabbing focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-0"
      >
        <div className={`size-full transition-opacity ${posting && post.posted ? 'opacity-45' : ''}`}>
          <TileImage image={image} crop={post.crop} filter={filter} />
        </div>
        <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" aria-hidden />
        <span className="pointer-events-none absolute top-1.5 right-1.5">
          <PostTypeIcon type={post.type} />
        </span>
        {selected && <span className="pointer-events-none absolute inset-0 ring-3 ring-accent ring-inset" aria-hidden />}
        {posting && (
          <span
            className={`pointer-events-none absolute top-1.5 left-1.5 flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full px-1.5 text-xs font-semibold tabular-nums shadow-sm ${
              post.posted ? 'bg-success text-white' : isNext ? 'bg-accent text-accent-fg' : 'bg-white/92 text-[#1b1916]'
            }`}
            aria-hidden
          >
            {post.posted ? <Check className="size-3.5" strokeWidth={3} /> : number}
          </span>
        )}
        {posting && isNext && !post.posted && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-accent/90 py-0.5 text-center text-[10px] font-semibold tracking-wide text-accent-fg uppercase" aria-hidden>
            Next up
          </span>
        )}
        {posting && conflict && (
          <span className="pointer-events-none absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full bg-amber-400 text-[#2b1d00] shadow-sm" title="Scheduled out of order" aria-hidden>
            <TriangleAlert className="size-3.5" />
          </span>
        )}
        {view === 'colors' && (
          <>
            {similar && <span className="pointer-events-none absolute inset-0 ring-3 ring-amber-400 ring-inset" aria-hidden />}
            <span className="pointer-events-none absolute inset-x-1.5 bottom-1.5 flex h-4 overflow-hidden rounded-full shadow-sm ring-1 ring-white/70" aria-hidden>
              {(colors?.palette.length ? colors.palette : [[200, 200, 200] as [number, number, number]]).map((c, i) => (
                <span key={i} className="flex-1" style={{ background: toHex(c) }} />
              ))}
            </span>
          </>
        )}
      </div>
    </li>
  )
})
