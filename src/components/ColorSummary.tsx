import { Palette, TriangleAlert } from 'lucide-react'
import type { RGB } from '../lib/colors'
import { toHex } from '../lib/colors'
import { pluralize } from '../lib/format'

interface ColorSummaryProps {
  palette: RGB[]
  similarPairs: number
  analysed: number
  total: number
}

export function ColorSummary({ palette, similarPairs, analysed, total }: ColorSummaryProps) {
  const loading = analysed < total
  return (
    <div className="animate-fade-up mb-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-sm" role="note">
      <div className="flex items-center gap-2">
        <Palette className="size-4 shrink-0 text-accent" aria-hidden />
        <span className="font-medium">Feed palette</span>
        <span className="ml-auto flex h-5 overflow-hidden rounded-full ring-1 ring-line" aria-label={loading ? 'Analysing colours' : `Main colours: ${palette.map(toHex).join(', ')}`}>
          {palette.length === 0 ? (
            <span className="w-24 animate-pulse bg-subtle" />
          ) : (
            palette.map((c, i) => <span key={i} className="w-6" style={{ background: toHex(c) }} title={toHex(c)} />)
          )}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {loading ? (
          `Analysing colours… ${analysed} of ${total}`
        ) : similarPairs > 0 ? (
          <span className="flex gap-1.5">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden />
            {pluralize(similarPairs, 'pair')} of neighbouring photos look very alike (outlined). Swapping one of each pair adds contrast.
          </span>
        ) : (
          'Nice balance: no neighbouring photos look too alike. The strip on each photo shows its main colours.'
        )}
      </p>
    </div>
  )
}
