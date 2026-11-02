// @vitest-environment node
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import type { StoredImage } from '../types'
import {
  createProject,
  deleteImages,
  deleteProject,
  duplicateProject,
  findOrphanIds,
  getImage,
  getProject,
  getProjectImages,
  listProjects,
  normalizeProject,
  putImages,
  resetDBConnection,
  saveProject,
} from './db'

function image(id: string, projectId: string): StoredImage {
  return {
    id,
    projectId,
    name: `${id}.jpg`,
    type: 'image/jpeg',
    size: 3,
    width: 10,
    height: 10,
    blob: new Blob(['abc'], { type: 'image/jpeg' }),
    thumb: new Blob(['t'], { type: 'image/webp' }),
    createdAt: 0,
  }
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  resetDBConnection()
})

describe('project persistence', () => {
  it('saves and reloads a project with its order and images', async () => {
    const project = { ...createProject('Launch'), order: ['i1', 'i2'] }
    await putImages([image('i1', project.id), image('i2', project.id)])
    await saveProject(project)

    const loaded = await getProject(project.id)
    expect(loaded?.name).toBe('Launch')
    expect(loaded?.order).toEqual(['i1', 'i2'])

    const images = await getProjectImages(project.id)
    expect(images.map((i) => i.id).sort()).toEqual(['i1', 'i2'])
    const blob = (await getImage('i1'))!.blob
    expect(await blob.text()).toBe('abc')
  })

  it('lists projects newest first', async () => {
    await saveProject({ ...createProject('Old'), updatedAt: 1 })
    await saveProject({ ...createProject('New'), updatedAt: 2 })
    expect((await listProjects()).map((p) => p.name)).toEqual(['New', 'Old'])
  })

  it('duplicates a project with independent image copies', async () => {
    const source = { ...createProject('Original'), order: ['a', 'b'] }
    source.profile.avatarId = 'av'
    await putImages([image('a', source.id), image('b', source.id), image('av', source.id)])
    await saveProject(source)

    const copy = await duplicateProject(source, 'Original copy')
    expect(copy.id).not.toBe(source.id)
    expect(copy.order).toHaveLength(2)
    expect(copy.order).not.toContain('a')
    expect(copy.profile.avatarId).not.toBe('av')

    const copyImages = await getProjectImages(copy.id)
    expect(copyImages).toHaveLength(3)
    expect(new Set(copyImages.map((i) => i.id))).toEqual(new Set([...copy.order, copy.profile.avatarId]))

    // Deleting the original leaves the copy intact.
    await deleteProject(source.id)
    expect(await getProject(source.id)).toBeUndefined()
    expect(await getProjectImages(source.id)).toHaveLength(0)
    expect(await getProjectImages(copy.id)).toHaveLength(3)
  })

  it('finds and removes orphaned images', async () => {
    const project = { ...createProject('P'), order: ['keep'] }
    project.profile.avatarId = 'avatar'
    const images = [image('keep', project.id), image('avatar', project.id), image('gone', project.id)]
    await putImages(images)
    const orphans = findOrphanIds(project, images)
    expect(orphans).toEqual(['gone'])
    await deleteImages(orphans)
    expect((await getProjectImages(project.id)).map((i) => i.id).sort()).toEqual(['avatar', 'keep'])
  })

  it('normalizes damaged records instead of crashing', () => {
    const p = normalizeProject({ id: 'x', order: ['a', 3 as unknown as string], aspect: 'weird' as never })
    expect(p.name).toBe('Untitled grid')
    expect(p.order).toEqual(['a'])
    expect(p.aspect).toBe('portrait')
    expect(p.profile.avatarId).toBeNull()
  })
})
