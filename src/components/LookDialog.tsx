import { RotateCcw } from 'lucide-react'
import type { FeedFilter, LoadedImage } from '../types'
import { Dialog } from './Dialog'
import { TileImage } from './GridPhotoTile'
import { FILTER_PRESETS, isNeutralFilter, neutralFilter } from '../lib/posts'

interface LookDialogProps {
  open: boolean
  filter: FeedFilter
  sample: LoadedImage | undefined
  onChange: (filter: FeedFilter) => void
  onClose: () => void
}

const SLIDERS: { key: keyof FeedFilter; label: string; min: number; max: number; format: (v: number) => string }[] = [
  { key: 'brightness', label: 'Brightness', min: 50, max: 150, format: (v) => `${v - 100 > 0 ? '+' : ''}${v - 100}` },
  { key: 'contrast', label: 'Contrast', min: 50, max: 150, format: (v) => `${v - 100 > 0 ? '+' : ''}${v - 100}` },
  { key: 'saturation', label: 'Saturation', min: 0, max: 200, format: (v) => `${v - 100 > 0 ? '+' : ''}${v - 100}` },
  { key: 'warmth', label: 'Warmth', min: -100, max: 100, format: (v) => `${v > 0 ? '+' : ''}${v}` },
]

const same = (a: FeedFilter, b: FeedFilter) => a.brightness === b.brightness && a.contrast === b.contrast && a.saturation === b.saturation && a.warmth === b.warmth

/** One look for the whole feed, previewed live on the grid and applied to exports. */
export function LookDialog({ open, filter, sample, onChange, onClose }: LookDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Feed look" description="Apply the same adjustments to every photo for a consistent feed. Your original photos are never changed.">
      <div className="space-y-5">
        <fieldset>
          <legend className="label">Presets</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {FILTER_PRESETS.map((preset) => {
              const active = same(preset.filter, filter)
              return (
                <button
                  key={preset.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...preset.filter })}
                  className={`rounded-lg border p-1 text-xs transition-colors ${active ? 'border-accent bg-accent-soft/60 font-medium' : 'border-line hover:border-line-strong'}`}
                >
                  <span className="block aspect-square overflow-hidden rounded-md bg-subtle">
                    <TileImage image={sample} filter={preset.filter} />
                  </span>
                  <span className="mt-1 block">{preset.name}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="space-y-3">
          {SLIDERS.map((s) => (
            <div key={s.key}>
              <label htmlFor={`look-${s.key}`} className="label flex justify-between">
                {s.label} <span className="tabular-nums">{s.format(filter[s.key])}</span>
              </label>
              <input
                id={`look-${s.key}`}
                type="range"
                min={s.min}
                max={s.max}
                step={1}
                value={filter[s.key]}
                onChange={(e) => onChange({ ...filter, [s.key]: Number(e.target.value) })}
                className="w-full accent-[var(--app-accent)]"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <button type="button" className="btn btn-ghost text-muted" onClick={() => onChange({ ...neutralFilter })} disabled={isNeutralFilter(filter)}>
            <RotateCcw className="size-4" aria-hidden /> Reset
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Dialog>
  )
}
