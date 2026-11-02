import { Clapperboard, Copy } from 'lucide-react'
import type { FeedTemplate } from '../lib/templates'
import { slotTextColor } from '../lib/templates'
import { aspectClass } from '../lib/ui'

interface TemplatePreviewProps {
  template: FeedTemplate
  /** Show at most this many tiles (from the top-left). */
  limit?: number
  /** Show each tile's note. Off for small thumbnails. */
  notes?: boolean
}

/** A feed idea drawn as coloured tiles with their notes and post-type icons. */
export function TemplatePreview({ template, limit, notes = true }: TemplatePreviewProps) {
  const tiles = limit ? template.tiles.slice(0, limit) : template.tiles
  return (
    <ul className="grid grid-cols-3 gap-[2px] overflow-hidden rounded-lg" aria-label={`Layout of ${template.name}`}>
      {tiles.map((tile, i) => {
        const fg = slotTextColor(tile.color)
        const Icon = tile.type === 'carousel' ? Copy : tile.type === 'reel' ? Clapperboard : null
        return (
          <li key={i} className={`${aspectClass[template.aspect]} relative flex items-center justify-center p-1 text-center`} style={{ background: tile.color, color: fg }}>
            {notes && <span className="line-clamp-3 text-[10px] leading-tight font-medium opacity-90">{tile.note}</span>}
            {Icon && <Icon className="absolute top-1 right-1 size-3 opacity-80" aria-label={tile.type === 'reel' ? 'Reel' : 'Carousel'} />}
          </li>
        )
      })}
    </ul>
  )
}
