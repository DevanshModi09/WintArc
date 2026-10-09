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

export function formatDuration(minutes: number) {
  return minutes < 60 ? `${minutes}m` : `${minutes / 60}h`
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

// Every half hour, starting from the early morning rather than midnight.
export const START_TIMES = Array.from({ length: 48 }, (_, i) => {
  const slot = (i + 10) % 48
  return `${String(Math.floor(slot / 2)).padStart(2, '0')}:${slot % 2 ? '30' : '00'}`
})

// "Mon Wed Fri · 2h · 7:00 PM"
export function scheduleSummary({ days, minutes, startTime }: Schedule) {
  return [formatDays(days), formatDuration(minutes), startTime && formatTime(startTime)].filter(Boolean).join(' · ')
}

// Planned time across every track in a week: "7h 30m".
export function weeklyPlan(tracks: Pick<Schedule, 'days' | 'minutes'>[]) {
  const total = tracks.reduce((sum, t) => sum + t.days.length * t.minutes, 0)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return [hours && `${hours}h`, minutes && `${minutes}m`].filter(Boolean).join(' ') || '0h'
}
