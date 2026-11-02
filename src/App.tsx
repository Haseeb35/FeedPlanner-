import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import type { Project, StoredImage } from './types'
import {
  createProject,
  deleteImages,
  findOrphanIds,
  getProject,
  getProjectImages,
  listProjects,
  putImages,
  referencedImageIds,
  requestPersistentStorage,
  saveProject,
  toStorageError,
} from './lib/db'
import { restoreBackup } from './lib/backup'
import { decodeTemplate, projectFromTemplate, templateFromHash, type FeedTemplate } from './lib/templates'
import { TemplateDialog, type TemplateDialogState } from './components/TemplateDialog'
import { addDays, autoSchedule, toISODate } from './lib/posts'
import { pluralize } from './lib/format'
import { createId } from './lib/id'
import { DEMO_SPECS, generateDemoImage } from './lib/demo'
import { processImage } from './lib/images'
import { useToast } from './providers/contexts'
import { WelcomeScreen } from './components/WelcomeScreen'
import { Workspace } from './components/Workspace'
import { Logo } from './components/Logo'

const LAST_PROJECT_KEY = 'fp-last-project'

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'welcome' }
  | { kind: 'workspace'; project: Project; images: StoredImage[]; openUpload: boolean; session: number }

function rememberProject(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_PROJECT_KEY, id)
    else localStorage.removeItem(LAST_PROJECT_KEY)
  } catch {
    // Not critical: we'll fall back to the most recent project.
  }
}

function lastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY)
  } catch {
    return null
  }
}

let sessionCounter = 0

export default function App() {
  const toast = useToast()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [projects, setProjects] = useState<Project[]>([])
  const [welcomeBusy, setWelcomeBusy] = useState<'create' | 'demo' | null>(null)
  const [templateDialog, setTemplateDialog] = useState<TemplateDialogState>(null)
  const [templateBusy, setTemplateBusy] = useState(false)

  const openProject = useCallback(async (id: string, openUpload = false) => {
    const project = await getProject(id)
    if (!project) throw new Error('missing')
    let images = await getProjectImages(id)
    // Clean up photos that were removed from the grid in an earlier session.
    const orphans = findOrphanIds(project, images)
    if (orphans.length) {
      images = images.filter((img) => !orphans.includes(img.id))
      deleteImages(orphans).catch(() => undefined)
    }
    // Drop planning details of photos that are gone for good.
    const used = referencedImageIds(project)
    project.posts = Object.fromEntries(Object.entries(project.posts).filter(([postId]) => used.has(postId)))
    rememberProject(id)
    setPhase({ kind: 'workspace', project, images, openUpload, session: ++sessionCounter })
  }, [])

  const load = useCallback(async () => {
    setPhase({ kind: 'loading' })
    try {
      const list = await listProjects()
      setProjects(list)
      if (list.length === 0) {
        setPhase({ kind: 'welcome' })
        return
      }
      const preferred = list.find((p) => p.id === lastProjectId()) ?? list[0]
      await openProject(preferred.id)
    } catch (error) {
      setPhase({ kind: 'error', message: toStorageError(error).message })
    }
  }, [openProject])

  useEffect(() => {
    // Initial load from IndexedDB.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  // Feed ideas arrive as links like "…/#t=z…". The data never reaches the server: it's in the fragment.
  useEffect(() => {
    const check = () => {
      const encoded = templateFromHash(location.hash)
      if (!encoded) return
      history.replaceState(null, '', location.pathname + location.search)
      decodeTemplate(encoded)
        .then((template) => setTemplateDialog({ kind: 'shared', template }))
        .catch((error: unknown) => toast('Couldn’t open this feed idea', { tone: 'error', description: error instanceof Error ? error.message : undefined }))
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [toast])

  const refreshProjects = useCallback(async () => {
    try {
      setProjects(await listProjects())
    } catch {
      // Keep the existing list.
    }
  }, [])

  const handleOpen = async (id: string) => {
    try {
      await openProject(id)
    } catch {
      toast('Couldn’t open that project', { tone: 'error', description: 'It may have been deleted in another tab.' })
      await refreshProjects()
    }
  }

  const handleCreate = async (name: string) => {
    try {
      const project = createProject(name)
      await saveProject(project)
      void requestPersistentStorage()
      await refreshProjects()
      await openProject(project.id, true)
      toast('Project created')
    } catch (error) {
      toast('Couldn’t create project', { tone: 'error', description: toStorageError(error).message })
    }
  }

  const handleCreateFirst = async () => {
    setWelcomeBusy('create')
    await handleCreate('My first grid')
    setWelcomeBusy(null)
  }

  const handleDemo = async () => {
    setWelcomeBusy('demo')
    try {
      const project = createProject('Demo grid')
      const images: StoredImage[] = []
      for (let i = 0; i < DEMO_SPECS.length; i++) {
        const spec = DEMO_SPECS[i]
        const blob = await generateDemoImage(spec, i + 7)
        images.push(await processImage(blob, `${spec.name}.jpg`, project.id, 'image/jpeg'))
      }
      // Small covers for the story highlights, drawn from the same artwork.
      const covers: StoredImage[] = []
      for (const [i, spec] of [DEMO_SPECS[2], DEMO_SPECS[4], DEMO_SPECS[6]].entries()) {
        covers.push(await processImage(await generateDemoImage(spec, i + 40, 240, 240), `${spec.name} cover.jpg`, project.id, 'image/jpeg'))
      }
      project.order = images.map((img) => img.id)
      project.profile = {
        username: 'studio.terra',
        displayName: 'Terra Studio',
        bio: 'Ceramics, colour & quiet places\nNew collection every Friday · Lisbon',
        followers: '12.4K',
        following: '286',
        avatarId: null,
        category: 'Artist',
        link: 'terra.studio/shop',
        verified: true,
        highlights: [
          { id: createId(), title: 'Studio', coverId: covers[0].id },
          { id: createId(), title: 'Glazes', coverId: covers[1].id },
          { id: createId(), title: 'Shop', coverId: covers[2].id },
        ],
      }
      const captions = [
        'Golden hour on the dunes. The new sand-glaze collection drops Friday ✨ #ceramics #handmade #lisbon',
        'Quiet corners of the studio. #slowliving #ceramicstudio',
        'Coral rings — swipe for the full set. #pottery #glaze',
      ]
      project.order.forEach((id, i) => {
        project.posts[id] = {
          caption: captions[i % captions.length],
          date: null,
          time: null,
          type: i === 2 || i === 7 ? 'carousel' : i === 4 ? 'reel' : 'photo',
          posted: i >= project.order.length - 3,
          crop: null,
        }
      })
      // Schedule the rest from tomorrow, every two days, in posting order.
      const schedule = autoSchedule(project.order, project.posts, { start: addDays(toISODate(new Date()), 1), everyDays: 2, time: '18:00', overwrite: true })
      for (const [id, patch] of Object.entries(schedule)) project.posts[id] = { ...project.posts[id], ...patch }
      images.push(...covers)
      await putImages(images)
      await saveProject(project)
      await refreshProjects()
      await openProject(project.id)
      toast('Demo project ready', { description: 'Drag photos around to try it out.' })
    } catch (error) {
      toast('Couldn’t create the demo', { tone: 'error', description: error instanceof Error ? error.message : undefined })
    } finally {
      setWelcomeBusy(null)
    }
  }

  const handleUseTemplate = async (template: FeedTemplate) => {
    setTemplateBusy(true)
    try {
      const project = projectFromTemplate(template)
      await saveProject(project)
      void requestPersistentStorage()
      await refreshProjects()
      await openProject(project.id)
      setTemplateDialog(null)
      toast(`“${project.name}” is ready`, { description: 'Add photos to fill the empty spots, or select a spot to add one photo.' })
    } catch (error) {
      toast('Couldn’t create the project', { tone: 'error', description: toStorageError(error).message })
    } finally {
      setTemplateBusy(false)
    }
  }

  const handleRestore = async (file: File) => {
    try {
      const restored = await restoreBackup(file)
      await refreshProjects()
      await openProject(restored[0].id)
      toast(restored.length === 1 ? `Restored “${restored[0].name}”` : `${pluralize(restored.length, 'project')} restored`, {
        description: 'Restored projects are added alongside your existing ones.',
      })
    } catch (error) {
      const message = error instanceof Error && error.name === 'BackupError' ? error.message : toStorageError(error).message
      toast('Couldn’t restore backup', { tone: 'error', description: message })
    }
  }

  const handleDeleted = async (id: string) => {
    const remaining = projects.filter((p) => p.id !== id)
    setProjects(remaining)
    rememberProject(null)
    if (remaining.length === 0) {
      setPhase({ kind: 'welcome' })
      return
    }
    await handleOpen(remaining[0].id)
  }

  const handleSaved = useCallback((saved: Project) => {
    setProjects((list) => [saved, ...list.filter((p) => p.id !== saved.id)].sort((a, b) => b.updatedAt - a.updatedAt))
  }, [])

  const templates = <TemplateDialog state={templateDialog} busy={templateBusy} onUse={(t) => void handleUseTemplate(t)} onClose={() => setTemplateDialog(null)} />

  if (phase.kind === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4" role="status">
        <Logo />
        <LoaderCircle className="size-5 animate-spin text-muted" aria-hidden />
        <span className="sr-only">Loading your projects…</span>
      </div>
    )
  }

  if (phase.kind === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <CircleAlert className="mx-auto size-8 text-danger" aria-hidden />
          <h1 className="mt-4 text-lg font-semibold">FeedPlanner can’t open your projects</h1>
          <p className="mt-2 text-sm text-muted">{phase.message}</p>
          <button type="button" className="btn btn-primary mt-6" onClick={() => void load()}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (phase.kind === 'welcome') {
    return (
      <>
        <WelcomeScreen
          busy={welcomeBusy}
          onCreate={() => void handleCreateFirst()}
          onDemo={() => void handleDemo()}
          onRestore={(file) => void handleRestore(file)}
          onTemplates={() => setTemplateDialog({ kind: 'gallery' })}
        />
        {templates}
      </>
    )
  }

  return (
    <>
      <Workspace
        key={phase.session}
        initialProject={phase.project}
        initialImages={phase.images}
        openUploadOnStart={phase.openUpload}
        projects={projects}
        onOpenProject={handleOpen}
        onCreateProject={handleCreate}
        onProjectDeleted={handleDeleted}
        onProjectSaved={handleSaved}
        onRestoreBackup={handleRestore}
        onOpenTemplates={() => setTemplateDialog({ kind: 'gallery' })}
      />
      {templates}
    </>
  )
}
