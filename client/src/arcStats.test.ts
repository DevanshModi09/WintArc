import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Arc, Track } from './api'
import { trackProgress, wrappedStats } from './arcStats'

const track = (name: string, best: number, done: boolean[]) =>
  ({ name, streak: { current: 0, best }, checkpoints: done.map((d, i) => ({ id: `${name}${i}`, title: '', done: d })) }) as Track

const arc = (tracks: Track[], statuses: string[]) =>
  ({
    perfectDays: statuses.filter((s) => s === 'perfect').length,
    totalCheckIns: 9,
    xp: 300,
    streak: { current: 1, best: 4 },
    level: { number: 2, title: 'Frostbitten', xpIntoLevel: 100, xpPerLevel: 200 },
    badges: [{ earned: true }, { earned: false }],
    days: statuses.map((status, i) => ({ date: `d${i}`, status })),
    tracks,
  }) as unknown as Arc

test('trackProgress is the share of checkpoints ticked', () => {
  assert.equal(trackProgress(track('a', 0, [true, false, false])), 33)
  assert.equal(trackProgress(track('a', 0, [true, true])), 100)
  assert.equal(trackProgress(track('a', 0, [])), null)
})

test('wrappedStats ignores rest days when working out consistency', () => {
  const stats = wrappedStats(arc([], ['perfect', 'empty', 'missed', 'perfect', 'partial']))
  assert.equal(stats.perfectDays, 2)
  assert.equal(stats.consistency, 50)
})

test('wrappedStats adds up checkpoints and picks the strongest track', () => {
  const stats = wrappedStats(arc([track('DSA', 3, [true, false]), track('Web', 7, [true])], ['perfect']))
  assert.equal(stats.checkpointsDone, 2)
  assert.equal(stats.checkpointsTotal, 3)
  assert.deepEqual(stats.topTrack, { name: 'Web', bestStreak: 7 })
  assert.equal(stats.badges, 1)
})

test('wrappedStats copes with an arc that has nothing yet', () => {
  const stats = wrappedStats(arc([track('DSA', 0, [])], []))
  assert.equal(stats.consistency, 0)
  assert.equal(stats.topTrack, null)
  assert.equal(stats.checkpointsTotal, 0)
})
