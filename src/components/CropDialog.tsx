import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Move, RotateCcw, ZoomIn } from 'lucide-react'
import type { Crop, FeedFilter, LoadedImage, TileAspect } from '../types'
import { Dialog } from './Dialog'
import { TileImage } from './GridPhotoTile'
import { aspectClass } from '../lib/ui'
import { tileRatio } from '../lib/export'

interface CropDialogProps {
  open: boolean
  image: LoadedImage | undefined
  crop: Crop | null
  aspect: TileAspect
  filter: FeedFilter
  onClose: () => void
  onSave: (crop: Crop | null) => void
}

const DEFAULT: Crop = { x: 0.5, y: 0.5, zoom: 1 }
const MAX_ZOOM = 3

export function CropDialog(props: CropDialogProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} size="sm" title="Adjust crop" description="Choose which part of the photo shows in its tile. The export uses the same crop.">
      <CropEditor key={props.image?.id} {...props} />
    </Dialog>
  )
}

function CropEditor({ image, crop, aspect, filter, onClose, onSave }: CropDialogProps) {
  const [value, setValue] = useState<Crop>(crop ?? DEFAULT)
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; start: Crop } | null>(null)

  /** How far the photo overflows the frame, in screen pixels, at the current zoom. */
  const overflow = (zoom: number) => {
    const el = frame.current
    if (!el || !image) return { x: 0, y: 0 }
    const w = el.clientWidth
    const h = el.clientHeight
    const scale = Math.max(w / image.width, h / image.height) * zoom
    return { x: image.width * scale - w, y: image.height * scale - h }
  }

  const clamp = (v: number) => Math.min(1, Math.max(0, v))

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, start: value }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const o = overflow(d.start.zoom)
    // Dragging right reveals more of the left side, so the focal point moves left.
    setValue({
      ...d.start,
      x: o.x > 0 ? clamp(d.start.x - (event.clientX - d.x) / o.x) : d.start.x,
      y: o.y > 0 ? clamp(d.start.y - (event.clientY - d.y) / o.y) : d.start.y,
    })
  }
  const endDrag = () => {
    drag.current = null
  }

  const nudge = (dx: number, dy: number) => setValue((v) => ({ ...v, x: clamp(v.x + dx), y: clamp(v.y + dy) }))
  const isDefault = value.x === 0.5 && value.y === 0.5 && value.zoom === 1

  return (
    <div className="space-y-4">
      <div className="mx-auto" style={{ maxWidth: `${Math.round(280 / tileRatio(aspect))}px` }}>
        <div
          ref={frame}
          role="application"
          aria-label="Crop area. Drag the photo or use the arrow keys to move it."
          tabIndex={0}
          className={`${aspectClass[aspect]} relative cursor-move touch-none overflow-hidden rounded-xl border border-line bg-subtle select-none`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 0.1 : 0.02
            const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
            const move = moves[event.key]
            if (move) {
              event.preventDefault()
              nudge(...move)
            }
          }}
        >
          <TileImage image={image} crop={value} filter={filter} />
          {/* Rule-of-thirds guides */}
          <span className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="border-[0.5px] border-white/35" />
            ))}
          </span>
          <span className="pointer-events-none absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white" aria-hidden>
            <Move className="size-3" /> Drag to move
          </span>
        </div>
      </div>

      <div>
        <label className="label flex items-center gap-1.5" htmlFor="crop-zoom">
          <ZoomIn className="size-3.5" aria-hidden /> Zoom
          <span className="ml-auto tabular-nums">{Math.round(value.zoom * 100)}%</span>
        </label>
        <input
          id="crop-zoom"
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={value.zoom}
          onChange={(e) => setValue((v) => ({ ...v, zoom: Number(e.target.value) }))}
          className="w-full accent-[var(--app-accent)]"
        />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
        <button type="button" className="btn btn-ghost text-muted" onClick={() => setValue(DEFAULT)} disabled={isDefault}>
          <RotateCcw className="size-4" aria-hidden /> Reset
        </button>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onSave(isDefault ? null : { x: Math.round(value.x * 1000) / 1000, y: Math.round(value.y * 1000) / 1000, zoom: Math.round(value.zoom * 100) / 100 })
              onClose()
            }}
          >
            Save crop
          </button>
        </div>
      </div>
    </div>
  )
}
