// @vitest-environment node
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import type { StoredImage } from '../types'
import { BackupError, buildBackup, readBackup, restoreBackup, backupFileName } from './backup'
import { createProject, getProjectImages, listProjects, normalizeProject, resetDBConnection, saveProject, putImages, findOrphanIds, referencedImageIds } from './db'

function image(id: string, projectId: string, body = id): StoredImage {
  return {
    id,
    projectId,
    name: `${id}.jpg`,
    type: 'image/jpeg',
    size: body.length,
    width: 30,
    height: 40,
    blob: new Blob([body], { type: 'image/jpeg' }),
    thumb: new Blob([`thumb-${body}`], { type: 'image/webp' }),
    createdAt: 1,
  }
}

function sampleProject() {
  const project = createProject('Summer plan')
  project.order = ['a', 'b']
  project.posts = { a: { caption: 'Hello #summer', date: '2026-06-01', time: '18:00', type: 'carousel', posted: false, crop: { x: 0.2, y: 0.5, zoom: 1.5 } } }
  project.profile.avatarId = 'avatar'
  project.profile.highlights = [{ id: 'h1', title: 'Trips', coverId: 'cover' }]
  project.snapshots = [{ id: 's1', name: 'Option A', createdAt: 5, order: ['b', 'a', 'old'] }]
  const images = ['a', 'b', 'avatar', 'cover', 'old', 'orphan'].map((id) => image(id, project.id))
  return { project, images }
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  resetDBConnection()
})

describe('backup files', () => {
  it('round-trips projects and photo bytes, leaving out unused photos', async () => {
    const { project, images } = sampleProject()
    const file = buildBackup([project], new Map([[project.id, images]]), 42)
    const contents = await readBackup(file)
    expect(contents.createdAt).toBe(42)
    expect(contents.projects).toHaveLength(1)
    expect(contents.projects[0].posts.a.caption).toBe('Hello #summer')
    expect(contents.images.map((i) => i.id).sort()).toEqual(['a', 'avatar', 'b', 'cover', 'old'])
    const a = contents.images.find((i) => i.id === 'a')!
    expect(await a.blob.text()).toBe('a')
    expect(await a.thumb.text()).toBe('thumb-a')
    expect(a.blob.type).toBe('image/jpeg')
  })

  it('rejects files that are not backups, or are damaged', async () => {
    await expect(readBackup(new Blob(['hello world, not a backup']))).rejects.toBeInstanceOf(BackupError)
    const { project, images } = sampleProject()
    const file = buildBackup([project], new Map([[project.id, images]]))
    // Cut off the photo data: offsets now point past the end.
    await expect(readBackup(file.slice(0, file.size - 5))).rejects.toThrow(/damaged/)
  })

  it('restores as new projects without touching existing ones', async () => {
    const { project, images } = sampleProject()
    await saveProject(project)
    await putImages(images)
    const file = buildBackup([project], new Map([[project.id, images]]))

    const [restored] = await restoreBackup(file)
    expect(restored.id).not.toBe(project.id)
    expect(restored.name).toBe('Summer plan')
    expect(restored.order).toHaveLength(2)
    expect(restored.order).not.toContain('a')
    const newA = restored.order[0]
    expect(restored.posts[newA]).toMatchObject({ caption: 'Hello #summer', type: 'carousel', crop: { x: 0.2, y: 0.5, zoom: 1.5 } })
    expect(restored.profile.avatarId).not.toBe('avatar')
    expect(restored.profile.highlights[0].coverId).toBeTruthy()
    expect(restored.snapshots[0].order).toHaveLength(3)

    const stored = await getProjectImages(restored.id)
    expect(stored).toHaveLength(5)
    expect(findOrphanIds(restored, stored)).toEqual([])
    expect(await stored.find((i) => i.id === newA)!.blob.text()).toBe('a')
    expect(await listProjects()).toHaveLength(2)
  })

  it('names backup files after the project', () => {
    expect(backupFileName([{ name: 'Summer Plan!' }], new Date('2026-03-04T10:00:00Z'))).toBe('summer-plan-2026-03-04.feedplanner')
    expect(backupFileName([{ name: 'a' }, { name: 'b' }], new Date('2026-03-04T10:00:00Z'))).toBe('feedplanner-all-projects-2026-03-04.feedplanner')
  })
})

describe('project references', () => {
  it('counts highlight covers and saved versions as in use', () => {
    const { project } = sampleProject()
    expect([...referencedImageIds(project)].sort()).toEqual(['a', 'avatar', 'b', 'cover', 'old'])
  })

  it('upgrades schema 1 records with safe defaults', () => {
    const p = normalizeProject({ id: 'x', order: ['a', 'a', 'b'], posts: { a: { caption: 5, date: 'nope', type: 'reel', crop: { x: 9, y: 0.5, zoom: 1 } } } as never })
    expect(p.order).toEqual(['a', 'b'])
    expect(p.posts.a).toEqual({ caption: '', date: null, time: null, type: 'reel', posted: false, crop: { x: 1, y: 0.5, zoom: 1 } })
    expect(p.filter).toEqual({ brightness: 100, contrast: 100, saturation: 100, warmth: 0 })
    expect(p.snapshots).toEqual([])
    expect(p.profile.highlights).toEqual([])
    expect(p.profile.verified).toBe(false)
    expect(p.schema).toBe(2)
  })
})
