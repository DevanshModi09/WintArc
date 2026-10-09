import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, type Arc, type Goal, type Track } from '../api'
import { Link } from 'react-router-dom'
import { arcPhase, arcStats, trackProgress } from '../arcStats'
import { ActivityGrid, Checkbox, ErrorNote, LevelBar, Loading, Rewards, StatStrip } from '../components/ArcParts'
import { downloadCalendar } from '../calendar'
import { Pencil, Rename } from '../components/Rename'
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
              editable={!arc.isOver}
              canCheckIn={!arc.isOver && !notStarted}
              run={run}
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
  editable: boolean
  canCheckIn: boolean
  run: Run
  checkIn: (goalId: string, done: boolean) => void
  checkSubtask: (subtaskId: string, done: boolean) => void
}

// Daily goals are added, edited and ticked here. The track itself (name,
// schedule, checkpoints) is set up on the Tracks page.
function TrackCard({ track, editable, canCheckIn, run, checkIn, checkSubtask }: TrackCardProps) {
  const [draft, setDraft] = useState('')
  const [renaming, setRenaming] = useState<string>()
  // The goal that has its "add a mini task" field open.
  const [addingTo, setAddingTo] = useState<string>()
  const [subDraft, setSubDraft] = useState('')
  // Off-days only matter once check-ins are open.
  const restDay = canCheckIn && !track.dueToday
  const progress = trackProgress(track)
  const locked = !canCheckIn || restDay
  const dim = restDay ? '' : 'disabled:opacity-100'

  function addGoal(e: FormEvent) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    setDraft('')
    run(() => api.addGoal(track.id, title))
  }

  function addSubtask(e: FormEvent, goalId: string) {
    e.preventDefault()
    const title = subDraft.trim()
    if (!title) return setAddingTo(undefined)
    setSubDraft('')
    run(() => api.addSubtask(goalId, title))
  }

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

      {track.goals.map((goal) =>
        renaming === goal.id ? (
          <div key={goal.id} className="flex min-h-11 items-center border-b border-line px-4">
            <Rename
              value={goal.title}
              label="Goal"
              maxLength={80}
              onCancel={() => setRenaming(undefined)}
              onSave={(title) => {
                setRenaming(undefined)
                run(() => api.renameGoal(goal.id, title))
              }}
            />
          </div>
        ) : (
          <div key={goal.id} className="border-b border-line last:border-b-0">
            <div className="flex items-center">
              <button
                className={`flex min-h-11 flex-1 items-center gap-3 px-4 text-left ${dim}`}
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
              {editable && (
                <>
                  <button
                    className="px-2 text-muted hover:text-fg"
                    aria-label={`Add a mini task to ${goal.title}`}
                    title="Add a mini task"
                    aria-expanded={addingTo === goal.id}
                    onClick={() => {
                      setSubDraft('')
                      setAddingTo(addingTo === goal.id ? undefined : goal.id)
                    }}
                  >
                    +
                  </button>
                  <button className="px-2 text-muted hover:text-fg" aria-label={`Rename ${goal.title}`} onClick={() => setRenaming(goal.id)}>
                    <Pencil />
                  </button>
                  <button
                    className="py-2 pr-4 pl-2 text-muted hover:text-fg"
                    aria-label={`Delete ${goal.title}`}
                    onClick={() => run(() => api.deleteGoal(goal.id))}
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
            {goal.subtasks.map((sub) => (
              <div key={sub.id} className="flex items-center">
                <button
                  className={`flex min-h-9 flex-1 items-center gap-3 pr-4 pl-11 text-left text-[13px] ${dim}`}
                  aria-pressed={sub.done}
                  disabled={locked}
                  onClick={() => checkSubtask(sub.id, !sub.done)}
                >
                  <Checkbox checked={sub.done} />
                  <span className={sub.done ? 'text-muted line-through' : ''}>{sub.title}</span>
                </button>
                {editable && (
                  <button
                    className="py-1 pr-4 pl-2 text-[13px] text-muted hover:text-fg"
                    aria-label={`Delete ${sub.title}`}
                    onClick={() => run(() => api.deleteSubtask(sub.id))}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {addingTo === goal.id && (
              <form onSubmit={(e) => addSubtask(e, goal.id)} className="flex items-center gap-3 pr-4 pl-11">
                <span className="w-4 text-center text-muted">+</span>
                <input
                  autoFocus
                  className="h-9 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
                  placeholder="Add a mini task, then press Enter"
                  aria-label={`Mini task for ${goal.title}`}
                  maxLength={60}
                  value={subDraft}
                  onChange={(e) => setSubDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setAddingTo(undefined)}
                />
              </form>
            )}
          </div>
        ),
      )}

      {editable && (
        <form onSubmit={addGoal} className="flex items-center gap-3 px-4">
          <span className="w-4 text-center text-muted">+</span>
          <input
            className="h-11 flex-1 bg-transparent outline-none placeholder:text-muted"
            placeholder="Add a daily goal"
            aria-label={`Add a daily goal to ${track.name}`}
            maxLength={80}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </form>
      )}
    </section>
  )
}
