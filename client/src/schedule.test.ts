import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dayPlan, formatClock, formatDuration, formatTime, nextDay, scheduleSummary, sessionsLeft, weeklyPlan } from './schedule'

const schedule = { days: [1, 3, 5], minutes: 90, startTime: '19:00', reminder: 10 }

test('formatTime uses a 12-hour clock', () => {
  assert.equal(formatTime('00:30'), '12:30 AM')
  assert.equal(formatTime('12:00'), '12:00 PM')
  assert.equal(formatTime('19:05'), '7:05 PM')
})

test('formatDuration', () => {
  assert.equal(formatDuration(30), '30m')
  assert.equal(formatDuration(90), '1.5h')
  assert.equal(formatDuration(120), '2h')
})

test('scheduleSummary names common sets of days', () => {
  assert.equal(scheduleSummary(schedule), 'Mon Wed Fri · 1.5h · 7:00 PM')
  assert.equal(scheduleSummary({ ...schedule, days: [0, 1, 2, 3, 4, 5, 6], startTime: null }), 'Every day · 1.5h')
  assert.equal(scheduleSummary({ ...schedule, days: [5, 1, 3, 2, 4] }), 'Weekdays · 1.5h · 7:00 PM')
  assert.equal(scheduleSummary({ ...schedule, days: [6, 0] }), 'Weekends · 1.5h · 7:00 PM')
})

test('weeklyPlan totals every track', () => {
  assert.equal(weeklyPlan([schedule]), '4h 30m')
  assert.equal(weeklyPlan([schedule, { days: [0, 6], minutes: 45 }]), '6h')
  assert.equal(weeklyPlan([]), '0h')
})

test('formatDuration spells out lengths that are off the half hour', () => {
  assert.equal(formatDuration(45), '45m')
  assert.equal(formatDuration(90), '1.5h')
  assert.equal(formatDuration(75), '1h 15m')
  assert.equal(formatDuration(195), '3h 15m')
})

test('dayPlan lays out the tracks that run that day, by the clock', () => {
  const tracks = [
    { name: 'DSA', days: [1, 2, 3], minutes: 120, startTime: '17:30' },
    { name: 'Web', days: [1], minutes: 60, startTime: null },
    { name: 'Gym', days: [0, 6], minutes: 60, startTime: '07:00' },
  ]
  const monday = dayPlan(tracks, 1)
  assert.deepEqual(monday.blocks, [{ name: 'DSA', start: 1050, end: 1170, lane: 0 }])
  assert.deepEqual(monday.untimed, [{ name: 'Web', minutes: 60 }])
  assert.equal(monday.total, 180)
  assert.deepEqual(dayPlan(tracks, 4), { blocks: [], lanes: 0, clashes: [], untimed: [], total: 0 })
})

test('dayPlan puts overlapping tracks in separate lanes and names the clash', () => {
  const plan = dayPlan(
    [
      { name: 'DSA', days: [1], minutes: 120, startTime: '17:30' },
      { name: 'Web', days: [1], minutes: 60, startTime: '19:00' },
      { name: 'Read', days: [1], minutes: 60, startTime: '19:30' },
    ],
    1,
  )
  assert.deepEqual(plan.blocks.map((b) => b.lane), [0, 1, 0])
  assert.deepEqual(plan.clashes, [['DSA', 'Web'], ['Web', 'Read']])
  assert.equal(plan.lanes, 2)
})

test('formatClock', () => {
  assert.equal(formatClock(1050), '5:30 PM')
  assert.equal(formatClock(0), '12:00 AM')
  assert.equal(formatClock(24 * 60), '12:00 AM')
})

test('nextDay names the next day a track is on', () => {
  // From Saturday.
  assert.equal(nextDay([0, 1], 6), 'tomorrow')
  assert.equal(nextDay([1, 3, 5], 6), 'Monday')
  assert.equal(nextDay([5], 6), 'Friday')
  assert.equal(nextDay([], 6), null)
})

test('sessionsLeft counts the scheduled days still to come', () => {
  // 2026-10-10 is a Saturday. The arc runs Sat 10 Oct to Fri 23 Oct.
  const arc = { startDate: '2026-10-10', endDate: '2026-10-23' }
  const track = { days: [1, 3, 5], doneToday: false, complete: false }
  // Mon Wed Fri, two weeks.
  assert.equal(sessionsLeft(track, arc, '2026-10-10'), 6)
  // On a Monday, today's still counts until it's committed.
  assert.equal(sessionsLeft(track, arc, '2026-10-12'), 6)
  assert.equal(sessionsLeft({ ...track, doneToday: true }, arc, '2026-10-12'), 5)
  // The last day, then after the arc.
  assert.equal(sessionsLeft(track, arc, '2026-10-23'), 1)
  assert.equal(sessionsLeft(track, arc, '2026-10-24'), 0)
  // Before the arc starts, every session is still ahead.
  assert.equal(sessionsLeft(track, arc, '2026-10-01'), 6)
  assert.equal(sessionsLeft({ ...track, complete: true }, arc, '2026-10-12'), 0)
  assert.equal(sessionsLeft({ ...track, days: [0, 1, 2, 3, 4, 5, 6] }, arc, '2026-10-10'), 14)
})
