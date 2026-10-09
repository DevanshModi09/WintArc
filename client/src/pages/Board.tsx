import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Survivors } from '../api'
import { Avatar, ErrorNote, Loading } from '../components/ArcParts'
import { useTitle } from '../useTitle'

const startDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

// Everyone running this season's arc on one board. You stay on it until the
// first day you leave a goal undone.
export function Board() {
  const [data, setData] = useState<Survivors>()
  const [error, setError] = useState('')
  useTitle('Board')

  useEffect(() => {
    api.getSurvivors().then(setData, (err: Error) => setError(err.message))
  }, [])

  if (!data) return error ? <ErrorNote message={error} /> : <Loading />
  const { season, started, standing, me, survivors } = data
  const waiting = season.startsIn > 0
  const people = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'person' : 'people'}`

  let mine = 'You aren’t in this season’s arc. Set one up on Today to get on the board.'
  if (me && waiting) mine = 'You’re in. Don’t drop a day once it starts and you stay on this board.'
  else if (me?.alive) mine = 'You’re still standing. One undone goal and you’re off the board.'
  else if (me?.fellOnDay) mine = `You went out on day ${me.fellOnDay}. Your streak and XP still count, and the board resets next season.`
  else if (me) mine = 'Add a daily goal on Today to get on the board.'

  return (
    <div className="mx-auto max-w-[640px] space-y-8">
      <header>
        <div className="eyebrow">
          {waiting
            ? `Starts ${startDay(season.startDate)} · in ${season.startsIn} ${season.startsIn === 1 ? 'day' : 'days'}`
            : `Day ${season.dayNumber} of ${season.totalDays}`}
        </div>
        <h1 className="mt-3 text-[40px] leading-none font-medium">
          {waiting ? `${people(started)} locked in` : `${standing.toLocaleString()} of ${started.toLocaleString()} still standing`}
        </h1>
        <p className="mt-2 text-muted">{mine}</p>
      </header>

      {!waiting && started > 0 && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-cell"
          role="progressbar"
          aria-label="Share of people still standing"
          aria-valuemin={0}
          aria-valuemax={started}
          aria-valuenow={standing}
        >
          <div className="h-full bg-fg" style={{ width: `${(standing / started) * 100}%` }} />
        </div>
      )}

      {survivors.length === 0 ? (
        <p className="text-muted">{waiting ? 'Nobody has set up an arc for this season yet.' : 'Nobody is left standing.'}</p>
      ) : (
        <section className="space-y-3">
          <h2 className="h2">
            {waiting ? 'On the start line' : 'Still standing'}
            {survivors.length < standing && <span className="label ml-1.5 font-normal">top {survivors.length}</span>}
          </h2>
          <ol className="card divide-y divide-line">
            {survivors.map((s, i) => (
              <li key={s.user.id} className="flex items-center gap-4 px-4 py-3">
                <span className="w-6 font-mono text-[13px] text-muted">{i + 1}</span>
                <Link to={`/u/${s.user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar user={s.user} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.user.name}</span>
                    <span className="block truncate font-mono text-[13px] text-muted">@{s.user.username}</span>
                  </span>
                </Link>
                {!waiting && (
                  <>
                    <span className="label hidden sm:inline">L{s.level}</span>
                    <span className="w-20 text-right font-mono font-semibold">{s.xp.toLocaleString()} XP</span>
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
