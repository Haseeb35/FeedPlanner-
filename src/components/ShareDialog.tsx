import { useEffect, useMemo, useState } from 'react'
import { Check, Copy as CopyIcon, FileArchive, ImageIcon, Link2, LoaderCircle, Send, TriangleAlert } from 'lucide-react'
import type { Project } from '../types'
import { Dialog } from './Dialog'
import { TemplatePreview } from './TemplatePreview'
import { useColorAnalysis } from '../hooks/useColorAnalysis'
import { useToast } from '../providers/contexts'
import { defaultExportOptions, exportFileName, renderExport, type ExportMode } from '../lib/export'
import { getImage } from '../lib/db'
import { backupFileName, createBackup } from '../lib/backup'
import { LONG_LINK, encodeTemplate, templateFromProject, templateLink } from '../lib/templates'
import { canShareFiles, canShareLinks, copyText, shareFile, shareLink, type ShareOutcome } from '../lib/share'
import { pluralize } from '../lib/format'

interface ShareDialogProps {
  open: boolean
  project: Project
  thumbs: ReadonlyMap<string, Blob>
  theme: 'light' | 'dark'
  /** Saves pending edits so shared files are up to date. */
  onBeforeShare: () => Promise<unknown>
  onClose: () => void
}

export function ShareDialog(props: ShareDialogProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} size="lg" title="Share your feed" description="Get feedback from friends, or share the idea behind your feed as a template others can use.">
      <ShareContent {...props} />
    </Dialog>
  )
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-line p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-subtle">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function ShareContent({ project, thumbs, theme, onBeforeShare }: ShareDialogProps) {
  const toast = useToast()
  const [mode, setMode] = useState<ExportMode>('profile')
  const [busy, setBusy] = useState<'image' | 'file' | null>(null)
  const [captions, setCaptions] = useState(true)
  const [schedule, setSchedule] = useState(true)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const photoIds = useMemo(() => project.order.filter((id) => !project.slots[id] && thumbs.has(id)), [project.order, project.slots, thumbs])
  const colors = useColorAnalysis(thumbs, photoIds, true)
  const analysed = photoIds.every((id) => colors.has(id))
  const template = useMemo(() => (analysed ? templateFromProject(project, colors, { captions, schedule }) : null), [analysed, project, colors, captions, schedule])
  const photoCount = photoIds.length
  const fileShare = typeof navigator !== 'undefined' && canShareFiles([new File([''], 'x.jpg', { type: 'image/jpeg' })])

  useEffect(() => {
    if (!template) return
    let cancelled = false
    encodeTemplate(template).then((encoded) => {
      if (!cancelled) {
        setLink(templateLink(encoded))
        setCopied(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [template])

  const report = (outcome: ShareOutcome, what: string) => {
    if (outcome === 'shared') toast(`${what} shared`)
    else if (outcome === 'downloaded') toast(`${what} downloaded`, { description: 'Attach it to a message or email to send it.' })
  }

  const shareImage = async () => {
    setBusy('image')
    try {
      const result = await renderExport({ project, loadBlob: async (id) => (await getImage(id))?.blob }, { ...defaultExportOptions, mode, theme, format: 'jpeg' })
      const file = new File([result.blob], exportFileName(project.name, mode, 'jpeg'), { type: 'image/jpeg' })
      report(await shareFile(file, project.name, 'My planned Instagram feed — what do you think?'), 'Preview image')
    } catch (error) {
      toast('Couldn’t create the image', { tone: 'error', description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(null)
    }
  }

  const shareProjectFile = async () => {
    setBusy('file')
    try {
      await onBeforeShare()
      const blob = await createBackup([project])
      const file = new File([blob], backupFileName([project]), { type: 'application/octet-stream' })
      report(await shareFile(file, project.name, 'Open this in FeedPlanner with “Open a backup or shared project”.'), 'Project file')
    } catch {
      toast('Couldn’t prepare the project file', { tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const copyLink = async () => {
    if (!link) return
    const ok = await copyText(link)
    setCopied(ok)
    toast(ok ? 'Template link copied' : 'Couldn’t copy the link', ok ? { description: 'Paste it anywhere — no photos are included.' } : { tone: 'error', description: 'Select the link and copy it manually.' })
  }

  const sendLink = async () => {
    if (!link) return
    const outcome = await shareLink(link, `${project.name} · feed idea`, 'A feed idea for Instagram — open it in FeedPlanner to use it with your own photos.')
    if (outcome === 'shared') toast('Template link shared')
    else if (outcome === 'unsupported') void copyLink()
  }

  const empty = project.order.length === 0

  return (
    <div className="space-y-6">
      <section aria-labelledby="share-friends">
        <h3 id="share-friends" className="eyebrow mb-2.5">
          Send to friends
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card icon={<ImageIcon className="size-4" aria-hidden />} title="Preview image">
            <p className="mt-2 flex-1 text-xs leading-relaxed text-muted">A picture of your planned feed, ready to send for quick feedback.</p>
            <div className="mt-3 flex gap-1 rounded-lg bg-subtle p-1 text-xs" role="radiogroup" aria-label="Image content">
              {(
                [
                  ['profile', 'With profile'],
                  ['grid', 'Grid only'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={`flex-1 rounded-md px-2 py-1 ${mode === value ? 'bg-surface font-medium shadow-sm' : 'text-muted hover:text-fg'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary mt-3" onClick={() => void shareImage()} disabled={busy !== null || (empty && mode === 'grid')}>
              {busy === 'image' ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              {fileShare ? 'Share image' : 'Download image'}
            </button>
          </Card>
          <Card icon={<FileArchive className="size-4" aria-hidden />} title="Project file">
            <p className="mt-2 flex-1 text-xs leading-relaxed text-muted">
              The whole project with your photos, captions and dates. Friends open it in FeedPlanner, rearrange it and send it back.
            </p>
            <button type="button" className="btn btn-secondary mt-3" onClick={() => void shareProjectFile()} disabled={busy !== null}>
              {busy === 'file' ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              {canShareFiles([new File([''], 'x.feedplanner', { type: 'application/octet-stream' })]) ? 'Share project file' : 'Download project file'}
            </button>
          </Card>
        </div>
        <p className="mt-2 text-xs text-muted">
          {fileShare ? 'Opens your device’s share menu.' : 'Your browser can’t share files directly, so they’re downloaded for you to attach.'} Files go straight to the app you choose — nothing is uploaded by FeedPlanner.
        </p>
      </section>

      <section aria-labelledby="share-template" className="border-t border-line pt-5">
        <h3 id="share-template" className="eyebrow mb-1">
          Share as a feed idea
        </h3>
        <p className="mb-3 text-sm text-muted">
          A link to the idea behind your feed — layout, post types, colour hints{captions ? ', captions' : ''}
          {schedule ? ' and posting rhythm' : ''}. <span className="font-medium text-fg">No photos are included.</span> Whoever opens it gets empty spots to fill with their own photos.
        </p>

        {empty ? (
          <p className="rounded-lg bg-subtle px-3 py-2.5 text-sm text-muted">Add photos first, then share the idea behind your grid.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <div className="mx-auto w-40 sm:mx-0">
              {template ? (
                <TemplatePreview template={template} limit={12} notes={false} />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-lg bg-subtle text-xs text-muted">
                  <LoaderCircle className="mr-1.5 size-3.5 animate-spin" aria-hidden /> Reading colours…
                </div>
              )}
              <p className="mt-1.5 text-center text-[11px] text-muted">
                {pluralize(project.order.length, 'spot')}
                {photoCount ? ` · colours from ${pluralize(photoCount, 'photo')}` : ''}
              </p>
            </div>
            <div className="min-w-0 space-y-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--app-accent)]" checked={captions} onChange={(e) => setCaptions(e.target.checked)} />
                Include captions
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--app-accent)]" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />
                Include posting rhythm
              </label>
              <div className="flex gap-2">
                <label htmlFor="template-link" className="sr-only">
                  Template link
                </label>
                <input id="template-link" readOnly className="field min-w-0 font-mono text-xs" value={link ?? 'Preparing link…'} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn btn-secondary shrink-0" onClick={() => void copyLink()} disabled={!link}>
                  {copied ? <Check className="size-4 text-success" aria-hidden /> : <CopyIcon className="size-4" aria-hidden />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {canShareLinks() && (
                <button type="button" className="btn btn-primary w-full" onClick={() => void sendLink()} disabled={!link}>
                  <Link2 className="size-4" aria-hidden /> Share link
                </button>
              )}
              {link && link.length > LONG_LINK && (
                <p className="flex gap-1.5 rounded-lg bg-amber-400/15 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  This link is long ({link.length.toLocaleString()} characters) and some apps may cut it off. Turning off captions makes it shorter.
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
