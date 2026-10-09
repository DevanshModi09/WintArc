import type { Arc, Track } from './api'
import { downloadFile } from './download'
import { today } from './today'

// Builds an .ics file with one repeating event per track, which Apple
// Calendar, Google Calendar and Outlook can all import.

type CalendarTrack = Pick<Track, 'id' | 'name' | 'days' | 'minutes' | 'startTime' | 'reminder'> & { checkpoints: { title: string }[] }
type CalendarArc = Pick<Arc, 'name' | 'startDate' | 'endDate'> & { tracks: CalendarTrack[] }

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

const compact = (date: string) => date.replaceAll('-', '')

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

const escapeText = (text: string) => text.replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n')

// Lines longer than 75 bytes have to be folded onto continuation lines.
function fold(line: string) {
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = new TextEncoder().encode(char).length
    if (bytes + size > 74) {
      parts.push(current)
      current = ' '
      bytes = 1
    }
    current += char
    bytes += size
  }
  return [...parts, current].join('\r\n')
}

function trackEvent(arc: CalendarArc, track: CalendarTrack, stamp: string): string[] {
  // The first scheduled day that is still ahead of us.
  let first = arc.startDate > today() ? arc.startDate : today()
  while (first <= arc.endDate && !track.days.includes(weekday(first))) first = addDays(first, 1)
  if (first > arc.endDate) return []

  const checkpoints = track.checkpoints.map((c) => `- ${c.title}`).join('\n')
  const lines = [
    'BEGIN:VEVENT',
    // A stable id, so importing again updates the event instead of duplicating it.
    `UID:${track.id}@wintarc`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${escapeText(track.name)}`,
    `DESCRIPTION:${escapeText(checkpoints ? `${arc.name}\n${checkpoints}` : arc.name)}`,
  ]
  const byDay = track.days.map((d) => BYDAY[d]).join(',')
  if (track.startTime) {
    // No timezone on purpose: the event stays at this local time wherever you are.
    lines.push(
      `DTSTART:${compact(first)}T${track.startTime.replace(':', '')}00`,
      `DURATION:PT${track.minutes}M`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${compact(arc.endDate)}T235959`,
    )
    if (track.reminder !== null) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(track.name)}`,
        `TRIGGER:-PT${track.reminder}M`,
        'END:VALARM',
      )
    }
  } else {
    // Without a start time it becomes an all-day event.
    lines.push(
      `DTSTART;VALUE=DATE:${compact(first)}`,
      `DTEND;VALUE=DATE:${compact(addDays(first, 1))}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${compact(arc.endDate)}`,
    )
  }
  lines.push('END:VEVENT')
  return lines
}

export function arcToIcs(arc: CalendarArc): string {
  const stamp = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WintArc//Arc//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(arc.name)}`,
    ...arc.tracks.flatMap((track) => trackEvent(arc, track, stamp)),
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function downloadCalendar(arc: Arc) {
  downloadFile(`${arc.name}.ics`, arcToIcs(arc), 'text/calendar')
}
