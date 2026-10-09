import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Survivors } from '../api'
import { Avatar, ErrorNote, Loading } from '../components/ArcParts'
import { ProgressBar } from '../components/Motion'
import { useTitle } from '../useTitle'

const longDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
}

// Everyone running this year's arc on one board. You stay on it until the
// first scheduled day you don't check in.
export function Board() {
  const [data, setData] = useState<Survivors>()
  const [error, setError] = useState('')
  useTitle('Board')

  useEffect(() => {
    api.getSurvivors().then(setData, (err: Error) => setError(err.message))
  }, [])

  if (!data) return error ? <ErrorNote message={error} /> : <Loading />
  const { season, started, standing, me, survivors } = data

  let mine = "You aren't in this year's arc."
  if (!me && season.canStart) mine = `Set up your arc on Today to get on the board. The last day to start is ${longDate(season.lastStart)}.`
  else if (me?.alive) mine = "You're still standing. One day without a check-in and you're off the board."
  else if (me?.fellOnDay) mine = `You went out on day ${me.fellOnDay} of your arc. Your streak and XP still count, and the board resets next year.`

  return (
    <div className="mx-auto max-w-[640px] space-y-8">
      <header>
        <div className="eyebrow">
          {season.daysLeft === 0
            ? `Ended ${longDate(season.endDate)}`
            : `${season.daysLeft} ${season.daysLeft === 1 ? 'day' : 'days'} left · ends ${longDate(season.endDate)}`}
        </div>
        <h1 className="mt-3 text-[40px] leading-none font-medium">
          {standing.toLocaleString()} of {started.toLocaleString()} still standing
        </h1>
        <p className="mt-2 text-muted">{mine}</p>
      </header>

      {started > 0 && (
        <ProgressBar percent={(standing / started) * 100} label="Share of people still standing" />
      )}

      {survivors.length === 0 ? (
        <p className="text-muted">{started === 0 ? 'Nobody has started an arc yet this year.' : 'Nobody is left standing.'}</p>
      ) : (
        <section className="space-y-3">
          <h2 className="h2">
            Still standing
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
                <span className="label hidden sm:inline">{s.streak}d streak</span>
                <span className="w-20 text-right font-mono font-semibold">{s.xp.toLocaleString()} XP</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
