import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, today, type Arc, type ArcResponse, type Season, type Track, type User } from '../api'
import { MILESTONES, arcPhase, arcStats, milestoneUnlocked, survivorLabel, trackProgress } from '../arcStats'
import { ActivityGrid, ErrorNote, LevelBar, Loading, Rewards, StatLine } from '../components/ArcParts'
import { downloadCalendar } from '../calendar'
import { DeviceSettings } from '../components/DeviceSettings'
import { Rise } from '../components/Motion'
import { ProofPhoto } from '../components/ProofPhoto'
import { uploadProof } from '../proof'
import { scheduleSummary, weeklyPlan } from '../schedule'
import { useTitle } from '../useTitle'
import { ArcSetup } from './ArcSetup'

type Run = (action: () => Promise<ArcResponse>) => Promise<void>

const longDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

export function Today({ user, onUser }: { user: User; onUser: (user: User) => void }) {
  // undefined = still loading
  const [arc, setArc] = useState<Arc | null>()
  const [season, setSeason] = useState<Season>()
  const [startingNew, setStartingNew] = useState(false)
  const [error, setError] = useState('')

  // Counts requests, so a slow early response can't overwrite a newer one.
  const latest = useRef(0)
  useTitle()

  const show = (res: ArcResponse) => {
    setArc(res.arc)
    setSeason(res.season)
  }

  // Every arc endpoint returns the fresh arc, so one helper handles them all.
  const run: Run = async (action) => {
    const id = ++latest.current
    setError('')
    try {
      const res = await action()
      if (id === latest.current) show(res)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    const load = () => {
      const id = ++latest.current
      api.getArc().then(
        (res) => id === latest.current && show(res),
        (err: Error) => setError(err.message),
      )
    }
    load()
    // Coming back to the tab picks up a new day, or check-ins made elsewhere.
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (arc === undefined || !season) return error ? <ErrorNote message={error} /> : <Loading />
  if (arc === null || startingNew) {
    if (!season.canStart) return <Closed season={season} />
    return (
      <ArcSetup
        season={season}
        onCreated={(created) => {
          setArc(created)
          setStartingNew(false)
        }}
      />
    )
  }

  const nextBadge = arc.badges.find((b) => !b.earned)
  const standing = survivorLabel(arc)
  const due = arc.tracks.filter((t) => t.dueToday)

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
          <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-3">
            <h1 className="text-[32px] leading-none font-medium sm:text-[40px]">
              {arc.isOver
                ? `Finished with ${arc.perfectDays} perfect days`
                : arc.startsIn > 0
                  ? arc.startsIn === 1
                    ? 'Your arc starts tomorrow'
                    : `Your arc starts in ${arc.startsIn} days`
                  : due.length === 0
                  ? 'Rest day'
                  : arc.today.done === arc.today.total
                    ? 'Day locked in'
                    : `${arc.today.done} of ${arc.today.total} done today`}
            </h1>
            <StatLine stats={arcStats(arc)} />
          </div>
        </div>
        {arc.isOver ? (
          <div className="flex items-center gap-2">
            <Link to="/wrapped" className="btn">
              See your wrapped
            </Link>
            {season.canStart && (
              <button className="btn-outline" onClick={() => setStartingNew(true)}>
                Start next arc
              </button>
            )}
          </div>
        ) : (
          <button
            className="btn-outline"
            title="Downloads a calendar file with a repeating event for each track"
            onClick={() => downloadCalendar(arc)}
          >
            Add to calendar
          </button>
        )}
      </header>

      <ErrorNote message={error} />

      <div className="flex flex-wrap items-start gap-8">
        <div className="min-w-0 flex-[999_1_420px] space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="h2">
              Tracks <span className="label ml-1.5 font-normal">{weeklyPlan(arc.tracks)} a week</span>
            </h2>
            {nextBadge && !arc.isOver && (
              <span className="label">
                {nextBadge.days - arc.streak.current} days to {nextBadge.name}
              </span>
            )}
          </div>
          {arc.tracks.map((track, i) => (
            <Rise key={track.id} index={i}>
              <TrackCard track={track} open={!arc.isOver && arc.startsIn === 0} run={run} />
            </Rise>
          ))}
          {!arc.isOver && (
            <Link to="/tracks" className="btn-outline">
              All checkpoints
            </Link>
          )}
          {!arc.isOver && arc.startsIn === 0 && (
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
          <DeviceSettings />
          <SharePage user={user} onUser={onUser} />
        </aside>
      </div>
    </div>
  )
}

// What someone without an arc sees when it's too late, or too early, to start.
function Closed({ season }: { season: Season }) {
  const missed = today() > season.lastStart
  return (
    <div className="mx-auto max-w-[560px] space-y-4 py-16 text-center">
      <div className="eyebrow justify-center">Winter Arc</div>
      <h1 className="text-[32px] leading-none font-medium sm:text-[40px]">{missed ? 'Come back next year' : 'Not open yet'}</h1>
      <p className="text-muted">
        {missed
          ? `The last day to start this year's arc was ${longDate(season.lastStart)}. Everyone who's in runs until ${longDate(season.endDate)}, and the next arc opens on 1 October.`
          : `The arc opens on ${longDate(season.opens)}. You can start any day up to ${longDate(season.lastStart)}, and it runs until ${longDate(season.endDate)}.`}
      </p>
      <Link to="/board" className="btn-outline">
        See who's in
      </Link>
    </div>
  )
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

// One track for today. The task is whichever checkpoint the track is up to:
// commit with a message saying what you did and a photo of the work, and
// finish the checkpoint when it's done to move on to the next.
function TrackCard({ track, open, run }: { track: Track; open: boolean; run: Run }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const progress = trackProgress(track)
  const { active } = track
  const next = active && track.checkpoints[active.number]
  // Replacing the photo keeps the message that's already there.
  const message = note.trim() || (track.proof?.note ?? '')

  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Clear the input so picking the same file again still fires a change.
    e.target.value = ''
    if (!file) return
    setBusy(true)
    await run(async () =>
      api.checkIn(track.id, { photo: await uploadProof(file), note: message }),
    )
    setNote('')
    setBusy(false)
  }

  let kicker = "Today's session"
  if (track.complete) kicker = 'Every checkpoint finished'
  else if (active) kicker = `Checkpoint ${active.number} of ${track.checkpoints.length}`

  return (
    <section className="card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <h3 className="flex-1 font-semibold">{track.name}</h3>
        {progress !== null && (
          <Link to="/tracks" className="font-mono text-[13px] text-muted hover:text-fg" title="Checkpoints finished">
            {progress}%
          </Link>
        )}
        <span className="font-mono text-[13px] text-muted">{track.streak.current}d streak</span>
        <span className="label hidden sm:inline">{scheduleSummary(track)}</span>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="label">{kicker}</div>
          <div className="mt-1 text-xl leading-tight font-medium">{active?.title ?? (track.complete ? 'Track complete' : track.name)}</div>
        </div>

        <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickPhoto} />

        {track.doneToday && track.proof ? (
          <div className="flex flex-wrap items-center gap-4">
            <ProofPhoto path={track.proof.photo} alt="Today's proof" className="size-20 rounded-field" />
            <div className="min-w-0 flex-1">
              <div className="label">Committed today</div>
              {track.proof.note && <p className="mt-0.5 font-medium break-words">{track.proof.note}</p>}
              <p className="label mt-1">Only you can see this photo.</p>
            </div>
            {open && (
              <button className="label hover:text-fg" disabled={busy} onClick={() => fileInput.current?.click()}>
                {busy ? 'Uploading…' : 'Replace photo'}
              </button>
            )}
          </div>
        ) : !open ? null : !track.dueToday ? (
          <p className="label">{track.complete ? 'Nothing more to do on this track.' : 'Not scheduled today. Rest up.'}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <input
              className="input min-w-48 flex-1"
              placeholder="Commit message: what did you do?"
              aria-label={`Commit message for today's work on ${track.name}`}
              required
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              className="btn"
              disabled={busy || !message}
              title={message ? undefined : 'Write a commit message first'}
              onClick={() => fileInput.current?.click()}
            >
              {busy ? 'Uploading…' : 'Add photo and commit'}
            </button>
            <p className="label w-full">
              Friends see your message. The photo stays private: it's your proof, and only you can see it.
            </p>
          </div>
        )}
      </div>

      {open && active && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3">
          {finishing ? (
            <>
              <span className="flex-1 text-[14px]">
                Finish “{active.title}”? {next ? `Next up: ${next.title}.` : "That's the last one on this track."}
              </span>
              <button
                className="btn h-9"
                onClick={() => {
                  setFinishing(false)
                  run(() => api.tickCheckpoint(active.id, true))
                }}
              >
                Finish it
              </button>
              <button className="btn-outline h-9" onClick={() => setFinishing(false)}>
                Not yet
              </button>
            </>
          ) : (
            <>
              <span className="label flex-1">{next ? `Next up: ${next.title}` : 'Last checkpoint on this track'}</span>
              <button className="btn-outline h-9" onClick={() => setFinishing(true)}>
                Finish this checkpoint
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
