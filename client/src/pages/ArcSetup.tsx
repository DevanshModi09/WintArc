import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { api, type Arc, type NewTrack, type Season } from '../api'
import { ErrorNote, Lock } from '../components/ArcParts'
import { CheckpointList } from '../components/CheckpointList'
import { DayPlan } from '../components/DayPlan'
import { useFocusedLayout } from '../components/focus'
import { SchedulePicker } from '../components/SchedulePicker'
import { defaultSchedule, scheduleSummary, weeklyPlan } from '../schedule'

const emptyTrack = (): NewTrack => ({ name: '', isPublic: true, checkpoints: [], ...defaultSchedule() })

// Days from today up to and including `date`.
const daysUntil = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((new Date(y, m - 1, d).getTime() - midnight) / 86_400_000) + 1
}

const longDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

export function ArcSetup({ season, onCreated }: { season: Season; onCreated: (arc: Arc | null) => void }) {
  const [tracks, setTracks] = useState<NewTrack[]>([emptyTrack()])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pledging, setPledging] = useState(false)
  // No wandering off to other pages halfway through.
  useFocusedLayout()

  const setTrack = (i: number, changes: Partial<NewTrack>) =>
    setTracks(tracks.map((t, j) => (j === i ? { ...t, ...changes } : t)))

  // Every track needs a name and at least one checkpoint to aim for.
  const ready = tracks.every((t) => t.name.trim() && t.checkpoints.length > 0)

  // Creating the arc is a two-step thing: the button opens the pledge, and
  // only typing it out creates anything.
  function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setPledging(true)
  }

  async function create() {
    setPledging(false)
    setBusy(true)
    try {
      onCreated((await api.createArc({ tracks })).arc)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        {pledging && <Pledge tracks={tracks} ends={longDate(season.endDate)} days={daysUntil(season.endDate)} onConfirm={create} onCancel={() => setPledging(false)} />}
      </AnimatePresence>
      <form onSubmit={submit} className="space-y-8">
        <header className="max-w-[640px]">
          <h1 className="text-[32px] leading-none font-medium sm:text-[40px]">Set up your arc</h1>
          <p className="mt-2 text-muted">
            Split it into tracks like Web Dev, DSA or Badminton. Pick the days each one runs on and the checkpoints you
            want to reach in it. Every track needs at least one. Each day a track runs, your task is the checkpoint you're on: you check in with a
            photo of the work, and finish the checkpoint to move to the next.
          </p>
        </header>

        {/* The plan on the left, and what it does to a day on the right, kept in
            view while scrolling. On a narrow screen the day goes underneath. */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="min-w-0 space-y-8">
            <section className="space-y-3">
              <p className="label">
                Your arc starts today and ends on {longDate(season.endDate)}, like everyone's. The last day to start is{' '}
                {longDate(season.lastStart)}.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="h2">Tracks</h2>
              <p className="text-muted">
                Add only what you can afford to do. Every track here is time out of every day it runs, until 1 January.
              </p>
              {tracks.map((track, i) => (
                <div key={i} className="card">
                  <div className="flex items-center gap-2 border-b border-line p-3">
                    <input
                      className="input"
                      placeholder="Track name"
                      aria-label="Track name"
                      maxLength={40}
                      value={track.name}
                      onChange={(e) => setTrack(i, { name: e.target.value })}
                    />
                    <button type="button" className="btn-outline" onClick={() => setTrack(i, { isPublic: !track.isPublic })}>
                      {track.isPublic ? 'Public' : 'Private'}
                    </button>
                    {tracks.length > 1 && (
                      <button
                        type="button"
                        className="px-2 text-muted hover:text-fg"
                        aria-label="Remove track"
                        onClick={() => setTracks(tracks.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <SchedulePicker value={track} onChange={(changes) => setTrack(i, changes)} />
                  <CheckpointList value={track.checkpoints} onChange={(checkpoints) => setTrack(i, { checkpoints })} />
                </div>
              ))}
              <button
                type="button"
                className="btn-outline"
                onClick={() => setTracks([...tracks, emptyTrack()])}
              >
                Add another track
              </button>
              <p className="label">
                Checkpoints are the milestones you tick once, like "finish arrays" or "ship the auth flow", and they fill the
                track up. Paste a list, like a course outline or a playlist, and each line becomes a checkpoint. Public tracks
                show on your profile, private ones are only visible to you.
              </p>
            </section>

            <ErrorNote message={error} />
            <button className="btn w-full" disabled={busy || !ready}>
              Create my arc
            </button>
            {!ready && <p className="label">Give every track a name and at least one checkpoint to create your arc.</p>}
          </div>
          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <DayPlan tracks={tracks} />
          </aside>
        </div>
      </form>
    </>
  )
}

const PLEDGE = 'i will not back off'

// What someone agrees to, a line at a time, before they see the pledge.
const TERMS = [
  "My arc starts today and runs until {ends}. I can't pause it or end it early.",
  'Every day a track runs, I commit with a message and a photo of the work. No commit means the day is missed, and one missed day takes me off the board.',
  "My tracks and their checkpoints are final. I can add more later, but I can't remove or change them.",
  "I've planned for my worst week, not my best. I can find {weekly} every week, even when I'm tired, busy or not in the mood.",
]

type PledgeProps = { tracks: NewTrack[]; ends: string; days: number; onConfirm: () => void; onCancel: () => void }

// The last thing before an arc exists, in two steps. First the terms, each
// ticked off by hand. Then what's being decided, a nudge to keep it
// realistic, and a line to type out so nobody commits by accident.
function Pledge({ tracks, ends, days, onConfirm, onCancel }: PledgeProps) {
  const [typed, setTyped] = useState('')
  // Capitals and stray spaces don't matter; the words do.
  const matches = typed.trim().replace(/\s+/g, ' ').toLowerCase() === PLEDGE

  // Two warnings, one after the other: first the terms, each ticked off by
  // hand, then the plan itself and the line to type.
  const [step, setStep] = useState<1 | 2>(1)
  const [agreed, setAgreed] = useState<boolean[]>(TERMS.map(() => false))
  const allAgreed = agreed.every(Boolean)

  // The size of the promise, in hours: each week, each day on average, and
  // added up over every day from now to the end.
  const weekly = tracks.reduce((sum, t) => sum + t.days.length * t.minutes, 0)
  const hours = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '0h'
  }
  const commitment = [
    { value: hours(weekly), label: 'every week' },
    { value: hours(weekly / 7), label: 'a day on average' },
    { value: `${Math.round(((weekly / 7) * days) / 60)}h`, label: `in total, over ${days} days` },
  ]

  function submit(e: FormEvent) {
    e.preventDefault()
    if (step === 1) {
      if (allAgreed) setStep(2)
    } else if (matches) onConfirm()
  }

  return (
    <motion.div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.form
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pledge-title"
        className="card flex max-h-[92vh] w-full max-w-[460px] flex-col overflow-hidden shadow-2xl"
      >
        {step === 1 && (
          <>
            <div className="space-y-5 overflow-y-auto p-7">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger/15 text-[18px] leading-none font-medium text-danger">
                  !
                </span>
                <div>
                  <div className="label text-[12px]">Step 1 of 2</div>
                  <h2 id="pledge-title" className="h2 text-xl">
                    Only start if you're serious
                  </h2>
                </div>
              </div>

              <p className="text-[15px] leading-relaxed text-muted">
                This isn't a to-do list you can quietly drop next week. Read each line, and tick it only if you mean it.
              </p>

              <div>
                <div className="label">You're committing to</div>
                <dl className="mt-2 grid grid-cols-3 gap-2">
                  {commitment.map((c, i) => (
                    <div key={c.label} className={`rounded-field px-3 py-3 ${i === 0 ? 'bg-accent/15' : 'bg-subtle'}`}>
                      <dd className="text-xl leading-none font-medium whitespace-nowrap">{c.value}</dd>
                      <dt className="label mt-1.5 text-[12px] leading-tight">{c.label}</dt>
                    </div>
                  ))}
                </dl>
              </div>

              <ul className="space-y-2.5">
                {TERMS.map((term, i) => (
                  <li key={term}>
                    <label
                      className={`flex cursor-pointer gap-3 rounded-field border px-4 py-3 text-[14px] leading-relaxed transition ${
                        agreed[i] ? 'border-accent bg-accent/10' : 'border-line hover:border-fg'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                        checked={agreed[i]}
                        onChange={(e) => setAgreed(agreed.map((a, j) => (j === i ? e.target.checked : a)))}
                      />
                      <span>{term.replace('{ends}', ends).replace('{weekly}', hours(weekly))}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-subtle px-7 py-4">
              <span className="label mr-auto">
                {agreed.filter(Boolean).length} of {TERMS.length} ticked
              </span>
              <button type="button" className="btn-outline" onClick={onCancel}>
                Not yet
              </button>
              <button className="btn disabled:opacity-40" disabled={!allAgreed}>
                I'm serious
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-5 overflow-y-auto p-7">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent [&>svg]:size-4">
                  <Lock />
                </span>
                <div>
                  <div className="label text-[12px]">Step 2 of 2</div>
                  <h2 id="pledge-title" className="h2 text-xl">
                    There's no backing off
                  </h2>
                </div>
              </div>

              <p className="text-[15px] leading-relaxed text-muted">
                This is what you're deciding from today until {ends}. Once it's created you can't end the arc or delete a
                track, and every track's checkpoint list is final. You can add more tracks later.
              </p>

              <section className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-medium">Winter Arc</h3>
                  <span className="font-medium">{weeklyPlan(tracks)} <span className="label font-normal">a week</span></span>
                </div>
                <ul className="divide-y divide-line rounded-field border border-line text-[14px]">
                  {tracks.map((track, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5">
                      <span className="flex-1 font-medium">{track.name.trim()}</span>
                      <span className="label">
                        {track.checkpoints.length === 0
                          ? 'no checkpoints'
                          : `${track.checkpoints.length} ${track.checkpoints.length === 1 ? 'checkpoint' : 'checkpoints'}`}
                      </span>
                      <span className="label w-full">{scheduleSummary(track)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <p className="rounded-field border border-accent/40 bg-accent/10 px-4 py-3 text-[14px] leading-relaxed">
                <span className="font-medium">Be honest with yourself.</span> Don't over-expect and don't set goals you
                can't keep up on your worst week. A plan you actually finish beats an ambitious one you drop on day 9.
              </p>

              <dl className="grid grid-cols-2 gap-3 text-[14px]">
                <div className="rounded-field bg-subtle px-4 py-3">
                  <dt className="label text-[12px]">You still can</dt>
                  <dd className="mt-1 font-medium">Add tracks, finish and reorder checkpoints</dd>
                </div>
                <div className="rounded-field bg-subtle px-4 py-3">
                  <dt className="label text-[12px]">You no longer can</dt>
                  <dd className="mt-1 font-medium">Delete a track, or change its checkpoints</dd>
                </div>
              </dl>

              <label className="block space-y-2">
                <span className="label block">
                  To confirm, type{' '}
                  <span className="rounded-[6px] bg-subtle px-1.5 py-0.5 font-medium text-fg">{PLEDGE}</span>
                </span>
                <span className="relative block">
                  <input
                    autoFocus
                    className={`input h-11 pr-10 ${matches ? 'border-accent focus:border-accent' : ''}`}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-label={`Type ${PLEDGE} to confirm`}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                  />
                  {matches && (
                    <svg
                      className="absolute top-1/2 right-3.5 -translate-y-1/2 text-accent"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-subtle px-7 py-4">
              <button type="button" className="btn-outline" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn disabled:opacity-40" disabled={!matches}>
                Create my arc
              </button>
            </div>
          </>
        )}
      </motion.form>
    </motion.div>
  )
}
