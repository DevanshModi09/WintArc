import { useEffect, useState, type FormEvent } from 'react'
import { api, type Arc, type Track } from '../api'
import { arcPhase, arcStats } from '../arcStats'
import { ActivityGrid, Checkbox, ErrorNote, LevelBar, Rewards, StatStrip } from '../components/ArcParts'
import { ArcSetup } from './ArcSetup'

type Run = (action: () => Promise<{ arc: Arc | null }>) => Promise<void>

export function Today() {
  // undefined = still loading
  const [arc, setArc] = useState<Arc | null>()
  const [startingNew, setStartingNew] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [error, setError] = useState('')

  // Every arc endpoint returns the fresh arc, so one helper handles them all.
  const run: Run = async (action) => {
    setError('')
    try {
      setArc((await action()).arc)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    api
      .getArc()
      .then((res) => setArc(res.arc))
      .catch((err: Error) => setError(err.message))
  }, [])

  if (arc === undefined) return <ErrorNote message={error} />
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
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em]">
            {arc.isOver
              ? `Finished with ${arc.perfectDays} perfect days`
              : notStarted
                ? `Starts on ${startDay}`
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
          <button className="btn-outline" onClick={() => setConfirmEnd(true)}>
            End arc
          </button>
        )}
      </header>

      <ErrorNote message={error} />
      <StatStrip stats={arcStats(arc)} />

      <div className="flex flex-wrap items-start gap-8">
        <div className="min-w-0 flex-[999_1_420px] space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="h2">Tracks</h2>
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
            />
          ))}
          {!arc.isOver && <NewTrack run={run} />}
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

type TrackCardProps = { track: Track; editable: boolean; canCheckIn: boolean; run: Run }

function TrackCard({ track, editable, canCheckIn, run }: TrackCardProps) {
  const [draft, setDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function addGoal(e: FormEvent) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    setDraft('')
    run(() => api.addGoal(track.id, title))
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <h3 className="flex-1 font-semibold">{track.name}</h3>
        <span className="font-mono text-[13px] text-muted">{track.streak.current}d streak</span>
        <button
          className="rounded-md border border-line px-2 py-1 text-[13px] hover:border-fg"
          title={track.isPublic ? 'Visible on your profile. Click to make private.' : 'Only you can see this. Click to make public.'}
          onClick={() => run(() => api.updateTrack(track.id, { isPublic: !track.isPublic }))}
        >
          {track.isPublic ? 'Public' : 'Private'}
        </button>
        {confirmDelete ? (
          <>
            <button className="text-[13px] font-medium text-danger" onClick={() => run(() => api.deleteTrack(track.id))}>
              Delete track
            </button>
            <button className="text-[13px] text-muted" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="px-1 text-muted hover:text-fg" aria-label={`Delete ${track.name}`} onClick={() => setConfirmDelete(true)}>
            ✕
          </button>
        )}
      </div>

      {track.goals.map((goal) => (
        <div key={goal.id} className="flex items-center border-b border-line last:border-b-0">
          <button
            className="flex min-h-11 flex-1 items-center gap-3 px-4 text-left disabled:opacity-100"
            aria-pressed={goal.doneToday}
            disabled={!canCheckIn}
            onClick={() => run(() => api.checkIn(goal.id, !goal.doneToday))}
          >
            <Checkbox checked={goal.doneToday} />
            <span className={`flex-1 ${goal.doneToday ? 'text-muted line-through' : ''}`}>{goal.title}</span>
            <span className="font-mono text-[13px] text-muted">{goal.streak.current}d</span>
          </button>
          <button
            className="px-4 text-muted hover:text-fg"
            aria-label={`Delete ${goal.title}`}
            onClick={() => run(() => api.deleteGoal(goal.id))}
          >
            ✕
          </button>
        </div>
      ))}

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

function NewTrack({ run }: { run: Run }) {
  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(true)

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setName('')
    run(() => api.addTrack({ name: trimmed, isPublic }))
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        className="input min-w-40 flex-1"
        placeholder="New track, e.g. Web Dev"
        aria-label="New track name"
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="button" className="btn-outline" onClick={() => setIsPublic(!isPublic)}>
        {isPublic ? 'Public' : 'Private'}
      </button>
      <button className="btn" disabled={!name.trim()}>
        Add track
      </button>
    </form>
  )
}
