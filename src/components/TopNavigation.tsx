import type { ComponentProps } from 'react'
import { CircleHelp, Download, Redo2, Search, Share2, Undo2 } from 'lucide-react'
import type { SaveStatus } from '../types'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { SaveIndicator } from './SaveIndicator'
import { ProjectSwitcher } from './ProjectSwitcher'

interface TopNavigationProps {
  switcher: ComponentProps<typeof ProjectSwitcher>
  status: SaveStatus
  error: string | null
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onRetrySave: () => void
  onExport: () => void
  onShare: () => void
  onSearch: () => void
  onHelp: () => void
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl+'

export function TopNavigation({ switcher, status, error, canUndo, canRedo, onUndo, onRedo, onRetrySave, onExport, onShare, onSearch, onHelp }: TopNavigationProps) {
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-1 border-b border-line bg-surface px-2 sm:gap-2 sm:px-4">
      <a href="#main" className="sr-only rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50">
        Skip to grid
      </a>
      <div className="flex shrink-0 items-center pl-1">
        <Logo compact />
      </div>
      <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
      <ProjectSwitcher {...switcher} />
      <SaveIndicator status={status} error={error} onRetry={onRetrySave} />

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <button
          type="button"
          onClick={onSearch}
          data-tour="search"
          className="mr-1 hidden h-9 items-center gap-2 rounded-lg border border-line bg-bg px-2.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg md:flex lg:w-52"
          aria-label="Search actions, projects and posts"
          title={`Search (${mod}K)`}
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden flex-1 text-left lg:inline">Search…</span>
          <kbd className="hidden rounded border border-line bg-surface px-1.5 text-[11px] font-medium lg:inline">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title={`Undo (${mod}Z)`}>
          <Undo2 className="size-4.5" aria-hidden />
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title={`Redo (${mod}Shift+Z)`}>
          <Redo2 className="size-4.5" aria-hidden />
        </button>
        <ThemeToggle />
        <button type="button" className="btn btn-ghost btn-icon hidden sm:inline-flex" onClick={onHelp} aria-label="Help and shortcuts" title="Help & shortcuts (?)">
          <CircleHelp className="size-4.5" aria-hidden />
        </button>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
        <button type="button" className="btn btn-secondary px-2.5 sm:px-3.5" onClick={onShare} aria-label="Share" data-tour="share">
          <Share2 className="size-4" aria-hidden />
          <span className="hidden sm:inline">Share</span>
        </button>
        <button type="button" className="btn btn-primary px-2.5 sm:px-3.5" onClick={onExport} aria-label="Export image">
          <Download className="size-4" aria-hidden />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </header>
  )
}
