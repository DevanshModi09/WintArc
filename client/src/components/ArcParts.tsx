import type { ReactNode } from 'react'
import { LOGO_BOX, LOGO_PATH } from '../logo'
import { today, type Arc, type DayStatus, type PublicUser } from '../api'

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
          <path d="M20 6 9 17l-5-5" />
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

const DAY_COLORS: Record<DayStatus, string> = {
  perfect: 'bg-fg',
  partial: 'bg-cell-partial',
  missed: 'bg-cell-missed',
  empty: 'bg-cell',
}

export function ActivityGrid({ arc }: { arc: Arc }) {
  return (
    <section className="space-y-3">
      <h2 className="h2">Arc activity</h2>
      <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-[3px]">
        {Array.from({ length: arc.totalDays }, (_, i) => {
          const day = arc.days[i]
          // Today isn't a miss until it's over.
          const pending = day?.date === today() && day.status === 'missed'
          let color = 'bg-cell'
          if (pending) color = 'bg-bg ring-1 ring-fg ring-inset'
          else if (day) color = DAY_COLORS[day.status]
          return (
            <div
              key={i}
              title={day ? `${day.date}: ${day.status}` : `Day ${i + 1}`}
              className={`aspect-square rounded-cell ${color}`}
            />
          )
        })}
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
      <div className="h-1.5 overflow-hidden rounded-full bg-cell">
        <div className="h-full bg-fg" style={{ width: `${(level.xpIntoLevel / level.xpPerLevel) * 100}%` }} />
      </div>
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
