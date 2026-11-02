import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Bookmark,
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  CircleHelp,
  Download,
  FolderOpen,
  Hash,
  ImagePlus,
  Info,
  LayoutGrid,
  Lightbulb,
  ListOrdered,
  Moon,
  Palette,
  Plus,
  Redo2,
  Scissors,
  Search,
  Send,
  Share2,
  Smartphone,
  SlidersHorizontal,
  Sparkles,
  SquareUser,
  Sun,
  Undo2,
  Wand2,
} from 'lucide-react'
import type { FeedFilter, LoadedImage, PostDetails, PostType, Project, ProfileInfo, Slot, StoredImage, TileAspect } from '../types'
import { useProjectEditor } from '../hooks/useProjectEditor'
import { useObjectUrls } from '../hooks/useObjectUrls'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useColorAnalysis } from '../hooks/useColorAnalysis'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { useConfirm, useTheme, useToast } from '../providers/contexts'
import { buildAgenda, markArranged } from '../lib/today'
import { buildIcs, calendarPosts } from '../lib/calendar'
import { deleteProject, duplicateProject, listProjects, putImages, toStorageError } from '../lib/db'
import { ImageProcessingError, nextFrame, processImage, validateFile } from '../lib/images'
import { insertIds, moveItem, type InsertPosition } from '../lib/grid'
import { pluralize, slugify } from '../lib/format'
import { getPost, isNeutralFilter, nextToPost, scheduleConflicts, toISODate } from '../lib/posts'
import { postingNumber } from '../lib/grid'
import { feedPalette, similarNeighbors } from '../lib/colors'
import { splitImage } from '../lib/split'
import { BACKUP_EXTENSION, backupFileName, createBackup } from '../lib/backup'
import { downloadBlob } from '../lib/export'
import { createId } from '../lib/id'
import { hasFiles } from '../lib/ui'
import { TopNavigation } from './TopNavigation'
import { ToolPanel, DragHint } from './ToolPanel'
import { InstagramProfilePreview, PhoneFrame } from './InstagramProfilePreview'
import { PhotoGrid } from './PhotoGrid'
import { BulkBar, BulkPanel, PhotoDetailsSheet, PhotoInspector, SelectionBar, type BulkActions } from './PhotoInspector'
import { ProfileForm } from './ProfileForm'
import { UploadDialog, type AddPosition, type AddResult } from './UploadDialog'
import { ShareDialog } from './ShareDialog'
import { ExportDialog } from './ExportDialog'
import { NameDialog } from './NameDialog'
import { Dialog } from './Dialog'
import { CropDialog } from './CropDialog'
import { ScheduleView } from './ScheduleView'
import { AutoScheduleDialog } from './AutoScheduleDialog'
import { SplitDialog } from './SplitDialog'
import { VersionsDialog } from './VersionsDialog'
import { LookDialog } from './LookDialog'
import { ColorSummary } from './ColorSummary'
import { TodayView } from './TodayView'
import { PostNowDialog } from './PostNowDialog'
import { CommandPalette, type Command, type SearchablePost } from './CommandPalette'
import { HelpDialog } from './HelpDialog'
import { SnippetsDialog } from './SnippetsDialog'
import { Tour, type TourStep } from './Tour'

type ImageMeta = Omit<StoredImage, 'blob'>
type View = 'today' | 'grid' | 'posting' | 'colors' | 'calendar'
type DialogName = 'export' | 'share' | 'profile' | 'rename' | 'new' | 'crop' | 'details' | 'split' | 'versions' | 'look' | 'schedule' | 'palette' | 'help' | 'snippets'

interface WorkspaceProps {
  initialProject: Project
  initialImages: StoredImage[]
  projects: Project[]
  openUploadOnStart?: boolean
  onOpenProject: (id: string) => Promise<void>
  onCreateProject: (name: string) => Promise<void>
  onProjectDeleted: (id: string) => Promise<void>
  onProjectSaved: (project: Project) => void
  onRestoreBackup: (file: File) => Promise<void>
  onOpenTemplates: () => void
}

const HINT_KEY = 'fp-hint-dismissed'
const PHONE_KEY = 'fp-phone-frame'
const TOUR_KEY = 'fp-tour-done'
const CHECKLIST_KEY = 'fp-checklist-hidden'
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const modKey = isMac ? '⌘' : 'Ctrl+'

/** The view in use, kept while switching projects. Each visit starts fresh on Today. */
let sessionView: View | null = null

function initialView(project: Project): View {
  // Projects with no photos yet (new, or only empty spots from a feed idea) are best seen as a grid.
  if (!project.order.some((id) => !project.slots[id])) return 'grid'
  return sessionView ?? 'today'
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // Not critical.
  }
}

function toMeta({ blob: _blob, ...meta }: StoredImage): ImageMeta {
  void _blob
  return meta
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

function SegmentedToggle<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 ${value === v ? 'bg-fg text-bg' : 'text-muted hover:text-fg'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

function ToolbarButton({ icon, label, pressed, onClick, disabled }: { icon: ReactNode; label: string; pressed?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={`btn h-8 gap-1.5 rounded-full px-3 text-xs ${pressed ? 'bg-fg text-bg hover:bg-fg/90' : 'border border-line bg-surface text-fg hover:bg-subtle'}`}
    >
      {icon}
      {label}
    </button>
  )
}

function EmptyGrid({ onAdd, onSplit }: { onAdd: () => void; onSplit: () => void }) {
  return (
    <div className="relative">
      <div className="grid grid-cols-3 gap-[2px]" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="aspect-[3/4] bg-[#f4f4f4] dark:bg-[#121212]" />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="max-w-64 rounded-2xl border border-line bg-surface p-6 text-center text-fg shadow-soft">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ImagePlus className="size-5" aria-hidden />
          </span>
          <p className="mt-3 text-[15px] font-semibold">Start your grid</p>
          <p className="mt-1 text-sm text-muted">Add the photos you plan to post, or drag them anywhere onto this page.</p>
          <button type="button" className="btn btn-primary mt-4 w-full" onClick={onAdd}>
            Add photos
          </button>
          <button type="button" className="btn btn-ghost mt-1 w-full text-xs text-muted" onClick={onSplit}>
            <Scissors className="size-3.5" aria-hidden /> Or split one big photo
          </button>
        </div>
      </div>
    </div>
  )
}

export function Workspace({
  initialProject,
  initialImages,
  projects,
  openUploadOnStart = false,
  onOpenProject,
  onCreateProject,
  onProjectDeleted,
  onProjectSaved,
  onRestoreBackup,
  onOpenTemplates,
}: WorkspaceProps) {
  const toast = useToast()
  const confirm = useConfirm()
  const { resolved: theme, setPreference } = useTheme()
  const isWide = useMediaQuery('(min-width: 1280px)')
  const install = useInstallPrompt()
  const editor = useProjectEditor(initialProject, onProjectSaved)
  const { project, dispatch, save } = editor
  const { order, posts, filter } = project

  // Image records stay in memory for the session so undo can restore removed photos.
  const [records, setRecords] = useState<ReadonlyMap<string, ImageMeta>>(() => new Map(initialImages.map((img) => [img.id, toMeta(img)])))
  const thumbs = useMemo(() => new Map([...records].map(([id, r]) => [id, r.thumb as Blob])), [records])
  const urls = useObjectUrls(thumbs)
  const images = useMemo(() => {
    const map = new Map<string, LoadedImage>()
    for (const [id, r] of records) map.set(id, { id, name: r.name, size: r.size, width: r.width, height: r.height, thumbUrl: urls.get(id) ?? '' })
    // Empty spots from templates render like photos everywhere, with their note and colour.
    for (const [id, slot] of Object.entries(project.slots)) {
      if (!map.has(id)) map.set(id, { id, name: slot.note || 'Empty spot', size: 0, width: 0, height: 0, thumbUrl: '', slot })
    }
    return map
  }, [records, urls, project.slots])
  const resolveUrl = useCallback((id: string | null) => (id ? images.get(id)?.thumbUrl || undefined : undefined), [images])

  const [view, setViewState] = useState<View>(() => initialView(initialProject))
  const setView = setViewState
  useEffect(() => {
    sessionView = view
  }, [view])
  const [postNowId, setPostNowId] = useState<string | null>(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [checklistHidden, setChecklistHidden] = useState(() => readFlag(CHECKLIST_KEY))
  const today = toISODate(new Date())
  const [phoneFrame, setPhoneFrame] = useState(() => readFlag(PHONE_KEY))
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showHint, setShowHint] = useState(() => !readFlag(HINT_KEY))
  const [upload, setUpload] = useState<{ open: boolean; files: File[]; session: number }>({ open: openUploadOnStart, files: [], session: 0 })
  const [dialog, setDialog] = useState<DialogName | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const inspectorRef = useRef<HTMLDivElement>(null)

  // Selection only counts photos still in the grid (undo/remove can change that).
  const selection = useMemo(() => selectedIds.filter((id) => order.includes(id)), [selectedIds, order])
  const selectedSet = useMemo(() => new Set(selection), [selection])
  const single = selection.length === 1 ? selection[0] : null
  const singleIndex = single ? order.indexOf(single) : -1
  const multi = selection.length > 1

  const conflicts = useMemo(() => scheduleConflicts(order, posts), [order, posts])
  const nextId = useMemo(() => nextToPost(order, posts), [order, posts])
  const photoIds = useMemo(() => new Set(records.keys()), [records])
  const agenda = useMemo(() => buildAgenda(project, photoIds, today), [project, photoIds, today])
  const colors = useColorAnalysis(thumbs, order, view === 'colors')
  const similarPairs = useMemo(() => (view === 'colors' ? similarNeighbors(order, colors) : []), [view, order, colors])
  const similar = useMemo(() => new Set(similarPairs.flat()), [similarPairs])
  const palette = useMemo(() => (view === 'colors' ? feedPalette(order.map((id) => colors.get(id)).filter((c) => !!c)) : []), [view, order, colors])

  const openUpload = useCallback((files: File[] = []) => setUpload((u) => ({ open: true, files, session: u.session + 1 })), [])
  const closeDialog = useCallback(() => setDialog(null), [])

  const dismissHint = () => {
    setShowHint(false)
    writeFlag(HINT_KEY, true)
  }

  const storeImages = async (stored: StoredImage[]) => {
    await putImages(stored)
    setRecords((current) => {
      const next = new Map(current)
      for (const img of stored) next.set(img.id, toMeta(img))
      return next
    })
  }

  const describeError = (error: unknown) =>
    error instanceof ImageProcessingError ? error.message : error instanceof Error && error.name === 'StorageError' ? error.message : 'This photo couldn’t be processed.'

  // ---- Selection -------------------------------------------------------------

  const select = useCallback(
    (id: string, additive: boolean) => {
      setSelectedIds((current) => {
        const valid = current.filter((x) => order.includes(x))
        if (additive || selectMode) return valid.includes(id) ? valid.filter((x) => x !== id) : [...valid, id]
        return valid.length === 1 && valid[0] === id ? [] : [id]
      })
    },
    [order, selectMode],
  )
  const clearSelection = useCallback(() => setSelectedIds([]), [])

  // ---- Photo actions -------------------------------------------------------

  const updatePost = useCallback((id: string, patch: Partial<PostDetails>) => dispatch({ type: 'updatePosts', patches: { [id]: patch } }), [dispatch])
  const updatePosts = useCallback(
    (ids: string[], patch: Partial<PostDetails>) => dispatch({ type: 'updatePosts', patches: Object.fromEntries(ids.map((id) => [id, patch])) }),
    [dispatch],
  )

  const addPhotos = async (items: { key: string; file: File; type: string }[], position: AddPosition, onProgress: (done: number) => void, posted: boolean): Promise<AddResult> => {
    const processed: StoredImage[] = []
    const failed: AddResult['failed'] = []
    for (let i = 0; i < items.length; i++) {
      onProgress(i)
      const { key, file, type } = items[i]
      try {
        processed.push(await processImage(file, file.name, project.id, type))
      } catch (error) {
        failed.push({ key, name: file.name, reason: describeError(error) })
      }
      await nextFrame()
    }
    onProgress(items.length)
    try {
      await storeImages(processed)
    } catch (error) {
      const reason = toStorageError(error).message
      toast('Photos couldn’t be saved', { tone: 'error', description: reason })
      return { added: 0, failed: items.map((item) => ({ key: item.key, name: item.file.name, reason })) }
    }
    const ids = processed.map((img) => img.id)
    // A first batch of photos is best seen in the grid.
    if (ids.length && order.length === 0) setView('grid')
    if (ids.length && position === 'fill') {
      // Fill empty spots from the top-left; anything left over goes to the bottom.
      const spots = order.filter((id) => project.slots[id] && !records.has(id))
      const pairs = spots.slice(0, ids.length).map((spot, i): [string, string] => [spot, ids[i]])
      dispatch({ type: 'replacePhotos', pairs })
      const rest = ids.slice(pairs.length)
      if (rest.length) dispatch({ type: 'updateOrder', update: (o) => insertIds(o, rest, 'end') })
      if (posted) updatePosts(ids, { posted: true })
      toast(`${pluralize(pairs.length, 'empty spot')} filled`, { description: rest.length ? `${pluralize(rest.length, 'extra photo')} added at the bottom.` : undefined })
    } else if (ids.length) {
      dispatch({ type: 'updateOrder', update: (o) => insertIds(o, ids, position as InsertPosition) })
      if (posted) updatePosts(ids, { posted: true })
      toast(`${pluralize(ids.length, 'photo')} added`, { description: failed.length ? `${failed.length} couldn’t be processed.` : undefined })
    }
    return { added: ids.length, failed }
  }

  const removePhotos = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      const removed = new Set(ids)
      const before = order
      dispatch({ type: 'updateOrder', update: (o) => o.filter((id) => !removed.has(id)) })
      setSelectedIds([])
      toast(ids.length === 1 ? 'Photo removed' : `${pluralize(ids.length, 'photo')} removed`, {
        action: {
          label: 'Undo',
          onClick: () =>
            dispatch({
              type: 'updateOrder',
              update: (o) => {
                if (ids.every((id) => o.includes(id))) return o
                // Put removed photos back where they were, keeping anything added since.
                const restored = before.filter((id) => o.includes(id) || removed.has(id))
                return [...o.filter((id) => !before.includes(id)), ...restored]
              },
            }),
        },
      })
    },
    [order, dispatch, toast],
  )

  const movePhoto = (delta: number) => {
    if (!single) return
    dispatch({
      type: 'updateOrder',
      update: (o) => {
        const from = o.indexOf(single)
        return from === -1 ? o : moveItem(o, from, from + delta)
      },
    })
  }

  const moveSelectionToTop = () => {
    const chosen = new Set(selection)
    dispatch({ type: 'updateOrder', update: (o) => [...o.filter((id) => chosen.has(id)), ...o.filter((id) => !chosen.has(id))] })
  }

  const replacePhoto = async (file: File) => {
    if (!single) return
    const validation = validateFile(file)
    if (!validation.ok) {
      toast('Photo not replaced', { tone: 'error', description: validation.reason })
      return
    }
    try {
      const stored = await processImage(file, file.name, project.id, validation.type)
      await storeImages([stored])
      const wasSpot = !!project.slots[single] && !records.has(single)
      dispatch({ type: 'replacePhotos', pairs: [[single, stored.id]] })
      setSelectedIds([stored.id])
      toast(wasSpot ? 'Photo added to this spot' : 'Photo replaced', { description: 'Its caption, date and post type were kept.' })
    } catch (error) {
      toast('Photo not replaced', { tone: 'error', description: describeError(error) })
    }
  }

  /** Processes one profile image (avatar or highlight cover) and returns its id. */
  const storeProfileImage = async (file: File, failure: string): Promise<string | null> => {
    const validation = validateFile(file)
    if (!validation.ok) {
      toast(failure, { tone: 'error', description: validation.reason })
      return null
    }
    try {
      const stored = await processImage(file, file.name, project.id, validation.type)
      await storeImages([stored])
      return stored.id
    } catch (error) {
      toast(failure, { tone: 'error', description: describeError(error) })
      return null
    }
  }

  const setAvatar = async (file: File) => {
    const id = await storeProfileImage(file, 'Profile photo not updated')
    if (id) dispatch({ type: 'updateProfile', patch: { avatarId: id } })
  }

  const latestHighlights = useRef(project.profile.highlights)
  useEffect(() => {
    latestHighlights.current = project.profile.highlights
  })
  const setHighlightCover = async (highlightId: string, file: File) => {
    const id = await storeProfileImage(file, 'Highlight cover not updated')
    if (!id) return
    // Read the latest highlights: the title may have been edited while the photo was processing.
    dispatch({ type: 'updateProfile', patch: { highlights: latestHighlights.current.map((h) => (h.id === highlightId ? { ...h, coverId: id } : h)) } })
  }

  const splitPhoto = async (file: File, rows: number, position: InsertPosition): Promise<boolean> => {
    try {
      const pieces = await splitImage(file, rows, project.aspect)
      const base = file.name.replace(/\.[^.]+$/, '')
      const stored: StoredImage[] = []
      for (let i = 0; i < pieces.length; i++) {
        stored.push(await processImage(pieces[i], `${base} · tile ${i + 1} of ${pieces.length}.jpg`, project.id, 'image/jpeg'))
        await nextFrame()
      }
      await storeImages(stored)
      const ids = stored.map((s) => s.id)
      dispatch({ type: 'updateOrder', update: (o) => insertIds(o, ids, position) })
      toast(`Photo split into ${pieces.length} tiles`, { description: `Post them together, in order: tiles ${pieces.length} to 1.` })
      return true
    } catch (error) {
      toast('Couldn’t split this photo', { tone: 'error', description: describeError(error) })
      return false
    }
  }

  const updateProfile = useCallback((patch: Partial<ProfileInfo>) => dispatch({ type: 'updateProfile', patch }), [dispatch])
  const reorder = useCallback(
    (next: string[]) => {
      markArranged()
      dispatch({ type: 'setOrder', order: next })
    },
    [dispatch],
  )
  const setFilter = useCallback((next: FeedFilter) => dispatch({ type: 'setFilter', filter: next }), [dispatch])

  const resetGrid = async () => {
    const ok = await confirm({
      title: 'Reset this grid?',
      description: `All ${pluralize(order.length, 'photo')} will be removed from “${project.name}”. You can undo this until you leave the project.`,
      confirmLabel: 'Reset grid',
      tone: 'danger',
    })
    if (!ok) return
    dispatch({ type: 'setOrder', order: [] })
    setSelectedIds([])
    toast('Grid reset', { action: { label: 'Undo', onClick: () => dispatch({ type: 'undo' }) } })
  }

  // ---- Versions --------------------------------------------------------------

  const saveVersion = (name: string) => {
    dispatch({ type: 'saveSnapshot', id: createId(), name, createdAt: Date.now() })
    toast('Version saved', { description: `“${name}” keeps this arrangement.` })
  }

  const restoreVersion = (id: string) => {
    const snapshot = project.snapshots.find((s) => s.id === id)
    if (!snapshot) return
    dispatch({ type: 'restoreSnapshot', id })
    setSelectedIds([])
    toast(`Restored “${snapshot.name}”`, { action: { label: 'Undo', onClick: () => dispatch({ type: 'undo' }) } })
  }

  const deleteVersion = async (id: string) => {
    const snapshot = project.snapshots.find((s) => s.id === id)
    if (!snapshot) return
    const ok = await confirm({ title: `Delete “${snapshot.name}”?`, description: 'The saved arrangement is removed. Your current grid isn’t affected.', confirmLabel: 'Delete version', tone: 'danger' })
    if (ok) dispatch({ type: 'deleteSnapshot', id })
  }

  // ---- Project actions -----------------------------------------------------

  const switchProject = async (id: string) => {
    if (!(await save())) {
      const leave = await confirm({ title: 'Leave without saving?', description: 'Your latest changes couldn’t be saved to this browser.', confirmLabel: 'Leave anyway', tone: 'danger' })
      if (!leave) return
    }
    await onOpenProject(id)
  }

  const createNew = async (name: string) => {
    setDialog(null)
    await save()
    await onCreateProject(name)
  }

  const duplicate = async () => {
    await save()
    try {
      const copy = await duplicateProject(project, `${project.name} copy`.slice(0, 80))
      toast('Project duplicated', { description: `You’re now editing “${copy.name}”.` })
      await onOpenProject(copy.id)
    } catch (error) {
      toast('Couldn’t duplicate project', { tone: 'error', description: toStorageError(error).message })
    }
  }

  const removeProject = async () => {
    const ok = await confirm({
      title: `Delete “${project.name}”?`,
      description: 'This permanently removes the project and its photos from this browser. This can’t be undone.',
      confirmLabel: 'Delete project',
      tone: 'danger',
    })
    if (!ok) return
    editor.disableSaving()
    try {
      await deleteProject(project.id)
      toast('Project deleted')
      await onProjectDeleted(project.id)
    } catch (error) {
      toast('Couldn’t delete project', { tone: 'error', description: toStorageError(error).message })
    }
  }

  const backup = async (scope: 'project' | 'all') => {
    await save()
    try {
      const list = scope === 'all' ? (await listProjects()).map((p) => (p.id === project.id ? project : p)) : [project]
      const blob = await createBackup(list)
      const name = backupFileName(list)
      downloadBlob(blob, name)
      toast('Backup downloaded', { description: `${name} · ${pluralize(list.length, 'project')}. Keep it somewhere safe.` })
    } catch (error) {
      toast('Backup failed', { tone: 'error', description: toStorageError(error).message })
    }
  }

  const restore = async (file: File) => {
    await save()
    await onRestoreBackup(file)
  }
  const restoreRef = useRef(restore)
  useEffect(() => {
    restoreRef.current = restore
  })

  const editProfile = () => {
    if (isWide) {
      setSelectedIds([])
      requestAnimationFrame(() => inspectorRef.current?.querySelector<HTMLInputElement>('input:not([type=file])')?.focus())
    } else {
      setDialog('profile')
    }
  }

  const togglePhone = () => {
    setPhoneFrame((v) => {
      writeFlag(PHONE_KEY, !v)
      return !v
    })
  }

  // ---- Daily posting ------------------------------------------------------------

  /** Shows one post's details: in the side inspector on wide screens, in a dialog otherwise. */
  const openPost = useCallback(
    (id: string) => {
      setSelectedIds([id])
      setPostNowId(null)
      setDialog(isWide ? null : 'details')
    },
    [isWide],
  )

  const startPostNow = useCallback((id: string | null) => {
    if (!id) return
    setDialog(null)
    setPostNowId(id)
  }, [])

  const markPosted = (id: string) => {
    updatePost(id, { posted: true })
    toast(`Post ${postingNumber(order.indexOf(id), order.length)} marked as posted`, { action: { label: 'Undo', onClick: () => updatePost(id, { posted: false }) } })
  }

  const addPhotoToSpot = (id: string) => {
    setPostNowId(null)
    openPost(id)
  }

  const downloadCalendar = () => {
    const items = calendarPosts(order, posts)
    if (items.length === 0) {
      toast('Nothing to add yet', { description: 'Give your posts a date first.' })
      setDialog('schedule')
      return
    }
    downloadBlob(new Blob([buildIcs(project.name, items)], { type: 'text/calendar;charset=utf-8' }), `${slugify(project.name)}-posting-plan.ics`)
    toast('Calendar file downloaded', { description: `Open it to add ${pluralize(items.length, 'post')} with reminders to your calendar app.` })
  }

  const hideChecklist = (hidden: boolean) => {
    setChecklistHidden(hidden)
    writeFlag(CHECKLIST_KEY, hidden)
  }

  const finishTour = (completed: boolean) => {
    setTourOpen(false)
    writeFlag(TOUR_KEY, true)
    if (!completed) toast('Tour skipped', { description: 'Replay it any time from Help (?).' })
  }

  // First visit with photos: offer the tour once nothing else is on screen.
  const tourPending = !readFlag(TOUR_KEY) && order.length > 0 && !upload.open && dialog === null && postNowId === null && !tourOpen
  useEffect(() => {
    if (!tourPending) return
    const timer = window.setTimeout(() => setTourOpen(true), 700)
    return () => window.clearTimeout(timer)
  }, [tourPending])

  // ---- Keyboard shortcuts --------------------------------------------------

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]') || tourOpen) return
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (mod && key === 's') {
        event.preventDefault()
        void save()
        return
      }
      if (mod && key === 'k') {
        event.preventDefault()
        setDialog('palette')
        return
      }
      if (isTypingTarget(event.target)) return
      if (!mod && !event.altKey) {
        const shortcuts: Record<string, () => void> = {
          '?': () => setDialog('help'),
          a: () => openUpload(),
          p: () => (nextId ? startPostNow(nextId) : toast('Nothing left to post', { description: 'Every post in this plan is marked as posted.' })),
          t: () => setView('today'),
          g: () => setView('grid'),
          c: () => setView('calendar'),
        }
        const action = shortcuts[event.key] ?? shortcuts[key]
        if (action && !(event.key !== '?' && event.shiftKey)) {
          event.preventDefault()
          action()
          return
        }
      }
      if (mod && key === 'z') {
        event.preventDefault()
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' })
      } else if (mod && key === 'y') {
        event.preventDefault()
        dispatch({ type: 'redo' })
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selection.length) {
        event.preventDefault()
        removePhotos(selection)
      } else if (event.key === 'Escape' && selection.length) {
        setSelectedIds([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, save, selection, removePhotos, tourOpen, openUpload, nextId, startPostNow, setView, toast])

  // ---- Drop files anywhere -------------------------------------------------

  useEffect(() => {
    let depth = 0
    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth++
      if (!document.querySelector('dialog[open]')) setDropActive(true)
    }
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDropActive(false)
    }
    const onOver = (event: DragEvent) => {
      // Always prevent the browser from navigating to a dropped file.
      if (hasFiles(event)) event.preventDefault()
    }
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDropActive(false)
      if (document.querySelector('dialog[open]')) return
      const files = Array.from(event.dataTransfer?.files ?? [])
      const projectFile = files.find((f) => f.name.toLowerCase().endsWith(BACKUP_EXTENSION))
      if (projectFile) void restoreRef.current(projectFile)
      else if (files.length) openUpload(files)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [openUpload])

  // ---- Render ----------------------------------------------------------------

  const avatarUrl = resolveUrl(project.profile.avatarId)
  const selectedImage = single ? images.get(single) : undefined
  const singlePost = single ? getPost(posts, single) : undefined
  const postedCount = order.filter((id) => getPost(posts, id).posted).length

  const photoActions = single
    ? {
        image: selectedImage,
        index: singleIndex,
        total: order.length,
        aspect: project.aspect,
        post: singlePost!,
        filter,
        conflict: conflicts.has(single),
        onMove: movePhoto,
        onMoveToTop: () => dispatch({ type: 'updateOrder', update: (o) => moveItem(o, o.indexOf(single), 0) }),
        onReplace: (file: File) => void replacePhoto(file),
        onRemove: () => removePhotos([single]),
        onDeselect: clearSelection,
        onEditCrop: () => setDialog('crop'),
        onPostChange: (patch: Partial<PostDetails>) => updatePost(single, patch),
        onSlotChange: (patch: Partial<Slot>) => dispatch({ type: 'updateSlot', id: single, patch }),
        onPostNow: () => startPostNow(single),
      }
    : null

  // ---- Post now, search and tour --------------------------------------------

  const postNowTarget =
    postNowId && order.includes(postNowId)
      ? { id: postNowId, number: postingNumber(order.indexOf(postNowId), order.length), total: order.length, image: images.get(postNowId), post: getPost(posts, postNowId) }
      : null
  // What comes after the post being published: the next unposted one in publishing order.
  const afterPostNow = (() => {
    if (!postNowId) return null
    for (let index = order.length - 1; index >= 0; index--) {
      const id = order[index]
      if (id !== postNowId && !getPost(posts, id).posted) return { id, number: postingNumber(index, order.length), post: getPost(posts, id) }
    }
    return null
  })()

  const searchablePosts: SearchablePost[] = order.map((id, index) => ({
    id,
    number: postingNumber(index, order.length),
    caption: getPost(posts, id).caption,
    name: images.get(id)?.name ?? '',
    image: images.get(id),
  }))

  const icon = (Icon: React.ElementType) => <Icon className="size-3.5" aria-hidden />
  const viewCommand = (v: View, label: string, Icon: React.ElementType, hint?: string): Command => ({ id: `view-${v}`, group: 'Go to', label, icon: icon(Icon), hint, run: () => setView(v) })
  const nextNumber = nextId ? postingNumber(order.indexOf(nextId), order.length) : null
  const commands: Command[] = [
    {
      id: 'post-next',
      group: 'Actions',
      label: nextNumber ? `Post now · post ${nextNumber}` : 'Post now',
      icon: icon(Send),
      hint: 'P',
      keywords: 'publish instagram next',
      run: () => (nextId ? startPostNow(nextId) : toast('Nothing left to post')),
    },
    { id: 'add', group: 'Actions', label: 'Add photos', icon: icon(ImagePlus), hint: 'A', keywords: 'upload import', run: () => openUpload() },
    { id: 'schedule', group: 'Actions', label: 'Plan posting dates', icon: icon(Wand2), keywords: 'auto schedule calendar dates', run: () => setDialog('schedule') },
    { id: 'calendar-file', group: 'Actions', label: 'Add plan to my calendar (.ics)', icon: icon(CalendarPlus), keywords: 'reminder google apple outlook ics', run: downloadCalendar },
    { id: 'snippets', group: 'Actions', label: 'Hashtag sets & snippets', icon: icon(Hash), keywords: 'tags caption library', run: () => setDialog('snippets') },
    { id: 'share', group: 'Actions', label: 'Share with friends or as a feed idea', icon: icon(Share2), keywords: 'send link template', run: () => setDialog('share') },
    { id: 'export', group: 'Actions', label: 'Export image', icon: icon(Download), keywords: 'download png jpg', run: () => setDialog('export') },
    { id: 'look', group: 'Actions', label: 'Feed look (filters)', icon: icon(SlidersHorizontal), keywords: 'filter brightness warmth', run: () => setDialog('look') },
    { id: 'versions', group: 'Actions', label: 'Versions', icon: icon(Bookmark), keywords: 'snapshot save arrangement', run: () => setDialog('versions') },
    { id: 'split', group: 'Actions', label: 'Split a photo into tiles', icon: icon(Scissors), keywords: 'puzzle panorama', run: () => setDialog('split') },
    { id: 'profile', group: 'Actions', label: 'Edit profile', icon: icon(SquareUser), keywords: 'username bio avatar highlights', run: () => setDialog('profile') },
    { id: 'undo', group: 'Actions', label: 'Undo', icon: icon(Undo2), hint: `${modKey}Z`, run: () => dispatch({ type: 'undo' }) },
    { id: 'redo', group: 'Actions', label: 'Redo', icon: icon(Redo2), hint: `${modKey}Shift+Z`, run: () => dispatch({ type: 'redo' }) },
    viewCommand('today', 'Today', Sparkles, 'T'),
    viewCommand('grid', 'Grid', LayoutGrid, 'G'),
    viewCommand('posting', 'Posting order', ListOrdered),
    viewCommand('colors', 'Colours', Palette),
    viewCommand('calendar', 'Calendar', CalendarDays, 'C'),
    ...projects
      .filter((p) => p.id !== project.id)
      .map((p): Command => ({ id: `project-${p.id}`, group: 'Projects', label: `Open “${p.name}”`, icon: icon(FolderOpen), keywords: 'switch project', run: () => void switchProject(p.id) })),
    { id: 'new', group: 'Projects', label: 'New project', icon: icon(Plus), keywords: 'create', run: () => setDialog('new') },
    { id: 'templates', group: 'Projects', label: 'New from a feed idea', icon: icon(Lightbulb), keywords: 'template layout', run: onOpenTemplates },
    {
      id: 'theme',
      group: 'Settings',
      label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      icon: icon(theme === 'dark' ? Sun : Moon),
      keywords: 'dark mode',
      run: () => setPreference(theme === 'dark' ? 'light' : 'dark'),
    },
    { id: 'help', group: 'Help', label: 'Help & keyboard shortcuts', icon: icon(CircleHelp), hint: '?', run: () => setDialog('help') },
    { id: 'tour', group: 'Help', label: 'Take the tour', icon: icon(Sparkles), keywords: 'guide onboarding', run: () => setTourOpen(true) },
  ]

  const tourSteps: TourStep[] = [
    { title: 'Welcome to FeedPlanner 👋', body: 'Plan how your Instagram profile will look before you post anything. This 30-second tour shows the things you’ll use most.' },
    {
      target: 'views',
      before: () => setView('grid'),
      title: 'Switch views',
      body: 'Today is your daily to-do list. Grid previews your profile, Order shows the posting sequence, Colours checks the mix, and Calendar plans dates.',
    },
    { target: 'grid', title: 'Drag to rearrange', body: 'This is how your profile will look. Drag photos to move them. Click one to write its caption, pick a date or adjust its crop.' },
    { target: 'add', title: 'Add more photos', body: 'Add photos here, or drop them anywhere on the page. You can review them before they’re added.' },
    { target: 'search', title: 'Find anything', body: `Search every action, project and caption from here — or press ${modKey}K on a keyboard.` },
    { target: 'share', title: 'Share your plan', body: 'Send a preview to friends for feedback, or share the idea behind your feed as a link anyone can use.' },
    {
      target: 'post-now',
      before: () => setView('today'),
      title: 'Come back each day',
      body: 'Today shows what’s due. Post now copies the caption and hands the photo to Instagram, then ticks it off. Help (?) has this tour and every shortcut.',
    },
  ]

  const bulkActions: BulkActions = {
    count: selection.length,
    allPosted: selection.length > 0 && selection.every((id) => getPost(posts, id).posted),
    onMarkPosted: (posted) => {
      updatePosts(selection, { posted })
      toast(posted ? `${pluralize(selection.length, 'photo')} marked as posted` : `${pluralize(selection.length, 'photo')} marked as not posted`)
    },
    onSetType: (type: PostType) => updatePosts(selection, { type }),
    onMoveToTop: moveSelectionToTop,
    onRemove: () => removePhotos(selection),
    onClear: clearSelection,
  }

  const profileForm = (
    <ProfileForm
      profile={project.profile}
      avatarUrl={avatarUrl}
      resolveUrl={resolveUrl}
      onChange={updateProfile}
      onAvatarFile={(f) => void setAvatar(f)}
      onRemoveAvatar={() => updateProfile({ avatarId: null })}
      onHighlightCover={(hid, f) => void setHighlightCover(hid, f)}
    />
  )

  const preview = (
    <InstagramProfilePreview project={project} avatarUrl={avatarUrl} resolveUrl={resolveUrl} onEditProfile={editProfile}>
      {order.length > 0 ? (
        <PhotoGrid
          order={order}
          images={images}
          aspect={project.aspect}
          selectedIds={selectedSet}
          view={view === 'calendar' || view === 'today' ? 'grid' : view}
          posts={posts}
          filter={filter}
          nextId={nextId}
          conflicts={conflicts}
          colors={colors}
          similar={similar}
          onSelect={select}
          onReorder={reorder}
        />
      ) : (
        <EmptyGrid onAdd={() => openUpload()} onSplit={() => setDialog('split')} />
      )}
    </InstagramProfilePreview>
  )

  return (
    <div className="flex h-dvh flex-col">
      <TopNavigation
        switcher={{
          current: project,
          projects,
          onOpen: (id) => void switchProject(id),
          onNew: () => setDialog('new'),
          onRename: () => setDialog('rename'),
          onDuplicate: () => void duplicate(),
          onClear: () => void resetGrid(),
          onDelete: () => void removeProject(),
          onTemplates: onOpenTemplates,
          onBackup: (scope) => void backup(scope),
          onRestore: (file) => void restore(file),
          onHelp: () => setDialog('help'),
          onInstall: install ? () => void install() : undefined,
        }}
        status={editor.status}
        error={editor.error}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={() => dispatch({ type: 'undo' })}
        onRedo={() => dispatch({ type: 'redo' })}
        onRetrySave={() => void save()}
        onExport={() => setDialog('export')}
        onShare={() => setDialog('share')}
        onSearch={() => setDialog('palette')}
        onHelp={() => setDialog('help')}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-line bg-bg lg:block" aria-label="Photo tools">
          <ToolPanel
            order={order}
            images={images}
            postingMode={view === 'posting'}
            posts={posts}
            filter={filter}
            nextId={nextId}
            conflicts={conflicts}
            showHint={showHint}
            onDismissHint={dismissHint}
            onFiles={openUpload}
            onSplit={() => setDialog('split')}
            onTogglePostingMode={() => setView((v) => (v === 'posting' ? 'grid' : 'posting'))}
            onSelect={(id) => setSelectedIds([id])}
            onReset={() => void resetGrid()}
          />
        </aside>

        <main id="main" className="min-w-0 flex-1 overflow-y-auto pb-36 lg:pb-12" onClick={(e) => e.target === e.currentTarget && clearSelection()}>
          <div className={`mx-auto w-full px-3 pt-4 sm:px-5 sm:pt-6 ${view === 'calendar' ? 'max-w-[760px]' : view === 'today' ? 'max-w-[600px]' : 'max-w-[540px]'}`}>
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2" data-tour="views">
              <SegmentedToggle<View>
                label="View"
                value={view}
                options={[
                  ['today', 'Today'],
                  ['grid', 'Grid'],
                  ['posting', 'Order'],
                  ['colors', 'Colours'],
                  ['calendar', 'Calendar'],
                ]}
                onChange={setView}
              />
              {view !== 'calendar' && view !== 'today' && (
                <SegmentedToggle<TileAspect>
                  label="Tile shape"
                  value={project.aspect}
                  options={[
                    ['portrait', '3:4'],
                    ['square', '1:1'],
                  ]}
                  onChange={(aspect) => dispatch({ type: 'setAspect', aspect })}
                />
              )}
            </div>

            <div className={`-mx-3 mb-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 ${view === 'today' ? 'hidden' : ''}`} role="toolbar" aria-label="Grid tools">
              <ToolbarButton
                icon={<CheckSquare className="size-3.5" aria-hidden />}
                label={selectMode ? 'Done selecting' : 'Select'}
                pressed={selectMode}
                onClick={() => {
                  setSelectMode((v) => !v)
                  if (selectMode) setSelectedIds([])
                }}
                disabled={order.length === 0}
              />
              {view !== 'calendar' && <ToolbarButton icon={<Smartphone className="size-3.5" aria-hidden />} label="Phone" pressed={phoneFrame} onClick={togglePhone} />}
              <ToolbarButton
                icon={<SlidersHorizontal className="size-3.5" aria-hidden />}
                label={isNeutralFilter(filter) ? 'Feed look' : 'Feed look · on'}
                onClick={() => setDialog('look')}
                disabled={order.length === 0}
              />
              <ToolbarButton
                icon={<Bookmark className="size-3.5" aria-hidden />}
                label={project.snapshots.length ? `Versions · ${project.snapshots.length}` : 'Versions'}
                onClick={() => setDialog('versions')}
              />
              <ToolbarButton icon={<Scissors className="size-3.5" aria-hidden />} label="Split photo" onClick={() => setDialog('split')} />
            </div>

            {selectMode && (
              <p className="animate-fade-up mb-3 rounded-xl bg-subtle px-3.5 py-2.5 text-xs text-muted" role="note">
                Tap photos to select several at once. {selection.length > 0 && <span className="font-medium text-fg">{selection.length} selected.</span>}
              </p>
            )}

            {view === 'posting' && (
              <div className="animate-fade-up mb-3 flex gap-2.5 rounded-xl border border-accent/30 bg-accent-soft/60 px-3.5 py-3 text-sm" role="note">
                <ListOrdered className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <p className="leading-relaxed">
                  <span className="font-medium">Publish in number order, starting with 1.</span>{' '}
                  <span className="text-muted">
                    Instagram puts each new post top-left, so photo {order.length || 1} — your top-left tile — goes up last.
                    {order.length > 0 && ` ${postedCount} of ${order.length} posted${nextId ? `; next up is post ${order.length - order.indexOf(nextId)}.` : ' — all done!'}`}
                  </span>
                </p>
              </div>
            )}

            {view === 'colors' && order.length > 0 && (
              <ColorSummary palette={palette} similarPairs={similarPairs.length} analysed={order.filter((id) => colors.has(id)).length} total={order.length} />
            )}

            {view === 'today' ? (
              <div className="pt-2">
                <TodayView
                  project={project}
                  images={images}
                  agenda={agenda}
                  today={today}
                  hasPhotos={order.length > 0}
                  conflicts={conflicts.size}
                  checklistHidden={checklistHidden}
                  onHideChecklist={() => hideChecklist(true)}
                  onPostNow={startPostNow}
                  onOpenPost={openPost}
                  onAddPhotos={() => openUpload()}
                  onAutoSchedule={() => setDialog('schedule')}
                  onCalendar={downloadCalendar}
                  onEditProfile={editProfile}
                  onShowGrid={() => {
                    markArranged()
                    setView('grid')
                  }}
                />
              </div>
            ) : view === 'calendar' ? (
              order.length > 0 ? (
                <ScheduleView
                  order={order}
                  images={images}
                  posts={posts}
                  filter={filter}
                  conflicts={conflicts}
                  selectedIds={selectedSet}
                  onSelect={select}
                  onReschedule={(id, date) => updatePost(id, date ? { date } : { date: null, time: null })}
                  onAutoSchedule={() => setDialog('schedule')}
                />
              ) : (
                <EmptyGrid onAdd={() => openUpload()} onSplit={() => setDialog('split')} />
              )
            ) : (
              <div data-tour="grid">
                {phoneFrame ? (
                  <PhoneFrame username={project.profile.username} verified={project.profile.verified} avatarUrl={avatarUrl}>
                    {preview}
                  </PhoneFrame>
                ) : (
                  preview
                )}
              </div>
            )}

            {showHint && order.length > 0 && view !== 'calendar' && view !== 'today' && (
              <div className="mt-4 lg:hidden">
                <DragHint onDismiss={dismissHint} />
              </div>
            )}
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
              <Info className="size-3.5" aria-hidden /> Preview only — not connected to Instagram.
            </p>
          </div>
        </main>

        <aside ref={inspectorRef} className="hidden w-80 shrink-0 overflow-y-auto border-l border-line bg-bg p-5 xl:block" aria-label={multi ? 'Selected photos' : single ? 'Selected photo' : 'Profile details'}>
          {multi ? (
            <BulkPanel {...bulkActions} />
          ) : photoActions ? (
            <PhotoInspector key={single} {...photoActions} />
          ) : (
            <div>
              <h2 className="mb-1 text-sm font-semibold">Profile details</h2>
              <p className="mb-4 text-xs text-muted">Select a photo in the grid to plan its caption, date and crop.</p>
              {profileForm}
            </div>
          )}
        </aside>
      </div>

      {/* Mobile and tablet action bar */}
      <nav aria-label="Quick actions" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button type="button" className="btn btn-primary h-10 flex-1" onClick={() => openUpload()} data-tour="add">
            <ImagePlus className="size-4" aria-hidden /> Add photos
          </button>
          <button type="button" className="btn btn-secondary h-10" onClick={() => (nextId ? startPostNow(nextId) : setView('today'))} disabled={order.length === 0} aria-label="Post now">
            <Send className="size-4" aria-hidden /> <span className="hidden min-[400px]:inline">Post</span>
          </button>
          <button type="button" className="btn btn-secondary btn-icon h-10 w-10" onClick={() => setDialog('palette')} aria-label="Search actions, projects and posts" data-tour="search">
            <Search className="size-4" aria-hidden />
          </button>
          <button type="button" className="btn btn-secondary btn-icon h-10 w-10" onClick={() => setDialog('profile')} aria-label="Edit profile">
            <SquareUser className="size-4" aria-hidden />
          </button>
        </div>
      </nav>

      {!isWide && multi && <BulkBar {...bulkActions} />}
      {!isWide && photoActions && (
        <SelectionBar
          image={selectedImage}
          index={singleIndex}
          total={order.length}
          post={singlePost!}
          onMove={movePhoto}
          onRemove={photoActions.onRemove}
          onDeselect={clearSelection}
          onOpenDetails={() => setDialog('details')}
        />
      )}

      {dropActive && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-6 backdrop-blur-sm" aria-hidden>
          <div className="animate-pop flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-accent px-12 py-10 text-center">
            <ImagePlus className="size-8 text-accent" />
            <p className="text-lg font-semibold">Drop photos to add them</p>
            <p className="text-sm text-muted">JPG, PNG or WebP · you can review them first</p>
          </div>
        </div>
      )}

      <UploadDialog key={upload.session} open={upload.open} initialFiles={upload.files} hasPhotos={order.length > 0} emptySpots={order.filter((id) => project.slots[id] && !records.has(id)).length} onClose={() => setUpload((u) => ({ ...u, open: false, files: [] }))} onAdd={addPhotos} />
      <PostNowDialog
        target={postNowTarget}
        next={nextId && nextNumber ? { id: nextId, number: nextNumber } : null}
        after={afterPostNow}
        postedCount={postedCount}
        aspect={project.aspect}
        filter={filter}
        onMarkPosted={markPosted}
        onOpen={(id) => (postNowId === id ? undefined : getPost(posts, id).posted ? openPost(id) : setPostNowId(id))}
        onAddPhoto={addPhotoToSpot}
        onClose={() => setPostNowId(null)}
      />
      <CommandPalette open={dialog === 'palette'} commands={commands} posts={searchablePosts} filter={filter} onOpenPost={openPost} onClose={closeDialog} />
      <HelpDialog
        open={dialog === 'help'}
        onClose={closeDialog}
        onTour={() => {
          setDialog(null)
          setTourOpen(true)
        }}
        onChecklist={() => {
          setDialog(null)
          hideChecklist(false)
          setView('today')
        }}
      />
      <SnippetsDialog open={dialog === 'snippets'} onClose={closeDialog} />
      {tourOpen && <Tour steps={tourSteps} onClose={finishTour} />}
      <ShareDialog open={dialog === 'share'} project={project} thumbs={thumbs} theme={theme} onBeforeShare={save} onClose={closeDialog} />
      <ExportDialog open={dialog === 'export'} project={project} theme={theme} onClose={closeDialog} />
      <Dialog open={dialog === 'profile'} onClose={closeDialog} title="Profile details" description="Shown above your grid in the preview." size="sm">
        {profileForm}
      </Dialog>
      <Dialog open={dialog === 'details' && !!photoActions} onClose={closeDialog} title="Post details" description="Caption, schedule and crop for this photo." size="sm">
        {photoActions && <PhotoDetailsSheet {...photoActions} />}
      </Dialog>
      <CropDialog
        open={dialog === 'crop' && !!single}
        image={selectedImage}
        crop={singlePost?.crop ?? null}
        aspect={project.aspect}
        filter={filter}
        onClose={() => setDialog(isWide ? null : 'details')}
        onSave={(crop) => single && updatePost(single, { crop })}
      />
      <SplitDialog open={dialog === 'split'} aspect={project.aspect} photoCount={order.length} onClose={closeDialog} onSplit={splitPhoto} />
      <VersionsDialog
        open={dialog === 'versions'}
        order={order}
        snapshots={project.snapshots}
        images={images}
        posts={posts}
        filter={filter}
        onClose={closeDialog}
        onSave={saveVersion}
        onRestore={restoreVersion}
        onDelete={(id) => void deleteVersion(id)}
      />
      <LookDialog open={dialog === 'look'} filter={filter} sample={images.get(order[0])} onChange={setFilter} onClose={closeDialog} />
      <AutoScheduleDialog
        open={dialog === 'schedule'}
        order={order}
        posts={posts}
        onClose={closeDialog}
        onApply={(patches) => {
          dispatch({ type: 'updatePosts', patches })
          toast(`${pluralize(Object.keys(patches).length, 'post')} scheduled`)
        }}
      />
      <NameDialog
        open={dialog === 'rename'}
        title="Rename project"
        initialValue={project.name}
        submitLabel="Rename"
        onClose={closeDialog}
        onSubmit={(name) => {
          dispatch({ type: 'rename', name })
          setDialog(null)
          toast('Project renamed')
        }}
      />
      <NameDialog
        open={dialog === 'new'}
        title="New project"
        description="Start a fresh grid. Your current project is saved automatically."
        initialValue="Untitled grid"
        submitLabel="Create project"
        onClose={closeDialog}
        onSubmit={(name) => void createNew(name)}
      />
    </div>
  )
}
