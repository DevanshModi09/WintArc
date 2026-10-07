import { useState, type FormEvent } from 'react'
import { api, type Arc, type NewGoal } from '../api'

const DURATIONS = [30, 60, 90]

const SUGGESTIONS: NewGoal[] = [
  { emoji: '💪', title: 'Workout' },
  { emoji: '📖', title: 'Read 10 pages' },
  { emoji: '🧠', title: 'Deep work 2h' },
  { emoji: '🚿', title: 'Cold shower' },
  { emoji: '🥗', title: 'Eat clean' },
  { emoji: '😴', title: 'Sleep by 11' },
  { emoji: '📵', title: 'No doomscrolling' },
  { emoji: '🚶', title: '10k steps' },
]

export function ArcSetup({ onCreated }: { onCreated: (arc: Arc | null) => void }) {
  const [name, setName] = useState('Winter Arc')
  const [days, setDays] = useState(90)
  const [goals, setGoals] = useState<NewGoal[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const has = (title: string) => goals.some((g) => g.title.toLowerCase() === title.toLowerCase())

  function addDraft() {
    const title = draft.trim()
    if (title && !has(title)) setGoals([...goals, { title }])
    setDraft('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await api.createArc({ name, days, goals })
      onCreated(res.arc)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Set up your arc</h1>
        <p className="mt-2 text-white/50">Pick what you'll do every single day. Keep it honest.</p>
      </div>

      <div className="card space-y-4">
        <div>
          <div className="label mb-2">Arc name</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
        <div>
          <div className="label mb-2">Length</div>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`cursor-pointer rounded-xl border px-3 py-3 font-semibold transition ${
                  days === d
                    ? 'border-ice bg-ice/15 text-ice'
                    : 'border-white/10 bg-white/5 text-white/60 hover:text-frost'
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="label">Daily goals</div>

        {goals.length > 0 && (
          <ul className="space-y-2">
            {goals.map((g) => (
              <li key={g.title} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
                <span>{g.emoji ?? '🎯'}</span>
                <span className="flex-1">{g.title}</span>
                <button
                  type="button"
                  aria-label={`Remove ${g.title}`}
                  className="cursor-pointer text-white/30 hover:text-rose-300"
                  onClick={() => setGoals(goals.filter((x) => x !== g))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Add your own goal"
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addDraft()
              }
            }}
          />
          <button type="button" className="btn" onClick={addDraft} disabled={!draft.trim()}>
            Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.filter((s) => !has(s.title)).map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setGoals([...goals, s])}
              className="cursor-pointer rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/60 transition hover:border-ice/50 hover:text-frost"
            >
              {s.emoji} {s.title}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-center text-sm text-rose-300">{error}</p>}
      <button className="btn w-full" disabled={busy || goals.length === 0 || !name.trim()}>
        Lock in for {days} days
      </button>
    </form>
  )
}
