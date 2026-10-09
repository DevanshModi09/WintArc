import assert from 'node:assert/strict'
import { test } from 'node:test'
import { arcToIcs } from './calendar'
import { today } from './today'

// An arc that always starts tomorrow, so the first event doesn't depend on
// the day the tests run.
function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const startDate = addDays(today(), 1)
const endDate = addDays(startDate, 89)
const compact = (date: string) => date.replaceAll('-', '')

const track = {
  id: 't1',
  name: 'Web Dev; fun, stuff',
  days: [0, 1, 2, 3, 4, 5, 6],
  minutes: 90,
  startTime: '19:30' as string | null,
  reminder: 10 as number | null,
  goals: [{ title: 'Ship one feature with a title that is long enough to need folding onto a second line' }],
}
const ics = (tracks = [track]) => arcToIcs({ name: 'Winter Arc', startDate, endDate, tracks })

test('a timed track becomes a repeating event with a reminder', () => {
  const lines = ics().split('\r\n')
  assert.ok(lines.includes(`DTSTART:${compact(startDate)}T193000`))
  assert.ok(lines.includes('DURATION:PT90M'))
  assert.ok(lines.includes(`RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR,SA;UNTIL=${compact(endDate)}T235959`))
  assert.ok(lines.includes('TRIGGER:-PT10M'))
  assert.ok(lines.includes('UID:t1@wintarc'))
})

test('text is escaped and long lines are folded', () => {
  const lines = ics().split('\r\n')
  assert.ok(lines.includes(String.raw`SUMMARY:Web Dev\; fun\, stuff`))
  assert.ok(lines.every((line) => new TextEncoder().encode(line).length <= 75))
  assert.ok(lines.some((line) => line.startsWith(' ')))
})

test('a track without a start time is an all-day event with no alarm', () => {
  const text = ics([{ ...track, startTime: null, reminder: null }])
  assert.ok(text.includes(`DTSTART;VALUE=DATE:${compact(startDate)}`))
  assert.ok(text.includes(`DTEND;VALUE=DATE:${compact(addDays(startDate, 1))}`))
  assert.ok(!text.includes('VALARM'))
})

test('the first event lands on a scheduled weekday', () => {
  const day = new Date(`${addDays(startDate, 3)}T00:00:00Z`).getUTCDay()
  const text = ics([{ ...track, days: [day] }])
  assert.ok(text.includes(`DTSTART:${compact(addDays(startDate, 3))}T193000`))
})

test('an arc that has ended exports no events', () => {
  const text = arcToIcs({ name: 'Old', startDate: '2020-11-01', endDate: '2021-01-29', tracks: [track] })
  assert.ok(!text.includes('VEVENT'))
})
