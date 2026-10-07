import type { Arc, ArcSummary } from './api'

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
