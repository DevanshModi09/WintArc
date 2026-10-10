import type { Schedule } from './api'

// Indexed like Date#getDay: 0 = Sunday.
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Session lengths on offer, in minutes.
export const DURATIONS = [30, 60, 90, 120, 150, 180, 240]

// Minutes before the start time.
export const REMINDERS = [
  { value: 0, label: 'At start' },
  { value: 10, label: '10 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
]

export const defaultSchedule = (): Schedule => ({
  days: [0, 1, 2, 3, 4, 5, 6],
  minutes: 60,
  startTime: null,
  reminder: null,
})

// "45m", "2h", "1.5h", and for anything off the half hour "1h 15m".
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  if (minutes % 30 === 0) return `${minutes / 60}h`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function formatDays(days: number[]) {
  const key = [...days].sort().join('')
  if (key === '0123456') return 'Every day'
  if (key === '12345') return 'Weekdays'
  if (key === '06') return 'Weekends'
  return [...days]
    .sort()
    .map((d) => DAY_NAMES[d].slice(0, 3))
    .join(' ')
}

// "19:00" -> "7:00 PM"
export function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
}

// "Mon Wed Fri · 2h · 7:00 PM"
export function scheduleSummary({ days, minutes, startTime }: Schedule) {
  return [formatDays(days), formatDuration(minutes), startTime && formatTime(startTime)].filter(Boolean).join(' · ')
}

// When a track that's off today is next on: "tomorrow", or the weekday's name.
export function nextDay(days: number[], weekday: number) {
  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = (weekday + ahead) % 7
    if (days.includes(day)) return ahead === 1 ? 'tomorrow' : DAY_NAMES[day]
  }
  return null
}

// Planned time across every track in a week: "7h 30m".
export function weeklyPlan(tracks: Pick<Schedule, 'days' | 'minutes'>[]) {
  const total = tracks.reduce((sum, t) => sum + t.days.length * t.minutes, 0)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return [hours && `${hours}h`, minutes && `${minutes}m`].filter(Boolean).join(' ') || '0h'
}

type Planned = Pick<Schedule, 'days' | 'minutes' | 'startTime'> & { name: string }

// One weekday laid out by the clock. Tracks with a start time become blocks
// (in minutes from midnight, cut off at midnight), each in the first lane
// where it doesn't collide with an earlier one; the rest are just listed.
export function dayPlan(tracks: Planned[], weekday: number) {
  const due = tracks.filter((t) => t.days.includes(weekday))
  const timed = due
    .flatMap((t) => {
      if (!t.startTime) return []
      const [hours, minutes] = t.startTime.split(':').map(Number)
      const start = hours * 60 + minutes
      return [{ name: t.name, start, end: Math.min(start + t.minutes, 24 * 60) }]
    })
    .sort((a, b) => a.start - b.start)

  // Where each lane is free again.
  const lanes: number[] = []
  const blocks = timed.map((block) => {
    let lane = lanes.findIndex((free) => free <= block.start)
    if (lane === -1) lane = lanes.length
    lanes[lane] = block.end
    return { ...block, lane }
  })
  const clashes = blocks.flatMap((a, i) => blocks.slice(i + 1).flatMap((b) => (b.start < a.end ? [[a.name, b.name]] : [])))

  return {
    blocks,
    lanes: lanes.length,
    clashes,
    untimed: due.filter((t) => !t.startTime).map((t) => ({ name: t.name, minutes: t.minutes })),
    total: due.reduce((sum, t) => sum + t.minutes, 0),
  }
}

// Minutes from midnight -> "5:30 PM"
export function formatClock(minutes: number) {
  const m = minutes % (24 * 60)
  return formatTime(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
}
