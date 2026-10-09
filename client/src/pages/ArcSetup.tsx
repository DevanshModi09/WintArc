import { useState, type FormEvent } from 'react'
import { api, type Arc, type NewTrack } from '../api'
import { ErrorNote } from '../components/ArcParts'
import { CheckpointList, CheckpointWarning } from '../components/CheckpointList'
import { SchedulePicker } from '../components/SchedulePicker'
import { defaultSchedule } from '../schedule'

const emptyTrack = (): NewTrack => ({ name: '', isPublic: true, checkpoints: [], ...defaultSchedule() })

export function ArcSetup({ onCreated }: { onCreated: (arc: Arc | null) => void }) {
  const [name, setName] = useState('Winter Arc')
  const [tracks, setTracks] = useState<NewTrack[]>([emptyTrack()])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const setTrack = (i: number, changes: Partial<NewTrack>) =>
    setTracks(tracks.map((t, j) => (j === i ? { ...t, ...changes } : t)))

  const ready = name.trim() && tracks.every((t) => t.name.trim())

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      onCreated((await api.createArc({ name, tracks })).arc)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-[560px] space-y-8">
      <header>
        <h1 className="text-[40px] leading-none font-medium">Set up your arc</h1>
        <p className="mt-2 text-muted">
          Split it into tracks like Web Dev, DSA or Badminton. Pick the days each one runs on and the checkpoints you
          want to reach in it. You'll add your daily goals on Today once the arc is created.
        </p>
      </header>

      <section className="space-y-3">
        <label className="block space-y-1.5">
          <span className="label">Arc name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </label>
        <p className="label">Every arc runs for 90 days, starting on 1 November.</p>
      </section>

      <section className="space-y-3">
        <h2 className="h2">Tracks</h2>
        <CheckpointWarning />
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
    </form>
  )
}
