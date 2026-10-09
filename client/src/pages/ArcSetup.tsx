import { useState, type ClipboardEvent, type FormEvent } from 'react'
import { api, type Arc, type NewTrack } from '../api'
import { parseCheckpoints } from '../checkpoints'
import { ErrorNote } from '../components/ArcParts'
import { SchedulePicker } from '../components/SchedulePicker'
import { defaultSchedule } from '../schedule'

// Matches the server's limit.
const MAX_CHECKPOINTS = 30

const emptyTrack = (): NewTrack => ({ name: '', isPublic: true, checkpoints: [], ...defaultSchedule() })

export function ArcSetup({ onCreated }: { onCreated: (arc: Arc | null) => void }) {
  const [name, setName] = useState('Winter Arc')
  const [tracks, setTracks] = useState<NewTrack[]>([emptyTrack()])
  const [drafts, setDrafts] = useState<string[]>([''])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const setTrack = (i: number, changes: Partial<NewTrack>) =>
    setTracks(tracks.map((t, j) => (j === i ? { ...t, ...changes } : t)))
  const setDraft = (i: number, value: string) => setDrafts(drafts.map((d, j) => (j === i ? value : d)))

  function addCheckpoint(i: number) {
    const title = drafts[i].trim()
    if (!title) return
    setTrack(i, { checkpoints: [...tracks[i].checkpoints, title] })
    setDraft(i, '')
  }

  // Pasting a list adds every line of it as a checkpoint, up to the limit.
  function pasteCheckpoints(i: number, e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    if (!text.includes('\n')) return
    const titles = parseCheckpoints(text)
    if (titles.length === 0) return
    e.preventDefault()
    setTrack(i, { checkpoints: [...tracks[i].checkpoints, ...titles].slice(0, MAX_CHECKPOINTS) })
  }

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
            <SchedulePicker value={track} onChange={(changes) => setTrack(i, changes)} />
            {track.checkpoints.map((checkpoint, c) => (
              <div key={c} className="flex min-h-11 items-center gap-3 border-b border-line px-4">
                <span className="flex-1">{checkpoint}</span>
                <button
                  type="button"
                  className="text-muted hover:text-fg"
                  aria-label={`Remove ${checkpoint}`}
                  onClick={() => setTrack(i, { checkpoints: track.checkpoints.filter((_, j) => j !== c) })}
                >
                  ✕
                </button>
              </div>
            ))}
            {track.checkpoints.length < MAX_CHECKPOINTS && (
              <div className="flex items-center gap-3 px-4">
                <span className="text-muted">+</span>
                <input
                  className="h-11 flex-1 bg-transparent outline-none placeholder:text-muted"
                  placeholder="Add a checkpoint, or paste a whole list"
                  aria-label="Add a checkpoint"
                  maxLength={80}
                  value={drafts[i]}
                  onChange={(e) => setDraft(i, e.target.value)}
                  onPaste={(e) => pasteCheckpoints(i, e)}
                  onBlur={() => addCheckpoint(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCheckpoint(i)
                    }
                  }}
                />
              </div>
            )}
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
        <p className="label">
          Checkpoints are the milestones you tick once, like "finish arrays" or "ship the auth flow", and they fill the
          track up. Paste a list, like a course outline or a playlist, and each line becomes a checkpoint. Public tracks show on your profile, private ones are only visible to you. You can add, reorder and
          remove checkpoints later on the Tracks page.
        </p>
      </section>

      <ErrorNote message={error} />
      <button className="btn w-full" disabled={busy || !ready}>
        Create my arc
      </button>
    </form>
  )
}
