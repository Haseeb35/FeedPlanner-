import { useEffect, useRef, useState } from 'react'
import { analyzeImage, type ColorInfo } from '../lib/colors'
import { nextFrame } from '../lib/images'

/**
 * Analyses thumbnails lazily, only while `enabled`, and caches results for the session.
 * Thumbnails are small, so analysis is quick; it still yields between photos to stay smooth.
 */
export function useColorAnalysis(thumbs: ReadonlyMap<string, Blob>, ids: string[], enabled: boolean): ReadonlyMap<string, ColorInfo> {
  const [colors, setColors] = useState<ReadonlyMap<string, ColorInfo>>(() => new Map())
  const failed = useRef(new Set<string>())

  useEffect(() => {
    if (!enabled) return
    const pending = ids.filter((id) => !colors.has(id) && !failed.current.has(id) && thumbs.has(id))
    if (pending.length === 0) return
    let cancelled = false
    void (async () => {
      const found = new Map<string, ColorInfo>()
      for (const id of pending) {
        if (cancelled) return
        try {
          found.set(id, await analyzeImage(thumbs.get(id)!))
        } catch {
          failed.current.add(id)
        }
        await nextFrame()
      }
      if (!cancelled) setColors((current) => new Map([...current, ...found]))
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, ids, thumbs, colors])

  return colors
}
