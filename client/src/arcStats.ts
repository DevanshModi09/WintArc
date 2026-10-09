import type { Arc, ArcSummary, Track } from './api'

// The four headline numbers shown on both the Today and Profile pages.
export function arcStats(arc: Arc) {
  return [
    { label: 'Current streak', value: `${arc.streak.current}d` },
    { label: 'Best streak', value: `${arc.streak.best}d` },
    { label: 'Level', value: arc.level.number },
    { label: 'Total XP', value: arc.xp.toLocaleString() },
  ]
}

// Where someone is in their arc: "starts in 25 days", "day 12 of 90", "complete".
export function arcPhase(arc: ArcSummary) {
  if (arc.isOver) return 'complete'
  if (arc.startsIn > 0) return `starts in ${arc.startsIn} ${arc.startsIn === 1 ? 'day' : 'days'}`
  return `day ${arc.dayNumber} of ${arc.totalDays}`
}

// How far along a track is: the share of its checkpoints ticked, as a whole
// percentage. A track without checkpoints has nothing to measure, so null.
export function trackProgress({ checkpoints }: Pick<Track, 'checkpoints'>) {
  if (checkpoints.length === 0) return null
  return Math.round((checkpoints.filter((c) => c.done).length / checkpoints.length) * 100)
}

// The numbers on the end-of-arc wrap.
export function wrappedStats(arc: Arc) {
  // Rest days aren't held against you.
  const daysDue = arc.days.filter((d) => d.status !== 'empty').length
  const checkpoints = arc.tracks.flatMap((t) => t.checkpoints)
  // The track you were most consistent on. Ties go to the first one.
  const topTrack = arc.tracks.reduce<Track | null>((top, t) => (top && top.streak.best >= t.streak.best ? top : t), null)
  return {
    perfectDays: arc.perfectDays,
    consistency: daysDue ? Math.round((arc.perfectDays / daysDue) * 100) : 0,
    bestStreak: arc.streak.best,
    totalCheckIns: arc.totalCheckIns,
    level: arc.level.number,
    levelTitle: arc.level.title,
    xp: arc.xp,
    badges: arc.badges.filter((b) => b.earned).length,
    checkpointsDone: checkpoints.filter((c) => c.done).length,
    checkpointsTotal: checkpoints.length,
    topTrack: topTrack && topTrack.streak.best > 0 ? { name: topTrack.name, bestStreak: topTrack.streak.best } : null,
  }
}

// The days that unlock a mini wrap on the way to the full one.
export const MILESTONES = [30, 60]

// A milestone opens once its day is behind you.
export function milestoneUnlocked(arc: Pick<Arc, 'dayNumber' | 'isOver'>, day: number) {
  return arc.isOver || arc.dayNumber > day
}

// The wrap numbers for just the first `upTo` days of the arc.
export function milestoneStats(arc: Pick<Arc, 'days'>, upTo: number) {
  const days = arc.days.slice(0, upTo)
  const due = days.filter((d) => d.status !== 'empty')
  let bestStreak = 0
  let run = 0
  for (const d of due) {
    run = d.status === 'perfect' ? run + 1 : 0
    bestStreak = Math.max(bestStreak, run)
  }
  const perfectDays = due.filter((d) => d.status === 'perfect').length
  return {
    perfectDays,
    bestStreak,
    consistency: due.length ? Math.round((perfectDays / due.length) * 100) : 0,
    totalCheckIns: days.reduce((sum, d) => sum + d.done, 0),
  }
}

// "Still standing" until the first dropped day, then the day it happened.
export function survivorLabel({ survivor, startsIn }: Pick<Arc, 'survivor' | 'startsIn'>) {
  if (startsIn > 0) return null
  if (survivor.alive) return 'still standing'
  return survivor.fellOnDay ? `out on day ${survivor.fellOnDay}` : null
}
