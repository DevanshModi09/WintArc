import { useEffect, useState, type ReactNode } from 'react'
import { api, today, type Arc, type User } from '../api'
import { ArcSetup } from './ArcSetup'

const DAY_COLORS = {
  perfect: 'bg-ice',
  partial: 'bg-ice/40',
  missed: 'bg-rose-400/30',
  empty: 'bg-white/5',
}

export function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  // undefined = still loading
  const [arc, setArc] = useState<Arc | null | undefined>(undefined)
  const [startingNew, setStartingNew] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  // Every arc endpoint returns the fresh arc, so one helper handles them all.
  async function run(action: () => Promise<{ arc: Arc | null }>) {
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

  let body: ReactNode = null
  if (arc === null || startingNew) {
    body = (
      <ArcSetup
        onCreated={(created) => {
          setArc(created)
          setStartingNew(false)
        }}
      />
    )
  } else if (arc) {
    const doneToday = arc.goals.filter((g) => g.doneToday).length
    const allDone = arc.goals.length > 0 && doneToday === arc.goals.length
    const nextBadge = arc.badges.find((b) => !b.earned)

    body = (
      <div className="space-y-4">
        <section className="card">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="label">
                {arc.isOver ? 'Arc complete' : `Day ${arc.dayNumber} of ${arc.totalDays}`}
              </div>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">{arc.name}</h1>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-ice">🔥 {arc.streak.current}</div>
              <div className="text-xs text-white/40">day streak · best {arc.streak.best}</div>
            </div>
          </div>
          <Bar value={arc.dayNumber / arc.totalDays} className="mt-4" />
        </section>

        {arc.isOver ? (
          <section className="card text-center">
            <p className="text-lg font-semibold">
              You finished with {arc.perfectDays} perfect days and {arc.xp} XP.
            </p>
            <button className="btn mt-4" onClick={() => setStartingNew(true)}>
              Start your next arc
            </button>
          </section>
        ) : (
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <div className="label">Today</div>
              <div className="text-sm text-white/50">
                {allDone ? 'Day locked in ❄️' : `${doneToday}/${arc.goals.length} done`}
              </div>
            </div>
            <ul className="space-y-2">
              {arc.goals.map((g) => (
                <li key={g.id} className="group flex items-center gap-2">
                  <button
                    onClick={() => run(() => api.checkIn(g.id, !g.doneToday))}
                    aria-pressed={g.doneToday}
                    className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      g.doneToday
                        ? 'border-ice/50 bg-ice/15'
                        : 'border-white/10 bg-white/5 hover:border-white/25'
                    }`}
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                        g.doneToday ? 'border-ice bg-ice text-night' : 'border-white/30'
                      }`}
                    >
                      {g.doneToday && '✓'}
                    </span>
                    <span className="flex-1">
                      {g.emoji ?? '🎯'} {g.title}
                    </span>
                    {g.streak.current > 0 && (
                      <span className="text-sm text-white/50">🔥 {g.streak.current}</span>
                    )}
                  </button>
                  <button
                    aria-label={`Delete ${g.title}`}
                    onClick={() => run(() => api.deleteGoal(g.id))}
                    className="cursor-pointer px-1 text-white/20 hover:text-rose-300"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const title = draft.trim()
                if (!title) return
                setDraft('')
                run(() => api.addGoal({ title }))
              }}
            >
              <input
                className="input"
                placeholder="Add a daily goal"
                value={draft}
                maxLength={80}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button className="btn" disabled={!draft.trim()}>
                Add
              </button>
            </form>
          </section>
        )}

        <section className="card">
          <div className="flex items-end justify-between">
            <div>
              <div className="label">Level {arc.level.number}</div>
              <div className="mt-1 text-xl font-bold">{arc.level.title}</div>
            </div>
            <div className="text-sm text-white/50">
              {arc.level.xpIntoLevel}/{arc.level.xpPerLevel} XP · {arc.xp} total
            </div>
          </div>
          <Bar value={arc.level.xpIntoLevel / arc.level.xpPerLevel} className="mt-3" />
          <p className="mt-3 text-xs text-white/40">
            +10 XP per check-in · +20 for a perfect day · streak rewards below
          </p>
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <div className="label">Streak rewards</div>
            {nextBadge && (
              <div className="text-sm text-white/50">
                {nextBadge.days - arc.streak.current} days to {nextBadge.name}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {arc.badges.map((b) => (
              <div
                key={b.days}
                className={`rounded-xl border p-3 text-center ${
                  b.earned ? 'border-ice/50 bg-ice/15' : 'border-white/10 opacity-50'
                }`}
              >
                <div className="text-2xl">{b.earned ? '🏆' : '🔒'}</div>
                <div className="mt-1 text-sm font-semibold">{b.name}</div>
                <div className="text-xs text-white/50">
                  {b.days}-day streak · +{b.xp} XP
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="label mb-3">The arc so far</div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: arc.totalDays }, (_, i) => {
              const day = arc.days[i]
              // Today isn't a miss until it's over.
              const pending = day?.date === today() && day.status === 'missed'
              const color = !day ? 'bg-white/5' : pending ? 'bg-white/5 ring-1 ring-ice/60' : DAY_COLORS[day.status]
              return (
                <div
                  key={i}
                  title={day ? `${day.date}: ${day.done}/${day.total}` : `Day ${i + 1}`}
                  className={`size-4 rounded ${color}`}
                />
              )
            })}
          </div>
        </section>

        {!arc.isOver && (
          <div className="pt-2 text-center text-sm">
            {confirmEnd ? (
              <span className="text-white/60">
                Delete this arc and all its progress?{' '}
                <button
                  className="cursor-pointer font-semibold text-rose-300 hover:underline"
                  onClick={() => {
                    setConfirmEnd(false)
                    run(() => api.deleteArc(arc.id))
                  }}
                >
                  Yes, delete
                </button>
                {' · '}
                <button className="cursor-pointer hover:underline" onClick={() => setConfirmEnd(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                className="cursor-pointer text-white/30 hover:text-rose-300"
                onClick={() => setConfirmEnd(true)}
              >
                End this arc
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="text-lg font-bold tracking-tight">❄️ WintArc</div>
        <div className="flex items-center gap-3 text-sm text-white/50">
          <span>{user.name}</span>
          <button className="cursor-pointer hover:text-frost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>
      {error && (
        <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}
      {body}
    </div>
  )
}

function Bar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div
        className="h-full rounded-full bg-ice transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  )
}
