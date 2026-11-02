// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BUILT_IN_TEMPLATES, TemplateError, decodeTemplate, describeColor, encodeTemplate, normalizeTemplate, projectFromTemplate, templateFromHash, templateFromProject, templateLink } from './templates'
import { createProject, remapProject } from './db'
import type { ColorInfo } from './colors'

describe('template links', () => {
  it('round-trips a template through a compact link', async () => {
    const template = BUILT_IN_TEMPLATES.find((t) => t.name === 'Launch countdown')!
    const encoded = await encodeTemplate(template)
    expect(encoded).toMatch(/^z[A-Za-z0-9_-]+$/)
    const link = templateLink(encoded, 'https://example.com/')
    expect(link.length).toBeLessThan(1500)
    expect(templateFromHash(new URL(link).hash)).toBe(encoded)
    expect(await decodeTemplate(encoded)).toEqual(normalizeTemplate(template))
  })

  it('rejects damaged links with a readable error', async () => {
    await expect(decodeTemplate('zNOT-REAL')).rejects.toBeInstanceOf(TemplateError)
    await expect(decodeTemplate('q123')).rejects.toBeInstanceOf(TemplateError)
    expect(templateFromHash('#other=1')).toBeNull()
  })

  it('sanitizes untrusted template data', () => {
    const t = normalizeTemplate({ v: 1, name: '', aspect: 'x', tiles: [{ type: 'evil', color: 'red; background:url(x)', note: 5 }], cadence: { everyDays: 999, time: 'soon' } })
    expect(t.name).toBe('Shared feed idea')
    expect(t.tiles[0]).toEqual({ type: 'photo', color: '#d9d4cb', note: '' })
    expect(t.cadence).toEqual({ everyDays: 30, time: null })
    expect(() => normalizeTemplate({ v: 2, tiles: [] })).toThrow(TemplateError)
  })
})

describe('project ↔ template', () => {
  it('describes photos by colour and keeps types, captions and rhythm', () => {
    const project = { ...createProject('My feed'), order: ['a', 'b', 'c'] }
    project.posts = {
      a: { caption: 'Hi #there', date: '2026-01-05', time: '18:00', type: 'reel', posted: false, crop: null },
      b: { caption: '', date: '2026-01-03', time: '18:00', type: 'photo', posted: false, crop: null },
      c: { caption: '', date: '2026-01-01', time: '09:00', type: 'carousel', posted: true, crop: null },
    }
    const colors = new Map<string, ColorInfo>([['a', { average: [240, 220, 190], palette: [] }]])
    const t = templateFromProject(project, colors, { captions: true, schedule: true })
    expect(t.tiles[0]).toEqual({ type: 'reel', color: '#f0dcbe', note: 'Light · warm tones', caption: 'Hi #there' })
    expect(t.tiles[1]).toEqual({ type: 'photo', color: '#d9d4cb', note: 'Photo' })
    expect(t.cadence).toEqual({ everyDays: 2, time: '18:00' })
    expect(templateFromProject(project, colors, { captions: false, schedule: false }).tiles[0].caption).toBeUndefined()
  })

  it('creates a project of empty spots, scheduled in posting order', () => {
    const template = BUILT_IN_TEMPLATES.find((t) => t.name === 'Checkerboard')!
    const project = projectFromTemplate(template, new Date(2026, 0, 1))
    expect(project.order).toHaveLength(12)
    expect(Object.keys(project.slots)).toEqual(project.order)
    const last = project.order[project.order.length - 1]
    // Bottom-right is posted first: tomorrow.
    expect(project.posts[last].date).toBe('2026-01-02')
    expect(project.posts[project.order[0]].date).toBe('2026-01-24')
    expect(project.slots[project.order[1]].note).toBe('Quote or text tile')
  })

  it('keeps empty spots when a project is copied', () => {
    const project = projectFromTemplate(BUILT_IN_TEMPLATES[0])
    const copy = remapProject(project, new Map(), { id: 'copy' })
    expect(copy.order).toHaveLength(12)
    expect(copy.order[0]).not.toBe(project.order[0])
    expect(copy.slots[copy.order[0]]).toEqual(project.slots[project.order[0]])
    expect(copy.posts[copy.order[0]].date).toBe(project.posts[project.order[0]].date)
  })

  it('names colours in plain words', () => {
    expect(describeColor([20, 20, 22])).toMatch(/^Dark/)
    expect(describeColor([120, 160, 210])).toMatch(/cool/)
    expect(describeColor([200, 200, 200])).toBe('Light · neutral')
  })

  it('ships valid built-in ideas', () => {
    for (const t of BUILT_IN_TEMPLATES) expect(normalizeTemplate(t).tiles).toHaveLength(t.tiles.length)
  })
})
