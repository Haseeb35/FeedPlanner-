import type { Project, StoredImage } from '../types'
import { createId } from './id'
import { getProjectImages, normalizeProject, referencedImageIds, remapProject, saveProjectWithImages } from './db'
import { slugify } from './format'

/**
 * Backup files bundle projects and their photos into one download, so work can be moved
 * to another browser or kept safe if site data is cleared. Layout:
 *
 *   "FPBACKUP" (8 bytes) · manifest length (uint32, little-endian) · manifest JSON · raw image bytes
 *
 * Photos are stored as raw bytes rather than base64, so the file is no larger than the
 * photos themselves and restoring can slice blobs without reading everything into memory.
 */

const MAGIC = 'FPBACKUP'
const HEADER_SIZE = MAGIC.length + 4
const FORMAT = 'feedplanner-backup'
const VERSION = 1
export const BACKUP_EXTENSION = '.feedplanner'

export class BackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupError'
  }
}

interface BlobRef {
  offset: number
  size: number
  type: string
}

interface ImageEntry extends Omit<StoredImage, 'blob' | 'thumb'> {
  blob: BlobRef
  thumb: BlobRef
}

interface Manifest {
  format: typeof FORMAT
  version: number
  createdAt: number
  projects: Project[]
  images: ImageEntry[]
}

export interface BackupContents {
  createdAt: number
  projects: Project[]
  images: StoredImage[]
}

/** Builds a backup from projects and their images. Only photos the projects still use are included. */
export function buildBackup(projects: Project[], imagesByProject: ReadonlyMap<string, StoredImage[]>, createdAt = Date.now()): Blob {
  const parts: Blob[] = []
  const entries: ImageEntry[] = []
  let offset = 0
  const add = (blob: Blob): BlobRef => {
    const ref = { offset, size: blob.size, type: blob.type }
    parts.push(blob)
    offset += blob.size
    return ref
  }
  for (const project of projects) {
    const used = referencedImageIds(project)
    for (const image of imagesByProject.get(project.id) ?? []) {
      if (!used.has(image.id)) continue
      const { blob, thumb, ...meta } = image
      entries.push({ ...meta, blob: add(blob), thumb: add(thumb) })
    }
  }
  const manifest: Manifest = { format: FORMAT, version: VERSION, createdAt, projects, images: entries }
  const json = new TextEncoder().encode(JSON.stringify(manifest))
  const header = new Uint8Array(HEADER_SIZE)
  header.set(new TextEncoder().encode(MAGIC), 0)
  new DataView(header.buffer).setUint32(MAGIC.length, json.byteLength, true)
  return new Blob([header, json, ...parts], { type: 'application/octet-stream' })
}

export async function createBackup(projects: Project[]): Promise<Blob> {
  const images = new Map<string, StoredImage[]>()
  for (const project of projects) images.set(project.id, await getProjectImages(project.id))
  return buildBackup(projects, images)
}

const invalid = () => new BackupError('This file isn’t a FeedPlanner backup, or it’s damaged.')

function isRef(value: unknown, payloadSize: number): value is BlobRef {
  const ref = value as BlobRef
  return (
    !!ref &&
    Number.isInteger(ref.offset) &&
    Number.isInteger(ref.size) &&
    ref.offset >= 0 &&
    ref.size >= 0 &&
    ref.offset + ref.size <= payloadSize &&
    typeof ref.type === 'string'
  )
}

/** Reads and validates a backup file. Image blobs are lazy slices of the file. */
export async function readBackup(file: Blob): Promise<BackupContents> {
  if (file.size < HEADER_SIZE) throw invalid()
  const header = new Uint8Array(await file.slice(0, HEADER_SIZE).arrayBuffer())
  if (new TextDecoder().decode(header.subarray(0, MAGIC.length)) !== MAGIC) throw invalid()
  const length = new DataView(header.buffer).getUint32(MAGIC.length, true)
  if (HEADER_SIZE + length > file.size) throw invalid()

  let manifest: Manifest
  try {
    manifest = JSON.parse(await file.slice(HEADER_SIZE, HEADER_SIZE + length).text())
  } catch {
    throw invalid()
  }
  if (!manifest || manifest.format !== FORMAT || !Array.isArray(manifest.projects) || !Array.isArray(manifest.images)) throw invalid()
  if (typeof manifest.version !== 'number' || manifest.version > VERSION) {
    throw new BackupError('This backup was made by a newer version of FeedPlanner. Update the app and try again.')
  }

  const payloadStart = HEADER_SIZE + length
  const payloadSize = file.size - payloadStart
  const slice = (ref: BlobRef) => file.slice(payloadStart + ref.offset, payloadStart + ref.offset + ref.size, ref.type)

  const projects = manifest.projects
    .filter((p): p is Project => !!p && typeof p === 'object' && typeof (p as Project).id === 'string')
    .map((p) => normalizeProject(p))
  if (projects.length === 0) throw new BackupError('This backup doesn’t contain any projects.')

  const images: StoredImage[] = []
  for (const entry of manifest.images) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.projectId !== 'string') continue
    if (!isRef(entry.blob, payloadSize) || !isRef(entry.thumb, payloadSize)) throw invalid()
    images.push({
      id: entry.id,
      projectId: entry.projectId,
      name: typeof entry.name === 'string' ? entry.name : 'photo',
      type: typeof entry.type === 'string' ? entry.type : entry.blob.type,
      size: entry.blob.size,
      width: Number(entry.width) || 1,
      height: Number(entry.height) || 1,
      createdAt: Number(entry.createdAt) || Date.now(),
      blob: slice(entry.blob),
      thumb: slice(entry.thumb),
    })
  }
  return { createdAt: Number(manifest.createdAt) || Date.now(), projects, images }
}

/**
 * Imports every project in a backup as a new project. Fresh ids are used throughout, so
 * restoring never overwrites existing work, even when restoring the same file twice.
 */
export async function restoreBackup(file: Blob): Promise<Project[]> {
  const contents = await readBackup(file)
  const restored: Project[] = []
  const now = Date.now()
  for (const source of contents.projects) {
    const id = createId()
    const idMap = new Map<string, string>()
    const images = contents.images
      .filter((image) => image.projectId === source.id)
      .map((image) => {
        const newId = createId()
        idMap.set(image.id, newId)
        return { ...image, id: newId, projectId: id }
      })
    const project = remapProject(source, idMap, { id, createdAt: now, updatedAt: now })
    await saveProjectWithImages(project, images)
    restored.push(project)
  }
  return restored
}

export function backupFileName(projects: Pick<Project, 'name'>[], date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10)
  const base = projects.length === 1 ? slugify(projects[0].name) : 'feedplanner-all-projects'
  return `${base}-${stamp}${BACKUP_EXTENSION}`
}
