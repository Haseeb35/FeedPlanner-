import type { Highlight, Project, ProfileInfo, Slot, Snapshot, StoredImage, TileAspect } from '../types'
import { createId } from './id'
import { neutralFilter, normalizeFilter, normalizePost } from './posts'

/**
 * Local persistence. Project metadata and image blobs live in two IndexedDB object
 * stores. Images are stored as native Blobs (never base64) and indexed by project.
 */

const DB_NAME = 'feedplanner'
const DB_VERSION = 1
const PROJECTS = 'projects'
const IMAGES = 'images'

export class StorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageError'
  }
}

export function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error
  const name = error instanceof DOMException || error instanceof Error ? error.name : ''
  if (name === 'QuotaExceededError') {
    return new StorageError('Your browser is out of storage space for FeedPlanner. Remove some photos or projects and try again.')
  }
  if (name === 'SecurityError' || name === 'InvalidStateError') {
    return new StorageError('Browser storage is unavailable. Private browsing or strict privacy settings can block it.')
  }
  return new StorageError('Something went wrong while accessing browser storage. Please try again.')
}

let dbPromise: Promise<IDBDatabase> | null = null

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageError('This browser does not support local storage for projects.'))
      return
    }
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (error) {
      reject(toStorageError(error))
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(IMAGES)) {
        db.createObjectStore(IMAGES, { keyPath: 'id' }).createIndex('projectId', 'projectId')
      }
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    request.onerror = () => reject(toStorageError(request.error))
  }).catch((error) => {
    dbPromise = null
    throw error
  })
  return dbPromise
}

/** Test helper: forget the cached connection. */
export function resetDBConnection(): void {
  dbPromise = null
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Runs `work` inside a transaction and resolves once the transaction commits.
 * `work` must only await IndexedDB requests, otherwise the transaction auto-commits.
 */
async function transact<T>(
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  try {
    const db = await openDB()
    const tx = db.transaction(stores, mode)
    const committed = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    const result = await work(tx)
    await committed
    return result
  } catch (error) {
    throw toStorageError(error)
  }
}

export const defaultProfile: ProfileInfo = {
  username: 'your.username',
  displayName: 'Your Name',
  bio: 'Creator · Photographer\nPlanning my next posts with FeedPlanner',
  followers: '1,204',
  following: '318',
  avatarId: null,
  category: '',
  link: '',
  verified: false,
  highlights: [],
}

export function createProject(name: string, aspect: TileAspect = 'portrait'): Project {
  const now = Date.now()
  return {
    id: createId(),
    name: name.trim() || 'Untitled grid',
    createdAt: now,
    updatedAt: now,
    order: [],
    profile: { ...defaultProfile, highlights: [] },
    aspect,
    posts: {},
    filter: { ...neutralFilter },
    snapshots: [],
    slots: {},
    schema: 2,
  }
}

const str = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback)
const ids = (value: unknown) => (Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [])

/** Defends against partial or older records so a damaged entry never crashes the app. */
export function normalizeProject(raw: Partial<Project> & { id: string }): Project {
  const profile: Partial<ProfileInfo> = raw.profile ?? {}
  const order = [...new Set(ids(raw.order))]
  const posts: Project['posts'] = {}
  if (raw.posts && typeof raw.posts === 'object') {
    for (const [id, post] of Object.entries(raw.posts)) posts[id] = normalizePost(post)
  }
  const highlights: Highlight[] = Array.isArray(profile.highlights)
    ? profile.highlights
        .filter((h): h is Highlight => !!h && typeof h === 'object' && typeof h.id === 'string')
        .map((h) => ({ id: h.id, title: str(h.title, '').slice(0, 15), coverId: typeof h.coverId === 'string' ? h.coverId : null }))
    : []
  const snapshots: Snapshot[] = Array.isArray(raw.snapshots)
    ? raw.snapshots
        .filter((s): s is Snapshot => !!s && typeof s === 'object' && typeof s.id === 'string')
        .map((s) => ({ id: s.id, name: str(s.name, 'Saved version'), createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(), order: ids(s.order) }))
    : []
  const slots: Record<string, Slot> = {}
  if (raw.slots && typeof raw.slots === 'object') {
    for (const [id, slot] of Object.entries(raw.slots)) {
      if (!slot || typeof slot !== 'object') continue
      slots[id] = { note: str(slot.note, '').slice(0, 60), color: /^#[0-9a-f]{6}$/i.test(str(slot.color, '')) ? slot.color : '#d9d4cb' }
    }
  }
  return {
    id: raw.id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Untitled grid',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    order,
    profile: {
      username: str(profile.username, defaultProfile.username),
      displayName: str(profile.displayName, defaultProfile.displayName),
      bio: str(profile.bio, defaultProfile.bio),
      followers: str(profile.followers, defaultProfile.followers),
      following: str(profile.following, defaultProfile.following),
      avatarId: typeof profile.avatarId === 'string' ? profile.avatarId : null,
      category: str(profile.category, ''),
      link: str(profile.link, ''),
      verified: profile.verified === true,
      highlights,
    },
    aspect: raw.aspect === 'square' ? 'square' : 'portrait',
    posts,
    filter: normalizeFilter(raw.filter),
    snapshots,
    slots,
    schema: 2,
  }
}

export async function listProjects(): Promise<Project[]> {
  const raw = await transact([PROJECTS], 'readonly', (tx) =>
    promisify(tx.objectStore(PROJECTS).getAll() as IDBRequest<Project[]>),
  )
  return raw.map(normalizeProject).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getProject(id: string): Promise<Project | undefined> {
  const raw = await transact([PROJECTS], 'readonly', (tx) =>
    promisify(tx.objectStore(PROJECTS).get(id) as IDBRequest<Project | undefined>),
  )
  return raw ? normalizeProject(raw) : undefined
}

export async function saveProject(project: Project): Promise<void> {
  await transact([PROJECTS], 'readwrite', (tx) => {
    tx.objectStore(PROJECTS).put(project)
  })
}

export async function deleteProject(id: string): Promise<void> {
  await transact([PROJECTS, IMAGES], 'readwrite', async (tx) => {
    tx.objectStore(PROJECTS).delete(id)
    const keys = await promisify(tx.objectStore(IMAGES).index('projectId').getAllKeys(id))
    const images = tx.objectStore(IMAGES)
    for (const key of keys) images.delete(key)
  })
}

export async function putImages(images: StoredImage[]): Promise<void> {
  if (images.length === 0) return
  await transact([IMAGES], 'readwrite', (tx) => {
    const store = tx.objectStore(IMAGES)
    for (const image of images) store.put(image)
  })
}

export async function getImage(id: string): Promise<StoredImage | undefined> {
  return transact([IMAGES], 'readonly', (tx) =>
    promisify(tx.objectStore(IMAGES).get(id) as IDBRequest<StoredImage | undefined>),
  )
}

export async function getProjectImages(projectId: string): Promise<StoredImage[]> {
  return transact([IMAGES], 'readonly', (tx) =>
    promisify(tx.objectStore(IMAGES).index('projectId').getAll(projectId) as IDBRequest<StoredImage[]>),
  )
}

export async function deleteImages(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await transact([IMAGES], 'readwrite', (tx) => {
    const store = tx.objectStore(IMAGES)
    for (const id of ids) store.delete(id)
  })
}

/** Every image id a project still points at: grid, avatar, highlight covers and saved versions. */
export function referencedImageIds(project: Project): Set<string> {
  const used = new Set(project.order)
  if (project.profile.avatarId) used.add(project.profile.avatarId)
  for (const h of project.profile.highlights) if (h.coverId) used.add(h.coverId)
  for (const snapshot of project.snapshots) for (const id of snapshot.order) used.add(id)
  return used
}

/** Ids of images that belong to the project but are no longer referenced by it. */
export function findOrphanIds(project: Project, images: Pick<StoredImage, 'id'>[]): string[] {
  const used = referencedImageIds(project)
  return images.filter((image) => !used.has(image.id)).map((image) => image.id)
}

/** Rewrites every image reference in a project through `idMap`, dropping references it doesn't contain. */
export function remapProject(source: Project, imageIdMap: ReadonlyMap<string, string>, overrides: Partial<Project>): Project {
  // Empty spots aren't images, so they get fresh ids of their own.
  const idMap = new Map(imageIdMap)
  for (const id of Object.keys(source.slots)) idMap.set(id, createId())
  const slots: Project['slots'] = {}
  for (const [id, slot] of Object.entries(source.slots)) slots[idMap.get(id)!] = { ...slot }
  const map = (list: string[]) => list.filter((id) => idMap.has(id)).map((id) => idMap.get(id)!)
  const one = (id: string | null) => (id ? (idMap.get(id) ?? null) : null)
  const posts: Project['posts'] = {}
  for (const [id, post] of Object.entries(source.posts)) if (idMap.has(id)) posts[idMap.get(id)!] = post
  return {
    ...source,
    ...overrides,
    order: map(source.order),
    posts,
    slots,
    profile: {
      ...source.profile,
      avatarId: one(source.profile.avatarId),
      highlights: source.profile.highlights.map((h) => ({ ...h, id: createId(), coverId: one(h.coverId) })),
    },
    snapshots: source.snapshots.map((s) => ({ ...s, id: createId(), order: map(s.order) })),
  }
}

/** Copies a project and all of its images under new ids. */
export async function duplicateProject(source: Project, name: string): Promise<Project> {
  const images = await getProjectImages(source.id)
  const now = Date.now()
  const id = createId()
  const idMap = new Map<string, string>()
  const copies = images.map((image) => {
    const newId = createId()
    idMap.set(image.id, newId)
    return { ...image, id: newId, projectId: id }
  })
  const copy = remapProject(source, idMap, { id, name, createdAt: now, updatedAt: now })
  await saveProjectWithImages(copy, copies)
  return copy
}

/** Writes a project and its images in one transaction, so a failure never leaves half a project. */
export async function saveProjectWithImages(project: Project, images: StoredImage[]): Promise<void> {
  await transact([PROJECTS, IMAGES], 'readwrite', (tx) => {
    tx.objectStore(PROJECTS).put(project)
    const store = tx.objectStore(IMAGES)
    for (const image of images) store.put(image)
  })
}

/** Asks the browser not to evict FeedPlanner's storage under pressure. Best effort. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
