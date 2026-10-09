import { useEffect, useRef, useState } from 'react'
import type { Schedule } from '../api'
import { DAY_NAMES, dayPlan, formatClock, formatDuration } from '../schedule'

type Planned = Pick<Schedule, 'days' | 'minutes' | 'startTime'> & { name: string }

const HOUR_PX = 44
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
// Where the view opens: noon, with the afternoon and evening below it.
const NOON = 12

// One day as a planner page: the hours run down, and each track that has a
// start time is a block at its place on the clock, so it's plain how much of
// the day the plan takes and where things collide. The whole day is there;
// the box scrolls, and opens at noon. Flip through the
// week with the day buttons.
export function DayPlan({ tracks }: { tracks: Planned[] }) {
  const [weekday, setWeekday] = useState(() => new Date().getDay())
  const scroller = useRef<HTMLDivElement>(null)
  const named = tracks.map((t) => ({ ...t, name: t.name.trim() || 'Untitled track' }))
  const plan = dayPlan(named, weekday)

  // Open at noon. If something is planned for the morning, open an hour above
  // that instead, so it isn't sitting out of sight.
  const first = plan.blocks.length ? plan.blocks[0].start / 60 : NOON
  const openAt = first < NOON ? Math.max(0, first - 1) : NOON
  useEffect(() => {
    scroller.current?.scrollTo({ top: openAt * HOUR_PX })
  }, [openAt, weekday])

  // Minutes of work on each day of the week, Sunday first.
  const week = DAY_NAMES.map((_, day) => named.reduce((sum, t) => sum + (t.days.includes(day) ? t.minutes : 0), 0))
  const busiest = Math.max(1, ...week)

  const length = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '0m'
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="h2">How your day looks</h2>
        <span className="label">{plan.total ? `${length(plan.total)} planned` : 'Nothing planned'}</span>
      </div>

      <div className="flex gap-1.5" role="group" aria-label="Day of the week">
        {DAY_NAMES.map((name, day) => (
          <button
            key={name}
            type="button"
            className={`h-8 flex-1 rounded-full border text-[13px] transition ${
              day === weekday ? 'border-fg bg-fg text-bg' : 'border-line hover:border-fg'
            }`}
            aria-pressed={day === weekday}
            aria-label={name}
            onClick={() => setWeekday(day)}
          >
            {name.slice(0, 3)}
          </button>
        ))}
      </div>

      <div
        ref={scroller}
        className="card max-h-[min(60vh,520px)] overflow-y-auto overscroll-contain"
        tabIndex={0}
        aria-label={`${DAY_NAMES[weekday]}, hour by hour`}
      >
        <div className="relative my-3 mr-3 ml-16" style={{ height: 24 * HOUR_PX }}>
          {HOURS.map((hour) => (
            <div key={hour} aria-hidden="true" className="absolute inset-x-0 border-t border-line" style={{ top: hour * HOUR_PX }}>
              <span className="absolute -top-2 -left-14 w-11 text-right text-[11px] leading-4 text-muted">
                {formatClock(hour * 60).replace(':00', '')}
              </span>
            </div>
          ))}
          {plan.blocks.map((block) => {
            const height = ((block.end - block.start) / 60) * HOUR_PX
            return (
              <div
                key={`${block.name} ${block.start}`}
                className="absolute overflow-hidden rounded-[8px] border border-accent bg-accent/25 px-2.5 text-[13px] leading-tight"
                style={{
                  top: (block.start / 60) * HOUR_PX + 1,
                  height: height - 2,
                  left: `${(block.lane * 100) / plan.lanes}%`,
                  width: `calc(${100 / plan.lanes}% - 4px)`,
                }}
                title={`${block.name}: ${formatClock(block.start)} to ${formatClock(block.end)}`}
              >
                {/* A half-hour block only has room for one line. */}
                <div className={height < 40 ? 'flex h-full items-center gap-2' : 'pt-1.5'}>
                  <div className="truncate font-medium">{block.name}</div>
                  <div className="truncate text-muted">
                    {formatClock(block.start)} – {formatClock(block.end)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* The week at a glance: how much work each day carries. */}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[14px] font-medium">Hours each day</h3>
          <span className="label">{length(week.reduce((sum, minutes) => sum + minutes, 0))} a week</span>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {week.map((minutes, day) => (
            <button
              key={DAY_NAMES[day]}
              type="button"
              className={`flex flex-col items-center gap-1.5 rounded-[10px] border px-1 pt-2 pb-1.5 transition ${
                day === weekday ? 'border-fg' : 'border-line hover:border-fg'
              }`}
              aria-label={`${DAY_NAMES[day]}: ${minutes ? length(minutes) : 'nothing planned'}`}
              onClick={() => setWeekday(day)}
            >
              <span className="flex h-10 w-full items-end justify-center" aria-hidden="true">
                <span
                  className={`w-3 rounded-[3px] ${minutes ? 'bg-accent' : 'bg-cell'}`}
                  style={{ height: minutes ? `${Math.max(12, (minutes / busiest) * 100)}%` : 3 }}
                />
              </span>
              <span className="text-[12px] leading-none font-medium whitespace-nowrap">{minutes ? length(minutes) : '–'}</span>
              <span className="text-[11px] leading-none text-muted">{DAY_NAMES[day].slice(0, 3)}</span>
            </button>
          ))}
        </div>
      </div>

      {plan.blocks.length === 0 && (
        <p className="label">{plan.untimed.length ? 'No track has a start time on this day.' : 'A free day.'}</p>
      )}
      {plan.untimed.length > 0 && (
        <p className="label">
          No set time: {plan.untimed.map((t) => `${t.name} (${formatDuration(t.minutes)})`).join(', ')}. Give a track a
          start time to see it on the day.
        </p>
      )}
      {plan.clashes.map(([a, b]) => (
        <p key={`${a} ${b}`} role="alert" className="text-[14px] text-danger">
          {a} and {b} overlap on {DAY_NAMES[weekday]}.
        </p>
      ))}
    </section>
  )
}
