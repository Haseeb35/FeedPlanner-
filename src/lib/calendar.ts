import type { PostDetails } from '../types'
import { addDays, getPost, parseISODate, toISODate } from './posts'
import { postingNumber } from './grid'

/**
 * Builds an iCalendar (.ics) file of planned posts. Google Calendar, Apple Calendar and Outlook
 * can import it, and each event carries a reminder, so people get notified even when
 * FeedPlanner is closed.
 */

export interface CalendarPost {
  id: string
  number: number
  post: PostDetails
}

/** Escapes text for an iCalendar property value. */
export function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1')
}

/** Folds a content line to 75 octets as RFC 5545 requires, without splitting characters. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const bytes = encoder.encode(char).length
    if (size + bytes > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += bytes
  }
  parts.push(current)
  return parts.join('\r\n ')
}

const compactDate = (date: string) => date.replace(/-/g, '')

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Local date-time without a zone, e.g. 20261031T180000. */
function localStamp(d: Date): string {
  return `${compactDate(toISODate(d))}T${pad(d.getHours())}${pad(d.getMinutes())}00`
}

/** Planned, unposted posts in publishing order. */
export function calendarPosts(order: string[], posts: Record<string, PostDetails>): CalendarPost[] {
  return order
    .map((id, index) => ({ id, number: postingNumber(index, order.length), post: getPost(posts, id) }))
    .filter((p) => p.post.date && !p.post.posted)
    .sort((a, b) => a.number - b.number)
}

export function buildIcs(projectName: string, items: CalendarPost[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FeedPlanner//Posting plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeIcs(`${projectName} · posting plan`)}`]
  for (const { id, number, post } of items) {
    const date = post.date!
    const type = post.type === 'reel' ? 'Reel' : post.type === 'carousel' ? 'carousel' : 'post'
    const caption = post.caption.trim()
    const description = [`Post ${number} of your “${projectName}” plan. Open FeedPlanner and use “Post now” to copy the caption and share the photo.`, caption && `Caption:\n${caption}`]
      .filter(Boolean)
      .join('\n\n')
    lines.push('BEGIN:VEVENT', `UID:${id}-${date}@feedplanner`, `DTSTAMP:${stamp(now)}`)
    if (post.time) {
      // Floating local time: the event stays at this time in whatever time zone the calendar uses.
      const start = parseISODate(date)
      const [h, m] = post.time.split(':').map(Number)
      start.setHours(h, m)
      lines.push(`DTSTART:${localStamp(start)}`, `DTEND:${localStamp(new Date(start.getTime() + 15 * 60_000))}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(date)}`, `DTEND;VALUE=DATE:${compactDate(addDays(date, 1))}`)
    }
    lines.push(
      `SUMMARY:${escapeIcs(`📸 Instagram ${type} ${number} · ${projectName}`)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcs(`Time to post on Instagram (${type} ${number})`)}`,
      // Timed posts remind 15 minutes before; all-day posts remind at 9:00 that morning.
      post.time ? 'TRIGGER:-PT15M' : 'TRIGGER:PT9H',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
