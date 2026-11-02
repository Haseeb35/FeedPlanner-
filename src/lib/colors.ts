import { COLUMNS } from './grid'
import { loadDrawable } from './images'

/** Colour analysis for the "Colours" view: dominant colours per photo and neighbours that look too alike. */

export type RGB = [number, number, number]

export interface ColorInfo {
  average: RGB
  /** Up to three dominant colours, most common first. */
  palette: RGB[]
}

export const toHex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

function toLinear(c: number) {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export function rgbToLab([r, g, b]: RGB): [number, number, number] {
  const R = toLinear(r)
  const G = toLinear(g)
  const B = toLinear(b)
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/** Perceptual colour difference (CIE76). Below ~10 two colours read as nearly the same. */
export function deltaE(a: RGB, b: RGB): number {
  const [l1, a1, b1] = rgbToLab(a)
  const [l2, a2, b2] = rgbToLab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

/** Average and dominant colours of RGBA pixel data. Transparent pixels are ignored. */
export function analyzePixels(data: ArrayLike<number>): ColorInfo {
  const buckets = new Map<number, { count: number; sum: RGB }>()
  const total: RGB = [0, 0, 0]
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    total[0] += r
    total[1] += g
    total[2] += b
    n++
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
    const bucket = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] }
    bucket.count++
    bucket.sum[0] += r
    bucket.sum[1] += g
    bucket.sum[2] += b
    buckets.set(key, bucket)
  }
  if (n === 0) return { average: [0, 0, 0], palette: [] }
  const average: RGB = [total[0] / n, total[1] / n, total[2] / n]
  const palette: RGB[] = []
  const ranked = [...buckets.values()].sort((a, b) => b.count - a.count)
  for (const bucket of ranked) {
    const color: RGB = [bucket.sum[0] / bucket.count, bucket.sum[1] / bucket.count, bucket.sum[2] / bucket.count]
    if (palette.every((c) => deltaE(c, color) > 12)) palette.push(color)
    if (palette.length === 3) break
  }
  return { average: average.map(Math.round) as RGB, palette: palette.map((c) => c.map(Math.round) as RGB) }
}

const SAMPLE = 32

export async function analyzeImage(blob: Blob): Promise<ColorInfo> {
  const img = await loadDrawable(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE
    canvas.height = SAMPLE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(img.source, 0, 0, SAMPLE, SAMPLE)
    return analyzePixels(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data)
  } finally {
    img.release()
  }
}

export const SIMILAR_THRESHOLD = 10

/** Pairs of side-by-side or stacked photos whose overall colours are nearly identical. */
export function similarNeighbors(order: string[], colors: ReadonlyMap<string, ColorInfo>, threshold = SIMILAR_THRESHOLD): [string, string][] {
  const pairs: [string, string][] = []
  const check = (a: string, b: string) => {
    const ca = colors.get(a)
    const cb = colors.get(b)
    if (ca && cb && deltaE(ca.average, cb.average) < threshold) pairs.push([a, b])
  }
  order.forEach((id, i) => {
    if (i % COLUMNS !== COLUMNS - 1 && i + 1 < order.length) check(id, order[i + 1])
    if (i + COLUMNS < order.length) check(id, order[i + COLUMNS])
  })
  return pairs
}

/** The feed's overall palette: dominant colours across every photo, weighted by rank. */
export function feedPalette(infos: ColorInfo[], size = 6): RGB[] {
  const weighted: { color: RGB; weight: number }[] = []
  for (const info of infos) {
    info.palette.forEach((color, rank) => {
      const weight = 3 - rank
      const match = weighted.find((w) => deltaE(w.color, color) < 14)
      if (match) {
        const total = match.weight + weight
        match.color = match.color.map((v, i) => (v * match.weight + color[i] * weight) / total) as RGB
        match.weight = total
      } else {
        weighted.push({ color, weight })
      }
    })
  }
  return weighted
    .sort((a, b) => b.weight - a.weight)
    .slice(0, size)
    .map((w) => w.color.map(Math.round) as RGB)
}
