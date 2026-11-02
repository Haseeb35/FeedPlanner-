import { describe, expect, it } from 'vitest'
import type { PostDetails } from '../types'
import { addDays, autoSchedule, countHashtags, emptyPost, nextToPost, normalizeFilter, scheduleConflicts } from './posts'
import { coverCrop } from './images'
import { splitRects } from './split'
import { analyzePixels, deltaE, feedPalette, similarNeighbors, type ColorInfo } from './colors'

const post = (patch: Partial<PostDetails>): PostDetails => ({ ...emptyPost, ...patch })

describe('captions', () => {
  it('counts hashtags, ignoring # inside words', () => {
    expect(countHashtags('Hello #summer #sea_side and #2026! not#this')).toBe(3)
    expect(countHashtags('#café #日本')).toBe(2)
    expect(countHashtags('')).toBe(0)
  })
})

describe('scheduling', () => {
  // Grid order: index 0 is top-left (posted last). Posting order is c, b, a.
  const order = ['a', 'b', 'c']

  it('assigns dates in posting order, skipping posted photos', () => {
    const posts = { c: post({ posted: true }) }
    const patches = autoSchedule(order, posts, { start: '2026-01-30', everyDays: 2, time: '18:00', overwrite: true })
    expect(patches).toEqual({ b: { date: '2026-01-30', time: '18:00' }, a: { date: '2026-02-01', time: '18:00' } })
  })

  it('keeps existing dates when not overwriting', () => {
    const posts = { b: post({ date: '2026-05-05' }) }
    const patches = autoSchedule(order, posts, { start: '2026-01-01', everyDays: 1, time: null, overwrite: false })
    expect(Object.keys(patches).sort()).toEqual(['a', 'c'])
  })

  it('flags posts scheduled out of posting order', () => {
    expect(scheduleConflicts(order, { a: post({ date: '2026-01-03' }), b: post({ date: '2026-01-02' }), c: post({ date: '2026-01-01' }) }).size).toBe(0)
    const conflicts = scheduleConflicts(order, { a: post({ date: '2026-01-01' }), c: post({ date: '2026-01-05' }) })
    expect([...conflicts].sort()).toEqual(['a', 'c'])
    // Times on the same day count too.
    expect(scheduleConflicts(order, { b: post({ date: '2026-01-01', time: '09:00' }), c: post({ date: '2026-01-01', time: '18:00' }) }).size).toBe(2)
  })

  it('finds the next photo to post', () => {
    expect(nextToPost(order, {})).toBe('c')
    expect(nextToPost(order, { c: post({ posted: true }) })).toBe('b')
    expect(nextToPost(order, { a: post({ posted: true }), b: post({ posted: true }), c: post({ posted: true }) })).toBeNull()
  })

  it('adds days across month boundaries', () => {
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02')
  })

  it('clamps filter values', () => {
    expect(normalizeFilter({ brightness: 999, warmth: -500, saturation: 'x' })).toEqual({ brightness: 150, contrast: 100, saturation: 100, warmth: -100 })
  })
})

describe('crop and split math', () => {
  it('moves the crop window towards the focal point and zooms', () => {
    // 2000×1000 into a square: a 1000-wide window that can slide 1000px.
    expect(coverCrop(2000, 1000, 100, 100, { x: 0, y: 0.5, zoom: 1 })).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 1000 })
    expect(coverCrop(2000, 1000, 100, 100, { x: 1, y: 0.5, zoom: 1 })).toEqual({ sx: 1000, sy: 0, sw: 1000, sh: 1000 })
    expect(coverCrop(2000, 1000, 100, 100, { x: 0.5, y: 0.5, zoom: 2 })).toEqual({ sx: 750, sy: 250, sw: 500, sh: 500 })
  })

  it('splits a panorama into three side-by-side tiles', () => {
    const rects = splitRects(3000, 1000, 1, 'square')
    expect(rects).toHaveLength(3)
    expect(rects.map((r) => Math.round(r.sx))).toEqual([0, 1000, 2000])
    expect(rects.every((r) => Math.round(r.sw) === 1000 && Math.round(r.sh) === 1000)).toBe(true)
  })

  it('splits into a 3×3 block of portrait tiles in grid order', () => {
    const rects = splitRects(3000, 4000, 3, 'portrait')
    expect(rects).toHaveLength(9)
    expect(rects[3].sy).toBeGreaterThan(rects[0].sy)
    expect(rects[1].sx).toBeGreaterThan(rects[0].sx)
    expect(rects[0].sh / rects[0].sw).toBeCloseTo(4 / 3)
  })
})

describe('colours', () => {
  const solid = (r: number, g: number, b: number, n = 16) => Array.from({ length: n }, () => [r, g, b, 255]).flat()

  it('finds the average and dominant colours', () => {
    const info = analyzePixels([...solid(250, 10, 10, 30), ...solid(10, 10, 250, 10)])
    expect(info.palette).toHaveLength(2)
    expect(info.palette[0][0]).toBeGreaterThan(200)
    expect(info.average[0]).toBeGreaterThan(info.average[2])
  })

  it('flags neighbouring photos that look nearly the same', () => {
    const red: ColorInfo = { average: [200, 30, 30], palette: [[200, 30, 30]] }
    const red2: ColorInfo = { average: [202, 32, 31], palette: [[202, 32, 31]] }
    const blue: ColorInfo = { average: [30, 30, 200], palette: [[30, 30, 200]] }
    const colors = new Map([
      ['a', red],
      ['b', red2],
      ['c', blue],
      ['d', blue],
    ])
    // a|b are side by side, c and d are in different columns (c ends row 1, d starts row 2), a above d.
    expect(similarNeighbors(['a', 'b', 'c', 'd'], colors)).toEqual([['a', 'b']])
    expect(deltaE([0, 0, 0], [255, 255, 255])).toBeGreaterThan(90)
    expect(feedPalette([red, red2, blue])).toHaveLength(2)
  })
})
