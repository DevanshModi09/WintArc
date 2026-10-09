import { useEffect, useRef, useState } from 'react'
import { api, type Arc, type Goal, type Track } from '../api'
import { Link } from 'react-router-dom'
import { arcPhase, arcStats, trackProgress } from '../arcStats'
import { ActivityGrid, Checkbox, ErrorNote, LevelBar, Loading, Rewards, StatStrip } from '../components/ArcParts'
import { downloadCalendar } from '../calendar'
import { scheduleSummary, weeklyPlan } from '../schedule'
import { useTitle } from '../useTitle'
import { ArcSetup } from './ArcSetup'

// `optimistic` is what the arc should look like once the action succeeds. It
// is shown straight away, so ticking a goal doesn't wait on the network.
type Run = (action: () => Promise<{ arc: Arc | null }>, optimistic?: Arc) => Promise<void>

function mapGoals(arc: Arc, change: (goal: Goal) => Goal): Arc {
  const tracks = arc.tracks.map((t) => ({ ...t, goals: t.goals.map(change) }))
  const count = (list: Track[]) => list.flatMap((t) => (t.dueToday ? t.goals : [])).filter((g) => g.doneToday).length
  return { ...arc, tracks, today: { ...arc.today, done: arc.today.done + count(tracks) - count(arc.tracks) } }
}

// Ticking a goal ticks its mini tasks along with it.
const withCheckIn = (arc: Arc, goalId: string, done: boolean) =>
  mapGoals(arc, (g) =>
    g.id === goalId ? { ...g, doneToday: done, subtasks: g.subtasks.map((s) => ({ ...s, done })) } : g,
  )

// A goal with mini tasks is done exactly when all of them are.
const withSubtaskCheck = (arc: Arc, subtaskId: string, done: boolean) =>
  mapGoals(arc, (g) => {
    if (!g.subtasks.some((s) => s.id === subtaskId)) return g
    const subtasks = g.subtasks.map((s) => (s.id === subtaskId ? { ...s, done } : s))
    return { ...g, subtasks, doneToday: subtasks.every((s) => s.done) }
  })

export function Today() {
  // undefined = still loading
  const [arc, setArc] = useState<Arc | null>()
  const [startingNew, setStartingNew] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [error, setError] = useState('')

  // Counts requests, so a slow early response can't overwrite a newer one.
  const latest = useRef(0)
  useTitle()

  // Every arc endpoint returns the fresh arc, so one helper handles them all.
  const run: Run = async (action, optimistic) => {
    const id = ++latest.current
    setError('')
    if (optimistic) setArc(optimistic)
    try {
      const res = await action()
      if (id === latest.current) setArc(res.arc)
    } catch (err) {
      setError((err as Error).message)
      // Put back whatever the server really has.
      if (optimistic) api.getArc().then((res) => id === latest.current && setArc(res.arc), () => {})
    }
  }

  useEffect(() => {
    const load = () => {
      const id = ++latest.current
      api.getArc().then(
        (res) => id === latest.current && setArc(res.arc),
        (err: Error) => setError(err.message),
      )
    }
    load()
    // Coming back to the tab picks up a new day, or check-ins made elsewhere.
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (arc === undefined) return error ? <ErrorNote message={error} /> : <Loading />
  if (arc === null || startingNew) {
    return (
      <ArcSetup
        onCreated={(created) => {
          setArc(created)
          setStartingNew(false)
        }}
      />
    )
  }

  const nextBadge = arc.badges.find((b) => !b.earned)
  const notStarted = arc.startsIn > 0
  const [year, month, day] = arc.startDate.split('-').map(Number)
  const startDay = new Date(year, month - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-muted">
            {arc.name} · {arcPhase(arc)}
          </div>
          <h1 className="mt-1 text-[36px] leading-[1.05] font-semibold">
            {arc.isOver
              ? `Finished with ${arc.perfectDays} perfect days`
              : notStarted
                ? `Starts on ${startDay}`
                : arc.today.total === 0 && arc.tracks.some((t) => t.goals.length > 0)
                  ? 'Rest day'
                  : arc.today.done === arc.today.total && arc.today.total > 0
                    ? 'Day locked in'
                    : `${arc.today.done} of ${arc.today.total} done today`}
          </h1>
        </div>
        {arc.isOver ? (
          <button className="btn" onClick={() => setStartingNew(true)}>
            Start next arc
          </button>
        ) : confirmEnd ? (
          <div className="flex items-center gap-2">
            <span className="text-muted">Delete this arc and its progress?</span>
            <button
              className="btn"
              onClick={() => {
                setConfirmEnd(false)
                run(() => api.deleteArc(arc.id))
              }}
            >
              Delete
            </button>
            <button className="btn-outline" onClick={() => setConfirmEnd(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              className="btn-outline"
              title="Downloads a calendar file with a repeating event for each track"
              onClick={() => downloadCalendar(arc)}
            >
              Add to calendar
            </button>
            <button className="btn-outline" onClick={() => setConfirmEnd(true)}>
              End arc
            </button>
          </div>
        )}
      </header>

      <ErrorNote message={error} />
      <StatStrip stats={arcStats(arc)} />

      <div className="flex flex-wrap items-start gap-8">
        <div className="min-w-0 flex-[999_1_420px] space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="h2">
              Tracks <span className="label ml-1.5 font-normal">{weeklyPlan(arc.tracks)} a week</span>
            </h2>
            {notStarted ? (
              <span className="label">Set up your tracks now. Check-ins open on day 1.</span>
            ) : nextBadge && (
              <span className="label">
                {nextBadge.days - arc.streak.current} days to {nextBadge.name}
              </span>
            )}
          </div>
          {arc.tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              canCheckIn={!arc.isOver && !notStarted}
              checkIn={(goalId, done) => run(() => api.checkIn(goalId, done), withCheckIn(arc, goalId, done))}
              checkSubtask={(id, done) => run(() => api.checkSubtask(id, done), withSubtaskCheck(arc, id, done))}
            />
          ))}
          {!arc.isOver && (
            <Link to="/tracks" className="btn-outline">
              Edit tracks
            </Link>
          )}
        </div>

        <aside className="min-w-0 flex-[1_1_300px] space-y-6">
          <ActivityGrid arc={arc} />
          <LevelBar arc={arc} />
          <Rewards arc={arc} />
        </aside>
      </div>
    </div>
  )
}

type TrackCardProps = {
  track: Track
  canCheckIn: boolean
  checkIn: (goalId: string, done: boolean) => void
  checkSubtask: (subtaskId: string, done: boolean) => void
}

// Today is only for ticking things off. Tracks are set up on the Tracks page.
function TrackCard({ track, canCheckIn, checkIn, checkSubtask }: TrackCardProps) {
  // Off-days only matter once check-ins are open.
  const restDay = canCheckIn && !track.dueToday
  const progress = trackProgress(track)
  const locked = !canCheckIn || restDay
  const dim = restDay ? '' : 'disabled:opacity-100'

  return (
    <section className="card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <h3 className="flex-1 font-semibold">{track.name}</h3>
        {progress !== null && (
          <Link to="/tracks" className="font-mono text-[13px] text-muted hover:text-fg" title="Checkpoints done. Open Tracks to tick them.">
            {progress}%
          </Link>
        )}
        <span className="font-mono text-[13px] text-muted">
          {restDay ? 'rest day · ' : ''}
          {track.streak.current}d streak
        </span>
        <span className="label hidden sm:inline">{scheduleSummary(track)}</span>
      </div>

      {track.goals.length === 0 && (
        <p className="label px-4 py-3">
          No daily goals yet.{' '}
          <Link to="/tracks" className="text-fg hover:underline">
            Add some in Tracks
          </Link>
          .
        </p>
      )}

      {track.goals.map((goal) => (
        <div key={goal.id} className="border-b border-line last:border-b-0">
          <button
            className={`flex min-h-11 w-full items-center gap-3 px-4 text-left ${dim}`}
            aria-pressed={goal.doneToday}
            disabled={locked}
            onClick={() => checkIn(goal.id, !goal.doneToday)}
          >
            <Checkbox checked={goal.doneToday} />
            <span className={`flex-1 ${goal.doneToday ? 'text-muted line-through' : ''}`}>{goal.title}</span>
            {goal.subtasks.length > 0 && (
              <span className="font-mono text-[13px] text-muted">
                {goal.subtasks.filter((s) => s.done).length}/{goal.subtasks.length}
              </span>
            )}
            <span className="font-mono text-[13px] text-muted">{goal.streak.current}d</span>
          </button>
          {goal.subtasks.map((sub) => (
            <button
              key={sub.id}
              className={`flex min-h-9 w-full items-center gap-3 pr-4 pl-11 text-left text-[13px] ${dim}`}
              aria-pressed={sub.done}
              disabled={locked}
              onClick={() => checkSubtask(sub.id, !sub.done)}
            >
              <Checkbox checked={sub.done} />
              <span className={sub.done ? 'text-muted line-through' : ''}>{sub.title}</span>
            </button>
          ))}
        </div>
      ))}
    </section>
  )
}
