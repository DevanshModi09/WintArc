import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { LOGO_BOX, LOGO_PATH } from '../logo'
import { today, type Arc, type PublicUser } from '../api'
import { ProgressBar } from './Motion'

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-display text-lg font-bold tracking-[-0.02em]">
      <svg width="20" height="20" viewBox={`0 0 ${LOGO_BOX} ${LOGO_BOX}`} fill="currentColor" aria-hidden="true">
        <path d={LOGO_PATH} fillRule="evenodd" />
      </svg>
      WintArc
    </span>
  )
}

type AvatarProps = { user: Pick<PublicUser, 'name' | 'avatarUrl'>; size?: 'sm' | 'lg' }

export function Avatar({ user: { name, avatarUrl }, size = 'sm' }: AvatarProps) {
  const box = size === 'lg' ? 'size-[72px] text-[28px]' : 'size-8 text-[13px]'
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={`shrink-0 rounded-full object-cover ${box}`} />
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-fg font-semibold text-bg ${box}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex size-[18px] shrink-0 items-center justify-center rounded-check border-[1.5px] ${
        checked ? 'border-fg bg-fg text-bg' : 'border-muted'
      }`}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          {/* The tick draws itself in. */}
          <motion.path d="M20 6 9 17l-5-5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25, ease: 'easeOut' }} />
        </svg>
      )}
    </span>
  )
}

// A few headline numbers in one small block, to sit beside a page title.
export function StatLine({ stats }: { stats: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="card inline-flex divide-x divide-line overflow-hidden">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col-reverse gap-1 px-5 py-3">
          <dd className="text-xl leading-none font-medium whitespace-nowrap">{s.value}</dd>
          <dt className="label leading-none">{s.label}</dt>
        </div>
      ))}
    </dl>
  )
}

const COLS = 15

const graphDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

// The colour of one day: the more of it was done, the stronger the accent.
function dayColor(day: Arc['days'][number] | undefined, isToday: boolean) {
  if (!day) return 'bg-cell/50'
  if (day.status === 'perfect') return 'bg-accent'
  if (day.status === 'partial') return day.done / day.total >= 0.5 ? 'bg-accent/65' : 'bg-accent/35'
  // Today isn't a miss until it's over.
  if (day.status === 'missed') return isToday ? 'bg-cell ring-1 ring-fg ring-inset' : 'bg-cell-missed'
  return 'bg-cell'
}

function dayLine(day: Arc['days'][number], isToday: boolean) {
  if (day.status === 'empty') return 'Rest day'
  if (day.status === 'perfect') return day.total === 1 ? 'Committed' : `All ${day.total} committed`
  if (day.done === 0) return isToday ? `0 of ${day.total} so far` : 'Missed'
  return `${day.done} of ${day.total} committed`
}

// The arc as a grid, a square a day, shaded by how much of the day was done.
// Hover a square, or tab to it, for the date, the count and what was
// committed that day.
export function ActivityGrid({ arc }: { arc: Arc }) {
  // Every commit by day, from the tracks this viewer is allowed to see.
  const byDay = new Map<string, { track: string; note: string | null }[]>()
  for (const track of arc.tracks) {
    for (const commit of track.commits) {
      byDay.set(commit.date, [...(byDay.get(commit.date) ?? []), { track: track.name, note: commit.note }])
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="h2">Arc activity</h2>
        <span className="label">
          {arc.totalCheckIns} {arc.totalCheckIns === 1 ? 'commit' : 'commits'}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-[3px]">
        {Array.from({ length: arc.totalDays }, (_, i) => {
          const day = arc.days[i]
          const isToday = day?.date === today()
          const commits = day ? (byDay.get(day.date) ?? []) : []
          // Keep the card on the page at either edge of the grid.
          const col = i % COLS
          const side = col < 4 ? 'left-0' : col > COLS - 5 ? 'right-0' : 'left-1/2 -translate-x-1/2'
          return (
            <div key={i} className="group relative" tabIndex={day ? 0 : undefined}>
              <div className={`aspect-square rounded-cell transition group-hover:scale-125 group-focus:scale-125 ${dayColor(day, isToday)}`} />
              <div
                role="tooltip"
                className={`card pointer-events-none absolute bottom-full z-20 mb-2 hidden w-max max-w-[240px] px-3 py-2 text-[12px] leading-snug shadow-2xl group-hover:block group-focus:block ${side}`}
              >
                <div className="font-medium">
                  Day {i + 1}
                  {day && ` · ${isToday ? 'Today' : graphDay(day.date)}`}
                </div>
                <div className="text-muted">{day ? dayLine(day, isToday) : 'Still to come'}</div>
                {commits.length > 0 && (
                  <ul className="mt-1.5 space-y-1 border-t border-line pt-1.5">
                    {commits.slice(0, 4).map((c) => (
                      <li key={c.track} className="break-words">
                        <span className="text-muted">{c.track}:</span> {c.note ?? 'no message'}
                      </li>
                    ))}
                    {commits.length > 4 && <li className="text-muted">and {commits.length - 4} more</li>}
                  </ul>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted" aria-hidden="true">
        Less
        {['bg-cell', 'bg-accent/35', 'bg-accent/65', 'bg-accent'].map((c) => (
          <span key={c} className={`size-2.5 rounded-cell ${c}`} />
        ))}
        More
        <span className="ml-3 size-2.5 rounded-cell bg-cell-missed" />
        Missed
      </div>
    </section>
  )
}

export function Rewards({ arc }: { arc: Arc }) {
  return (
    <section className="space-y-2.5">
      <h2 className="h2">Rewards</h2>
      <div className="flex flex-wrap gap-2 font-mono text-[13px]">
        {arc.badges.map((b) => (
          <span
            key={b.days}
            title={`${b.days}-day streak · +${b.xp} XP`}
            className={`rounded-full px-3 py-1.5 ${
              b.earned ? 'bg-fg text-bg' : 'border border-dashed border-muted/50 text-muted'
            }`}
          >
            {b.days}d {b.name}
          </span>
        ))}
      </div>
    </section>
  )
}

export function Lock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export function LevelBar({ arc }: { arc: Arc }) {
  const { level } = arc
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <h2 className="h2">{level.title}</h2>
        <span className="font-mono text-[13px] text-muted">
          {level.xpIntoLevel}/{level.xpPerLevel} XP
        </span>
      </div>
      <ProgressBar percent={(level.xpIntoLevel / level.xpPerLevel) * 100} label={`Progress to level ${level.number + 1}`} />
      <p className="label">+10 XP per check-in · +20 for a perfect day · bonus XP for each reward</p>
    </section>
  )
}

export function Loading() {
  return (
    <p role="status" className="label py-16 text-center font-mono">
      Loading…
    </p>
  )
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-[20px] border border-danger/30 bg-danger/10 px-4 py-2.5 text-danger">
      {message}
    </p>
  )
}
