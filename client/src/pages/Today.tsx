import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, today, type Arc, type Goal, type Proof, type Track, type User } from '../api'
import { Link } from 'react-router-dom'
import { MILESTONES, arcPhase, arcStats, milestoneUnlocked, survivorLabel, trackProgress } from '../arcStats'
import { ActivityGrid, Checkbox, ErrorNote, LevelBar, Loading, Lock, Rewards, StatStrip } from '../components/ArcParts'
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

export function Today({ user, onUser }: { user: User; onUser: (user: User) => void }) {
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
  const standing = survivorLabel(arc)
  const notStarted = arc.startsIn > 0
  const [year, month, day] = arc.startDate.split('-').map(Number)
  const startDay = new Date(year, month - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">
            {arc.name} · {arcPhase(arc)}
            {standing && (
              <>
                {' · '}
                <Link to="/board" className="hover:text-fg">
                  {standing}
                </Link>
              </>
            )}
          </div>
          <h1 className="mt-3 text-[40px] leading-none font-medium">
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
          <div className="flex items-center gap-2">
            <Link to="/wrapped" className="btn">
              See your wrapped
            </Link>
            <button className="btn-outline" onClick={() => setStartingNew(true)}>
              Start next arc
            </button>
          </div>
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
              <span className="label">Set up your goals now. They lock in once the arc is running.</span>
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
          {!arc.isOver && !notStarted && (
            <ReflectionCard
              key={today()}
              saved={arc.reflections?.find((r) => r.date === today())?.text ?? ''}
              count={arc.reflections?.length ?? 0}
              save={(text) => run(() => api.setReflection(text))}
            />
          )}
        </div>

        <aside className="min-w-0 flex-[1_1_300px] space-y-6">
          <ActivityGrid arc={arc} />
          <LevelBar arc={arc} />
          <Rewards arc={arc} />
          {!notStarted && (
            <section className="space-y-2.5">
              <h2 className="h2">Milestones</h2>
              <div className="flex flex-wrap gap-2 font-mono text-[13px]">
                {MILESTONES.map((m) =>
                  milestoneUnlocked(arc, m) ? (
                    <Link key={m} to={`/wrapped?day=${m}`} className="rounded-full bg-fg px-3 py-1.5 text-bg hover:bg-fg/80">
                      Day {m} card
                    </Link>
                  ) : (
                    <span key={m} title={`Unlocks after day ${m}`} className="rounded-full border border-dashed border-muted/50 px-3 py-1.5 text-muted">
                      Day {m} card
                    </span>
                  ),
                )}
                <Link to="/wrapped" className="rounded-full border border-line px-3 py-1.5 hover:border-fg">
                  {arc.isOver ? 'Final wrap' : 'Arc so far'}
                </Link>
              </div>
            </section>
          )}
          <SharePage user={user} onUser={onUser} />
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

type ReflectionProps = { saved: string; count: number; save: (text: string) => void }

// One line about today. They pile up into a journal on the wrap.
function ReflectionCard({ saved, count, save }: ReflectionProps) {
  const [text, setText] = useState(saved)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (text.trim() !== saved) save(text.trim())
  }

  return (
    <section className="space-y-2.5 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="h2">Tonight's line</h2>
        <span className="label">
          {count > 0 ? (
            <Link to="/wrapped" className="hover:text-fg">
              {count} {count === 1 ? 'day' : 'days'} written →
            </Link>
          ) : (
            'Only you can see this'
          )}
        </span>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="input"
          placeholder="What did you do today, or what got in the way?"
          aria-label="One line about today"
          maxLength={280}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn" disabled={text.trim() === saved}>
          {saved ? 'Update' : 'Save'}
        </button>
      </form>
    </section>
  )
}

// A switch for the page anyone can open without an account, and its link.
function SharePage({ user, onUser }: { user: User; onUser: (user: User) => void }) {
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/c/${user.username}`

  const toggle = () =>
    api.setSharing(!user.sharePublic).then(
      (res) => onUser(res.user),
      (err: Error) => setError(err.message),
    )

  const copy = () =>
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => setError("Couldn't copy the link"),
    )

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="h2">Public page</h2>
        <button className="label hover:text-fg" role="switch" aria-checked={user.sharePublic} onClick={toggle}>
          {user.sharePublic ? 'On · turn off' : 'Off · turn on'}
        </button>
      </div>
      {user.sharePublic ? (
        <>
          <p className="label">Anyone with this link can see your arc and public tracks, without an account.</p>
          <div className="flex gap-2">
            <Link to={`/c/${user.username}`} className="input flex min-w-0 items-center truncate font-mono text-[13px]">
              /c/{user.username}
            </Link>
            <button className="btn-outline" onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </>
      ) : (
        <p className="label">Turn this on to get a link you can post: your commitment and your live grid, for anyone to see.</p>
      )}
      <ErrorNote message={error} />
    </section>
  )
}

// Daily goals are added, edited and ticked here. The track itself (name,
// schedule, checkpoints) is set up on the Tracks page.
function TrackCard({ track, editable, canCheckIn, run, checkIn, checkSubtask }: TrackCardProps) {
  const [draft, setDraft] = useState('')
  const [renaming, setRenaming] = useState<string>()
  // The goal that has its "add a mini task" field open.
  const [addingTo, setAddingTo] = useState<string>()
  const [subDraft, setSubDraft] = useState('')
  // The goal that has its proof form open.
  const [proving, setProving] = useState<string>()
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
              {editable && goal.doneToday && !locked && (
                <button
                  className="px-2 text-[13px] text-muted hover:text-fg"
                  aria-expanded={proving === goal.id}
                  onClick={() => setProving(proving === goal.id ? undefined : goal.id)}
                >
                  {goal.proof ? 'Edit proof' : 'Add proof'}
                </button>
              )}
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
                  {goal.locked ? (
                    <span className="py-2 pr-4 pl-2 text-muted" title="Locked in for the arc. You can add to it, but not change or remove it.">
                      <Lock />
                      <span className="sr-only">Locked in</span>
                    </span>
                  ) : (
                    <>
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
                </>
              )}
            </div>
            {proving === goal.id && goal.doneToday ? (
              <ProofForm
                proof={goal.proof}
                onCancel={() => setProving(undefined)}
                onSave={(proof) => {
                  setProving(undefined)
                  run(() => api.setProof(goal.id, proof))
                }}
              />
            ) : (
              goal.proof && <ProofLine proof={goal.proof} />
            )}
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
                {editable && !goal.locked && (
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

// The proof shown under a ticked goal.
function ProofLine({ proof }: { proof: Proof }) {
  return (
    <p className="pr-4 pb-2.5 pl-11 text-[13px] break-words text-muted">
      {proof.note}
      {proof.note && proof.link && ' · '}
      {proof.link && (
        <a href={proof.link} target="_blank" rel="noreferrer noopener" className="text-fg underline underline-offset-2">
          {proof.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}
        </a>
      )}
    </p>
  )
}

type ProofFormProps = { proof: Proof | null; onSave: (proof: { note: string; link: string }) => void; onCancel: () => void }

function ProofForm({ proof, onSave, onCancel }: ProofFormProps) {
  const [note, setNote] = useState(proof?.note ?? '')
  const [link, setLink] = useState(proof?.link ?? '')

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({ note: note.trim(), link: link.trim() })
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 pr-4 pb-3 pl-11" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <input
        autoFocus
        className="input h-9 min-w-48 flex-[2] text-[13px]"
        placeholder="What did you do?"
        aria-label="A line about what you did"
        maxLength={200}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <input
        className="input h-9 min-w-40 flex-1 text-[13px]"
        type="url"
        placeholder="Link (commit, post, video)"
        aria-label="A link to it"
        maxLength={300}
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />
      <button className="btn h-9">Save</button>
    </form>
  )
}
