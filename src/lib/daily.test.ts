import { beforeEach, describe, expect, it } from 'vitest'
import type { PostDetails } from '../types'
import { emptyPost } from './posts'
import { buildAgenda, relativeDay } from './today'
import { buildIcs, calendarPosts, escapeIcs, foldLine } from './calendar'
import { duplicateHashtags, extractHashtags, insertSnippet, loadSnippets, normalizeHashtagText, saveSnippets } from './snippets'

const post = (patch: Partial<PostDetails>): PostDetails => ({ ...emptyPost, ...patch })

describe('today agenda', () => {
  // Grid order: index 0 is top-left (published last). Publishing order: e, d, c, b, a.
  const order = ['a', 'b', 'c', 'd', 'e']
  const posts = {
    e: post({ posted: true, date: '2026-10-20', caption: 'done' }),
    d: post({ date: '2026-10-28', caption: 'late one' }),
    c: post({ date: '2026-10-30' }),
    b: post({ date: '2026-11-03', caption: 'soon' }),
  }
  const agenda = buildAgenda({ order, posts, slots: { a: { note: 'Quote', color: '#ccc' } } }, new Set(['b', 'c', 'd', 'e']), '2026-10-30')

  it('finds the next post in publishing order', () => {
    expect(agenda.next?.id).toBe('d')
    expect(agenda.next?.number).toBe(2)
  })

  it('groups posts by when they are due', () => {
    expect(agenda.overdue.map((i) => i.id)).toEqual(['d'])
    expect(agenda.today.map((i) => i.id)).toEqual(['c'])
    expect(agenda.upcoming.map((i) => i.id)).toEqual(['b'])
  })

  it('lists what still needs attention, ignoring posted ones', () => {
    expect(agenda.missingCaption.map((i) => i.id)).toEqual(['c', 'a'])
    expect(agenda.unscheduled.map((i) => i.id)).toEqual(['a'])
    expect(agenda.emptySpots.map((i) => i.id)).toEqual(['a'])
    expect([agenda.posted, agenda.total]).toEqual([1, 5])
  })

  it('describes days relative to today', () => {
    expect(relativeDay('2026-10-30', '2026-10-30')).toBe('Today')
    expect(relativeDay('2026-10-31', '2026-10-30')).toBe('Tomorrow')
    expect(relativeDay('2026-10-27', '2026-10-30')).toBe('3 days late')
    expect(relativeDay('2026-11-20', '2026-10-30')).toBe('In 21 days')
  })
})

describe('calendar export', () => {
  it('escapes and folds lines', () => {
    expect(escapeIcs('a, b; c\nd\\e')).toBe('a\\, b\\; c\\nd\\\\e')
    const folded = foldLine('X'.repeat(160))
    expect(folded.split('\r\n ').map((l) => l.length)).toEqual([75, 74, 11])
    // Multi-byte characters are never split.
    expect(foldLine('é'.repeat(50)).split('\r\n ')[0]).toBe('é'.repeat(37))
  })

  it('creates an event with a reminder for each planned, unposted post', () => {
    const order = ['a', 'b', 'c']
    const posts = {
      c: post({ date: '2026-11-01', time: '23:50', caption: 'Hello, world' }),
      b: post({ date: '2026-11-03', type: 'reel' }),
      a: post({ date: '2026-11-05', posted: true }),
    }
    const items = calendarPosts(order, posts)
    expect(items.map((i) => i.id)).toEqual(['c', 'b'])
    const ics = buildIcs('Shop; launch', items, new Date(Date.UTC(2026, 9, 30, 12)))
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('DTSTART:20261101T235000')
    // A 15-minute event that crosses midnight ends the next day.
    expect(ics).toContain('DTEND:20261102T000500')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261103')
    expect(ics).toContain('TRIGGER:-PT15M')
    expect(ics).toContain('Instagram Reel 2')
    expect(ics).toContain('Shop\\; launch')
    expect(ics.replace(/\r\n /g, '')).toContain('Caption:\\nHello\\, world')
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true)
  })
})

describe('hashtag sets and snippets', () => {
  beforeEach(() => localStorage.clear())

  it('extracts, deduplicates and normalises hashtags', () => {
    expect(extractHashtags('Hi #Sea #sun not#this #sea')).toEqual(['#Sea', '#sun'])
    expect(duplicateHashtags('#a #b #A')).toEqual(['#a'])
    expect(normalizeHashtagText('ceramics, #handmade  lisbon #ceramics')).toBe('#ceramics #handmade #lisbon')
  })

  it('adds only new hashtags on their own line', () => {
    const result = insertSnippet('Golden hour ✨ #sun', { kind: 'hashtags', text: '#sun #sea #sand' })
    expect(result.caption).toBe('Golden hour ✨ #sun\n\n#sea #sand')
    expect(result.skipped).toBe(1)
    // Appends to an existing hashtag line.
    expect(insertSnippet('Hi\n\n#a', { kind: 'hashtags', text: '#b' }).caption).toBe('Hi\n\n#a #b')
    expect(insertSnippet('', { kind: 'text', text: 'Shop the link in bio' }).caption).toBe('Shop the link in bio')
    expect(insertSnippet('#a', { kind: 'hashtags', text: '#a' })).toEqual({ caption: '#a', skipped: 1, truncated: false })
  })

  it('never goes past the caption limit', () => {
    const result = insertSnippet('x'.repeat(2195), { kind: 'text', text: 'long sign-off' })
    expect(result.caption.length).toBe(2200)
    expect(result.truncated).toBe(true)
  })

  it('saves and loads the library, ignoring damaged data', () => {
    expect(loadSnippets()).toEqual([])
    saveSnippets([{ id: '1', kind: 'hashtags', name: 'Ceramics', text: '#clay' }])
    expect(loadSnippets()).toEqual([{ id: '1', kind: 'hashtags', name: 'Ceramics', text: '#clay' }])
    expect(loadSnippets()).toBe(loadSnippets())
    localStorage.setItem('fp-snippets', '{broken')
    expect(loadSnippets()).toEqual([])
  })
})
