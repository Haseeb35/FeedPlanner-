import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { FeedFilter, PostDetails, ProfileInfo, Project, SaveStatus, Slot, TileAspect } from '../types'
import { emptyHistory, record, redo, undo, type History } from '../lib/grid'
import { saveProject, toStorageError } from '../lib/db'
import { getPost } from '../lib/posts'

export interface EditorState {
  project: Project
  history: History
  /** Increments on every change; compared with savedRev to know whether there is unsaved work. */
  rev: number
  savedRev: number
}

export type EditorAction =
  | { type: 'setOrder'; order: string[] }
  /** Derives the next order from the latest state, so async work never applies a stale order. */
  | { type: 'updateOrder'; update: (order: string[]) => string[] }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'updateProfile'; patch: Partial<ProfileInfo> }
  | { type: 'rename'; name: string }
  | { type: 'setAspect'; aspect: TileAspect }
  /** Merges planning details into one or more posts. */
  | { type: 'updatePosts'; patches: Record<string, Partial<PostDetails>> }
  /** Swaps photos (or empty spots) for new ones, keeping caption, date and type. One undo step. */
  | { type: 'replacePhotos'; pairs: [oldId: string, newId: string][] }
  | { type: 'updateSlot'; id: string; patch: Partial<Slot> }
  | { type: 'setFilter'; filter: FeedFilter }
  | { type: 'saveSnapshot'; id: string; name: string; createdAt: number }
  | { type: 'deleteSnapshot'; id: string }
  | { type: 'restoreSnapshot'; id: string }
  | { type: 'saved'; rev: number }

function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const change = (project: Project, history = state.history): EditorState => ({
    ...state,
    project,
    history,
    rev: state.rev + 1,
  })
  switch (action.type) {
    case 'setOrder':
      if (sameOrder(action.order, state.project.order)) return state
      return change({ ...state.project, order: action.order }, record(state.history, state.project.order))
    case 'updateOrder':
      return editorReducer(state, { type: 'setOrder', order: action.update(state.project.order) })
    case 'undo': {
      const result = undo(state.history, state.project.order)
      return result ? change({ ...state.project, order: result.present }, result.history) : state
    }
    case 'redo': {
      const result = redo(state.history, state.project.order)
      return result ? change({ ...state.project, order: result.present }, result.history) : state
    }
    case 'updateProfile':
      return change({ ...state.project, profile: { ...state.project.profile, ...action.patch } })
    case 'rename': {
      const name = action.name.trim()
      if (!name || name === state.project.name) return state
      return change({ ...state.project, name })
    }
    case 'setAspect':
      if (action.aspect === state.project.aspect) return state
      return change({ ...state.project, aspect: action.aspect })
    case 'updatePosts': {
      const entries = Object.entries(action.patches)
      if (entries.length === 0) return state
      const posts = { ...state.project.posts }
      for (const [id, patch] of entries) posts[id] = { ...getPost(posts, id), ...patch }
      return change({ ...state.project, posts })
    }
    case 'replacePhotos': {
      const swaps = new Map(action.pairs.filter(([oldId]) => state.project.order.includes(oldId)))
      if (swaps.size === 0) return state
      const order = state.project.order.map((id) => swaps.get(id) ?? id)
      const posts = { ...state.project.posts }
      // The new photo has a different framing, so its crop starts fresh.
      for (const [oldId, newId] of swaps) posts[newId] = { ...getPost(state.project.posts, oldId), crop: null }
      return change({ ...state.project, order, posts }, record(state.history, state.project.order))
    }
    case 'updateSlot': {
      const slot = state.project.slots[action.id]
      if (!slot) return state
      return change({ ...state.project, slots: { ...state.project.slots, [action.id]: { ...slot, ...action.patch } } })
    }
    case 'setFilter':
      return change({ ...state.project, filter: action.filter })
    case 'saveSnapshot': {
      const snapshot = { id: action.id, name: action.name.trim() || 'Saved version', createdAt: action.createdAt, order: [...state.project.order] }
      return change({ ...state.project, snapshots: [snapshot, ...state.project.snapshots] })
    }
    case 'deleteSnapshot':
      return change({ ...state.project, snapshots: state.project.snapshots.filter((s) => s.id !== action.id) })
    case 'restoreSnapshot': {
      const snapshot = state.project.snapshots.find((s) => s.id === action.id)
      return snapshot ? editorReducer(state, { type: 'setOrder', order: [...snapshot.order] }) : state
    }
    case 'saved':
      return { ...state, savedRev: Math.max(state.savedRev, action.rev) }
  }
}

const AUTOSAVE_DELAY = 700

export function useProjectEditor(initial: Project, onSaved?: (project: Project) => void) {
  const [state, dispatch] = useReducer(editorReducer, initial, (project) => ({
    project,
    history: emptyHistory,
    rev: 0,
    savedRev: 0,
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(state)
  const inflight = useRef<Promise<void> | null>(null)
  const disabled = useRef(false)
  const onSavedRef = useRef(onSaved)

  useLayoutEffect(() => {
    latest.current = state
    onSavedRef.current = onSaved
  })

  const save = useCallback(async (): Promise<boolean> => {
    if (inflight.current) await inflight.current
    const { project, rev, savedRev } = latest.current
    if (disabled.current || rev === savedRev) return true
    const stamped = { ...project, updatedAt: Date.now() }
    setSaving(true)
    let ok = true
    const run = saveProject(stamped)
      .then(() => {
        dispatch({ type: 'saved', rev })
        setError(null)
        onSavedRef.current?.(stamped)
      })
      .catch((err: unknown) => {
        ok = false
        setError(toStorageError(err).message)
      })
      .finally(() => {
        setSaving(false)
        inflight.current = null
      })
    inflight.current = run
    await run
    return ok
  }, [])

  // Autosave shortly after the last change.
  useEffect(() => {
    if (state.rev === state.savedRev) return
    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY)
    return () => clearTimeout(timer)
  }, [state.rev, state.savedRev, save])

  // Save immediately when the tab is hidden, and warn before closing with unsaved work.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void save()
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const s = latest.current
      if (s.rev !== s.savedRev && !disabled.current) {
        void save()
        event.preventDefault()
      }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [save])

  // Last-chance save when the editor goes away (e.g. switching to a template or restored project).
  useEffect(
    () => () => {
      const s = latest.current
      if (s.rev !== s.savedRev && !disabled.current) saveProject({ ...s.project, updatedAt: Date.now() }).catch(() => undefined)
    },
    [],
  )

  /** Stops all further saves, e.g. right before the project is deleted. */
  const disableSaving = useCallback(() => {
    disabled.current = true
  }, [])

  const status: SaveStatus = error ? 'error' : saving ? 'saving' : state.rev !== state.savedRev ? 'unsaved' : 'saved'

  return {
    project: state.project,
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
    status,
    error,
    dispatch,
    save,
    disableSaving,
  }
}
