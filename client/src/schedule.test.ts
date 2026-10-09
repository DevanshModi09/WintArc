import assert from 'node:assert/strict'
import { test } from 'node:test'
import { START_TIMES, formatDuration, formatTime, scheduleSummary, weeklyPlan } from './schedule'

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

test('start times cover the day in half hours, from 5 AM', () => {
  assert.equal(START_TIMES.length, 48)
  assert.equal(new Set(START_TIMES).size, 48)
  assert.equal(START_TIMES[0], '05:00')
  assert.equal(START_TIMES.at(-1), '04:30')
})
