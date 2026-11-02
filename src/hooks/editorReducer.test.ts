import { describe, expect, it } from 'vitest'
import { editorReducer, type EditorState } from './useProjectEditor'
import { createProject } from '../lib/db'
import { emptyHistory } from '../lib/grid'

function initial(order: string[]): EditorState {
  return { project: { ...createProject('Test'), order }, history: emptyHistory, rev: 0, savedRev: 0 }
}

describe('editorReducer', () => {
  it('records order changes so they can be undone and redone', () => {
    let s = initial(['a', 'b', 'c'])
    s = editorReducer(s, { type: 'setOrder', order: ['b', 'a', 'c'] })
    s = editorReducer(s, { type: 'updateOrder', update: (o) => o.filter((id) => id !== 'c') })
    expect(s.project.order).toEqual(['b', 'a'])

    s = editorReducer(s, { type: 'undo' })
    expect(s.project.order).toEqual(['b', 'a', 'c'])
    s = editorReducer(s, { type: 'undo' })
    expect(s.project.order).toEqual(['a', 'b', 'c'])
    s = editorReducer(s, { type: 'redo' })
    expect(s.project.order).toEqual(['b', 'a', 'c'])
  })

  it('ignores no-op order changes', () => {
    const s = initial(['a', 'b'])
    expect(editorReducer(s, { type: 'setOrder', order: ['a', 'b'] })).toBe(s)
  })

  it('does not put profile edits in layout history but marks them unsaved', () => {
    let s = initial(['a'])
    s = editorReducer(s, { type: 'updateProfile', patch: { username: 'new.name' } })
    expect(s.project.profile.username).toBe('new.name')
    expect(s.history.past).toHaveLength(0)
    expect(s.rev).not.toBe(s.savedRev)
  })

  it('tracks saved state by revision', () => {
    let s = initial([])
    s = editorReducer(s, { type: 'rename', name: 'Spring launch' })
    const savedAt = s.rev
    s = editorReducer(s, { type: 'setAspect', aspect: 'square' })
    s = editorReducer(s, { type: 'saved', rev: savedAt })
    expect(s.savedRev).toBe(savedAt)
    expect(s.rev).toBeGreaterThan(s.savedRev) // the later change is still unsaved
    s = editorReducer(s, { type: 'saved', rev: s.rev })
    expect(s.rev).toBe(s.savedRev)
  })

  it('rejects empty project names', () => {
    const s = initial([])
    expect(editorReducer(s, { type: 'rename', name: '   ' })).toBe(s)
  })

  it('merges post details without touching layout history', () => {
    let s = initial(['a', 'b'])
    s = editorReducer(s, { type: 'updatePosts', patches: { a: { caption: 'Hi' }, b: { posted: true } } })
    s = editorReducer(s, { type: 'updatePosts', patches: { a: { type: 'reel' } } })
    expect(s.project.posts.a).toMatchObject({ caption: 'Hi', type: 'reel', posted: false })
    expect(s.project.posts.b.posted).toBe(true)
    expect(s.history.past).toHaveLength(0)
  })

  it('keeps details when a photo is replaced, but resets its crop', () => {
    let s = initial(['a', 'b'])
    s = editorReducer(s, { type: 'updatePosts', patches: { b: { caption: 'Keep me', crop: { x: 0, y: 0, zoom: 2 } } } })
    s = editorReducer(s, { type: 'replacePhotos', pairs: [['b', 'b2']] })
    expect(s.project.order).toEqual(['a', 'b2'])
    expect(s.project.posts.b2).toMatchObject({ caption: 'Keep me', crop: null })
    s = editorReducer(s, { type: 'undo' })
    expect(s.project.order).toEqual(['a', 'b'])
  })

  it('saves and restores versions, and restoring can be undone', () => {
    let s = initial(['a', 'b', 'c'])
    s = editorReducer(s, { type: 'saveSnapshot', id: 'v1', name: '  ', createdAt: 1 })
    expect(s.project.snapshots[0]).toMatchObject({ id: 'v1', name: 'Saved version', order: ['a', 'b', 'c'] })
    s = editorReducer(s, { type: 'setOrder', order: ['c', 'b', 'a'] })
    s = editorReducer(s, { type: 'restoreSnapshot', id: 'v1' })
    expect(s.project.order).toEqual(['a', 'b', 'c'])
    s = editorReducer(s, { type: 'undo' })
    expect(s.project.order).toEqual(['c', 'b', 'a'])
    s = editorReducer(s, { type: 'deleteSnapshot', id: 'v1' })
    expect(s.project.snapshots).toHaveLength(0)
  })
})
