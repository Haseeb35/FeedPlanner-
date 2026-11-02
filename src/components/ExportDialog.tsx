import { useState, type ReactNode } from 'react'
import { CircleAlert, Download, Grid3x3, LoaderCircle, SquareUser } from 'lucide-react'
import type { Project } from '../types'
import { Dialog } from './Dialog'
import { defaultExportOptions, downloadBlob, exportFileName, renderExport, selectExportIds, type ExportOptions } from '../lib/export'
import { getImage } from '../lib/db'
import { pluralize } from '../lib/format'
import { rowCount } from '../lib/grid'
import { useToast } from '../providers/contexts'

interface ExportDialogProps {
  open: boolean
  project: Project
  theme: 'light' | 'dark'
  onClose: () => void
}

export function ExportDialog(props: ExportDialogProps) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={props.open} onClose={props.onClose} busy={busy} title="Export image" description="Download a high-quality image of your planned grid to share or keep for reference.">
      <ExportForm {...props} busy={busy} setBusy={setBusy} />
    </Dialog>
  )
}

function Segmented<T extends string | number | null>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: ReactNode; disabled?: boolean }[]
  onChange: (value: T) => void
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg bg-subtle p-1">
        {options.map((option) => (
          <label
            key={String(option.value)}
            className={`flex-1 cursor-pointer rounded-md px-2.5 py-1.5 text-center text-sm whitespace-nowrap has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring ${
              value === option.value ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:text-fg'
            } ${option.disabled ? 'pointer-events-none opacity-40' : ''}`}
          >
            <input
              type="radio"
              className="sr-only"
              name={label}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function ExportForm({ project, theme, onClose, busy, setBusy }: ExportDialogProps & { busy: boolean; setBusy: (busy: boolean) => void }) {
  const toast = useToast()
  const [options, setOptions] = useState<ExportOptions>({ ...defaultExportOptions, theme })
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => setOptions((o) => ({ ...o, [key]: value }))

  const totalRows = rowCount(project.order.length)
  const ids = selectExportIds(project.order, options.rows)
  const empty = project.order.length === 0
  const canExport = !(empty && options.mode === 'grid')

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await renderExport({ project, loadBlob: async (id) => (await getImage(id))?.blob }, options)
      const fileName = exportFileName(project.name, options.mode, options.format)
      downloadBlob(result.blob, fileName)
      toast('Image exported', {
        description: `${fileName} · ${result.width} × ${result.height} px${result.missing ? ` · ${pluralize(result.missing, 'photo')} unavailable` : ''}`,
      })
      onClose()
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Something went wrong while creating the image.'
      setError(`Export failed. ${message} If this keeps happening, try a smaller size or fewer rows.`)
      toast('Export failed', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const rowOptions: { value: number | null; label: string; disabled?: boolean }[] = [
    { value: null, label: `All (${totalRows})` },
    ...[3, 4, 6].filter((n) => n < totalRows).map((n) => ({ value: n, label: `First ${n}` })),
  ]

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="label">What to export</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['grid', 'Grid only', 'Just your photos, three columns', Grid3x3],
              ['profile', 'Profile preview', 'Grid with your profile header', SquareUser],
            ] as const
          ).map(([value, title, hint, Icon]) => (
            <label
              key={value}
              className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring ${
                options.mode === value ? 'border-accent bg-accent-soft/50' : 'border-line hover:border-line-strong'
              }`}
            >
              <input type="radio" name="export-mode" className="sr-only" checked={options.mode === value} onChange={() => set('mode', value)} />
              <Icon className={`size-5 ${options.mode === value ? 'text-accent' : 'text-muted'}`} aria-hidden />
              <span className="text-sm font-medium">{title}</span>
              <span className="text-xs text-muted">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Segmented
          label="Width"
          value={options.width}
          options={[
            { value: 1080, label: '1080 px' },
            { value: 2160, label: '2160 px' },
          ]}
          onChange={(v) => set('width', v)}
        />
        <Segmented label="Rows" value={options.rows} options={rowOptions} onChange={(v) => set('rows', v)} />
        <Segmented
          label="Background"
          value={options.theme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={(v) => set('theme', v)}
        />
        <Segmented
          label="Format"
          value={options.format}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'jpeg', label: 'JPG' },
          ]}
          onChange={(v) => set('format', v)}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--app-accent)]" checked={options.gaps} onChange={(e) => set('gaps', e.target.checked)} />
        Thin gaps between photos, like Instagram
      </label>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--app-accent)]" checked={options.typeIcons} onChange={(e) => set('typeIcons', e.target.checked)} />
        Show carousel and Reel icons
      </label>
      <p className="text-xs text-muted">Crops and your feed look are applied to the exported photos.</p>

      {error && (
        <p role="alert" className="flex gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          {empty
            ? options.mode === 'grid'
              ? 'Add photos to export a grid.'
              : 'Exports the profile header only.'
            : `${pluralize(ids.length, 'photo')} · ${pluralize(rowCount(ids.length), 'row')} · ${project.aspect === 'portrait' ? '3:4' : '1:1'} tiles`}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary min-w-32" onClick={run} disabled={busy || !canExport}>
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            {busy ? 'Exporting…' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  )
}
