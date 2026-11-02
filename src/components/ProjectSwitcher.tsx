import { useRef } from 'react'
import { ArchiveRestore, Check, ChevronsUpDown, CircleHelp, Copy, HardDrive, HardDriveDownload, Lightbulb, MonitorDown, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { Project } from '../types'
import { formatRelative, pluralize } from '../lib/format'
import { Popover } from './Popover'
import { BACKUP_EXTENSION } from '../lib/backup'

interface ProjectSwitcherProps {
  current: Project
  projects: Project[]
  onOpen: (id: string) => void
  onNew: () => void
  onRename: () => void
  onDuplicate: () => void
  onClear: () => void
  onDelete: () => void
  onTemplates: () => void
  onBackup: (scope: 'project' | 'all') => void
  onRestore: (file: File) => void
  onHelp: () => void
  /** Present when the browser offers to install FeedPlanner as an app. */
  onInstall?: () => void
}

const itemClass =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-fg hover:bg-subtle disabled:pointer-events-none disabled:opacity-45'

/** "9 photos", or "3 photos · 6 empty spots" for projects started from a feed idea. */
function describeContents(project: Project) {
  const spots = project.order.filter((id) => project.slots[id]).length
  const photos = pluralize(project.order.length - spots, 'photo')
  return spots ? `${photos} · ${pluralize(spots, 'empty spot')}` : photos
}

export function ProjectSwitcher({ current, projects, onOpen, onNew, onRename, onDuplicate, onClear, onDelete, onTemplates, onBackup, onRestore, onHelp, onInstall }: ProjectSwitcherProps) {
  const restoreInput = useRef<HTMLInputElement>(null)
  // Show the editor's live copy of the current project rather than the last saved one.
  const list = projects.map((p) => (p.id === current.id ? current : p))
  if (!list.some((p) => p.id === current.id)) list.unshift(current)

  return (
    <Popover
      label="Projects"
      className="w-[min(20rem,calc(100vw-2rem))] p-1.5"
      trigger={({ open, toggle, id }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={id}
          className="flex h-9 max-w-[7.5rem] min-w-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium hover:bg-subtle min-[400px]:max-w-[11rem] sm:max-w-[16rem] sm:px-2.5"
        >
          <span className="truncate">{current.name}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted" aria-hidden />
          <span className="sr-only">, switch or manage projects</span>
        </button>
      )}
    >
      {(close) => {
        const run = (fn: () => void) => () => {
          close()
          fn()
        }
        return (
          <div>
            <p className="eyebrow px-2.5 pt-2 pb-1">This project</p>
            <button type="button" className={itemClass} onClick={run(onRename)}>
              <Pencil className="size-4 text-muted" aria-hidden /> Rename
            </button>
            <button type="button" className={itemClass} onClick={run(onDuplicate)}>
              <Copy className="size-4 text-muted" aria-hidden /> Duplicate
            </button>
            <button type="button" className={itemClass} onClick={run(onClear)} disabled={current.order.length === 0}>
              <RotateCcw className="size-4 text-muted" aria-hidden /> Clear all photos
            </button>
            <button type="button" className={`${itemClass} text-danger`} onClick={run(onDelete)}>
              <Trash2 className="size-4" aria-hidden /> Delete project
            </button>

            <div className="my-1.5 border-t border-line" />
            <p className="eyebrow px-2.5 pt-1 pb-1">All projects</p>
            <ul className="max-h-64 overflow-y-auto">
              {list.map((project) => {
                const active = project.id === current.id
                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      className={`${itemClass} ${active ? 'bg-subtle' : ''}`}
                      aria-current={active ? 'true' : undefined}
                      onClick={run(() => !active && onOpen(project.id))}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{project.name}</span>
                        <span className="block text-xs text-muted">
                          {describeContents(project)} · {formatRelative(project.updatedAt)}
                        </span>
                      </span>
                      {active && <Check className="size-4 text-accent" aria-hidden />}
                    </button>
                  </li>
                )
              })}
            </ul>
            <button type="button" className={`${itemClass} mt-1 font-medium`} onClick={run(onNew)}>
              <Plus className="size-4 text-muted" aria-hidden /> New project
            </button>
            <button type="button" className={itemClass} onClick={run(onTemplates)}>
              <Lightbulb className="size-4 text-muted" aria-hidden /> New from a feed idea…
            </button>

            <div className="my-1.5 border-t border-line" />
            <p className="eyebrow px-2.5 pt-1 pb-1">Backup</p>
            <button type="button" className={itemClass} onClick={run(() => onBackup('project'))}>
              <HardDriveDownload className="size-4 text-muted" aria-hidden /> Back up this project
            </button>
            <button type="button" className={itemClass} onClick={run(() => onBackup('all'))} disabled={list.length < 2}>
              <HardDriveDownload className="size-4 text-muted" aria-hidden /> Back up all projects
            </button>
            <button type="button" className={itemClass} onClick={() => restoreInput.current?.click()}>
              <ArchiveRestore className="size-4 text-muted" aria-hidden /> Open a backup or shared project…
            </button>
            <input
              ref={restoreInput}
              type="file"
              accept={`${BACKUP_EXTENSION},application/octet-stream`}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) {
                  close()
                  onRestore(file)
                }
              }}
            />
            {onInstall && (
              <button type="button" className={itemClass} onClick={run(onInstall)}>
                <MonitorDown className="size-4 text-muted" aria-hidden /> Install FeedPlanner app
              </button>
            )}
            <button type="button" className={itemClass} onClick={run(onHelp)}>
              <CircleHelp className="size-4 text-muted" aria-hidden /> Help, shortcuts & tour
            </button>
            <p className="mt-1.5 flex gap-2 border-t border-line px-2.5 pt-2.5 pb-1.5 text-xs leading-relaxed text-muted">
              <HardDrive className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Projects are saved in this browser only and don’t sync to other devices. Back up to move them or keep them safe.
            </p>
          </div>
        )
      }}
    </Popover>
  )
}
