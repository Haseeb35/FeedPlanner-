/** Shape of the grid tiles. Instagram's profile grid currently crops to 3:4; 1:1 is the classic look. */
export type TileAspect = 'portrait' | 'square'

export interface Highlight {
  id: string
  title: string
  /** Image id of the cover, stored in the images store. */
  coverId: string | null
}

export interface ProfileInfo {
  username: string
  displayName: string
  bio: string
  followers: string
  following: string
  /** Image id of the avatar, stored in the images store like any other photo. */
  avatarId: string | null
  category: string
  link: string
  verified: boolean
  highlights: Highlight[]
}

export type PostType = 'photo' | 'carousel' | 'reel'

/** Which part of the photo shows in its tile. x/y are the focal point (0–1), zoom is ≥ 1. */
export interface Crop {
  x: number
  y: number
  zoom: number
}

/** Planning details for one post, keyed by image id. */
export interface PostDetails {
  caption: string
  /** Planned date as YYYY-MM-DD, or null when unscheduled. */
  date: string | null
  /** Planned time as HH:MM, or null. */
  time: string | null
  type: PostType
  posted: boolean
  crop: Crop | null
}

/** A uniform look applied to every photo. Values are percentages; warmth runs from -100 (cool) to 100 (warm). */
export interface FeedFilter {
  brightness: number
  contrast: number
  saturation: number
  warmth: number
}

/** An empty spot in the grid, waiting for a photo. Created by templates. */
export interface Slot {
  /** What should go here, e.g. "Quote or text" or "Light · warm tones". */
  note: string
  /** Hex colour hinting at the photo's tone. */
  color: string
}

/** A named copy of a grid arrangement that can be restored later. */
export interface Snapshot {
  id: string
  name: string
  createdAt: number
  order: string[]
}

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /** Image ids in grid order. Index 0 is the top-left tile, i.e. the newest post. */
  order: string[]
  profile: ProfileInfo
  aspect: TileAspect
  posts: Record<string, PostDetails>
  filter: FeedFilter
  snapshots: Snapshot[]
  /** Empty spots, keyed by their id in `order`. */
  slots: Record<string, Slot>
  schema: 2
}

/** An image as persisted in IndexedDB. Blobs are stored natively, never as base64. */
export interface StoredImage {
  id: string
  projectId: string
  name: string
  type: string
  size: number
  width: number
  height: number
  blob: Blob
  thumb: Blob
  createdAt: number
}

/** An image held in memory by the editor: metadata plus a thumbnail object URL. */
export interface LoadedImage {
  id: string
  name: string
  size: number
  width: number
  height: number
  thumbUrl: string
  /** Set when this is an empty spot rather than a photo. */
  slot?: Slot
}

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error'
