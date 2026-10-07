import { useState, type FormEvent } from 'react'
import { api, type Arc, type NewTrack } from '../api'
import { ErrorNote } from '../components/ArcParts'

const emptyTrack = (): NewTrack => ({ name: '', isPublic: true, goals: [] })

export function ArcSetup({ onCreated }: { onCreated: (arc: Arc | null) => void }) {
  const [name, setName] = useState('Winter Arc')
  const [tracks, setTracks] = useState<NewTrack[]>([emptyTrack()])
  const [drafts, setDrafts] = useState<string[]>([''])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const setTrack = (i: number, changes: Partial<NewTrack>) =>
    setTracks(tracks.map((t, j) => (j === i ? { ...t, ...changes } : t)))
  const setDraft = (i: number, value: string) => setDrafts(drafts.map((d, j) => (j === i ? value : d)))

  function addGoal(i: number) {
    const title = drafts[i].trim()
    if (!title) return
    setTrack(i, { goals: [...tracks[i].goals, { title }] })
    setDraft(i, '')
  }

  const ready = name.trim() && tracks.every((t) => t.name.trim() && t.goals.length > 0)

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
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Set up your arc</h1>
        <p className="mt-2 text-muted">
          Split it into tracks like Web Dev, DSA or Badminton, and give each one the goals you'll hit every day.
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
                  onClick={() => {
                    setTracks(tracks.filter((_, j) => j !== i))
                    setDrafts(drafts.filter((_, j) => j !== i))
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            {track.goals.map((goal, g) => (
              <div key={g} className="flex min-h-11 items-center gap-3 border-b border-line px-4">
                <span className="flex-1">{goal.title}</span>
                <button
                  type="button"
                  className="text-muted hover:text-fg"
                  aria-label={`Remove ${goal.title}`}
                  onClick={() => setTrack(i, { goals: track.goals.filter((_, j) => j !== g) })}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex items-center gap-3 px-4">
              <span className="text-muted">+</span>
              <input
                className="h-11 flex-1 bg-transparent outline-none placeholder:text-muted"
                placeholder="Add a daily goal, then press Enter"
                aria-label="Add a daily goal"
                maxLength={80}
                value={drafts[i]}
                onChange={(e) => setDraft(i, e.target.value)}
                onBlur={() => addGoal(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addGoal(i)
                  }
                }}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn-outline"
          onClick={() => {
            setTracks([...tracks, emptyTrack()])
            setDrafts([...drafts, ''])
          }}
        >
          Add another track
        </button>
        <p className="label">Public tracks show on your profile. Private tracks are only visible to you.</p>
      </section>

      <ErrorNote message={error} />
      <button className="btn w-full" disabled={busy || !ready}>
        Create my arc
      </button>
    </form>
  )
}
