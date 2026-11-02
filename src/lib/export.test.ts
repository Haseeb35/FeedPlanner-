import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeGridLayout, defaultExportOptions, exportFileName, renderExport, selectExportIds, MAX_CANVAS_SIDE } from './export'
import { coverCrop } from './images'
import { createProject } from './db'

const sources = new WeakMap<Blob, string>()

vi.mock('./images', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./images')>()
  return {
    ...actual,
    loadDrawable: vi.fn(async (blob: Blob) => ({ source: { id: sources.get(blob) }, width: 1000, height: 2000, release: () => undefined })),
    encodeCanvas: vi.fn(async (canvas: HTMLCanvasElement, type: string) => new Blob([`${canvas.width}x${canvas.height}`], { type })),
  }
})

describe('layout math', () => {
  it('fills the full width with three equal columns and gaps', () => {
    const { rects, height } = computeGridLayout(6, 1080, 3, 'square')
    expect(rects).toHaveLength(6)
    expect(rects[0]).toMatchObject({ x: 0, y: 0 })
    expect(rects[2].x + rects[2].w).toBe(1080)
    expect(rects[1].x - (rects[0].x + rects[0].w)).toBe(3)
    expect(rects[3].y).toBe(rects[0].h + 3)
    expect(height).toBe(rects[0].h * 2 + 3)
  })

  it('uses 3:4 tiles for the portrait grid', () => {
    const { rects } = computeGridLayout(1, 1080, 0, 'portrait')
    expect(rects[0]).toEqual({ x: 0, y: 0, w: 360, h: 480 })
  })

  it('handles an empty grid', () => {
    expect(computeGridLayout(0, 1080, 2, 'square')).toEqual({ rects: [], height: 0 })
  })

  it('crops to cover like object-fit: cover', () => {
    expect(coverCrop(2000, 1000, 100, 100)).toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000 })
    expect(coverCrop(900, 1600, 300, 400)).toEqual({ sx: 0, sy: 200, sw: 900, sh: 1200 })
  })

  it('selects rows and builds safe file names', () => {
    const order = ['1', '2', '3', '4', '5', '6', '7']
    expect(selectExportIds(order, null)).toEqual(order)
    expect(selectExportIds(order, 2)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(exportFileName('Summer / Launch!!', 'grid', 'png')).toBe('summer-launch-grid.png')
    expect(exportFileName('   ', 'profile', 'jpeg')).toBe('feedplanner-profile.jpg')
  })
})

describe('renderExport', () => {
  let draws: { id: string | undefined; dx: number; dy: number; dw: number; dh: number }[]

  beforeEach(() => {
    draws = []
    const ctx = new Proxy(
      {
        drawImage: (source: { id?: string }, ...args: number[]) => {
          const [, , , , dx, dy, dw, dh] = args
          draws.push({ id: source.id, dx, dy, dw, dh })
        },
        measureText: (text: string) => ({ width: text.length * 7 }),
      } as Record<string, unknown>,
      { get: (target, key: string) => (key in target ? target[key] : () => undefined), set: () => true },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as unknown as CanvasRenderingContext2D)
  })

  afterEach(() => vi.restoreAllMocks())

  function setup(order: string[]) {
    const project = { ...createProject('Test'), order, aspect: 'square' as const }
    const blobs = new Map(
      order.map((id) => {
        const blob = new Blob([id])
        sources.set(blob, id)
        return [id, blob]
      }),
    )
    return { project, loadBlob: async (id: string) => blobs.get(id) }
  }

  it('draws every photo into the tile matching its grid position', async () => {
    const input = setup(['a', 'b', 'c', 'd'])
    const result = await renderExport(input, { ...defaultExportOptions, gaps: false })
    expect(result.width).toBe(1080)
    expect(result.height).toBe(720)
    expect(result.missing).toBe(0)
    expect(draws.map((d) => [d.id, d.dx, d.dy])).toEqual([
      ['a', 0, 0],
      ['b', 360, 0],
      ['c', 720, 0],
      ['d', 0, 360],
    ])
  })

  it('reports missing photos and still produces an image', async () => {
    const input = setup(['a', 'b'])
    const result = await renderExport({ ...input, loadBlob: async (id) => (id === 'a' ? input.loadBlob(id) : undefined) }, defaultExportOptions)
    expect(result.missing).toBe(1)
    expect(draws.map((d) => d.id)).toEqual(['a'])
  })

  it('offsets the grid below the header in profile mode', async () => {
    const input = setup(['a'])
    const result = await renderExport(input, { ...defaultExportOptions, mode: 'profile', gaps: false })
    expect(draws[0].id).toBe('a')
    expect(draws[0].dy).toBeGreaterThan(0)
    expect(result.height).toBe(Math.round(draws[0].dy + 360))
  })

  it('scales down very tall exports to stay within canvas limits', async () => {
    const input = setup(Array.from({ length: 150 }, (_, i) => String(i)))
    const result = await renderExport(input, { ...defaultExportOptions, width: 2160 })
    expect(result.height).toBeLessThanOrEqual(MAX_CANVAS_SIDE)
    expect(result.width).toBeLessThan(2160)
  })

  it('refuses to export an empty grid', async () => {
    await expect(renderExport(setup([]), defaultExportOptions)).rejects.toThrow(/at least one photo/)
  })
})
