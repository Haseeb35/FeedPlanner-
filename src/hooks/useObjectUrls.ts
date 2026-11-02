import { useEffect, useRef, useState } from 'react'

/**
 * Maintains object URLs for a map of blobs. URLs are created once per blob,
 * revoked when the blob leaves the map, and all revoked on unmount.
 */
export function useObjectUrls(blobs: ReadonlyMap<string, Blob>): ReadonlyMap<string, string> {
  const cache = useRef(new Map<string, { blob: Blob; url: string }>())
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(() => new Map())

  useEffect(() => {
    const entries = cache.current
    for (const [id, entry] of entries) {
      if (blobs.get(id) !== entry.blob) {
        URL.revokeObjectURL(entry.url)
        entries.delete(id)
      }
    }
    for (const [id, blob] of blobs) {
      if (!entries.has(id)) entries.set(id, { blob, url: URL.createObjectURL(blob) })
    }
    // Syncing an external resource (object URLs) into state is the purpose of this effect.
    setUrls(new Map([...entries].map(([id, entry]) => [id, entry.url])))
  }, [blobs])

  useEffect(() => {
    const entries = cache.current
    return () => {
      for (const entry of entries.values()) URL.revokeObjectURL(entry.url)
      entries.clear()
    }
  }, [])

  return urls
}
