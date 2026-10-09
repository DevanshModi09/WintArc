import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Commitment as CommitmentData } from '../api'
import { arcPhase, survivorLabel, trackProgress } from '../arcStats'
import { ActivityGrid, Avatar, ErrorNote, Loading, Logo } from '../components/ArcParts'
import { scheduleSummary } from '../schedule'
import { useTitle } from '../useTitle'

// The page someone shares to say "I'm doing this for 90 days". It needs no
// account to open and only ever shows their public tracks.
export function Commitment({ signedIn = false }: { signedIn?: boolean }) {
  const { username = '' } = useParams()
  const [data, setData] = useState<CommitmentData>()
  const [error, setError] = useState('')
  useTitle(data?.user.name)

  useEffect(() => {
    api.getCommitment(username).then(setData, (err: Error) => setError(err.message))
  }, [username])

  const arc = data?.arc
  const standing = arc && survivorLabel(arc)

  return (
    <main className="mx-auto max-w-[640px] space-y-8 px-4 py-10 sm:px-8">
      <div className="flex items-center justify-between">
        <Link to="/">
          <Logo />
        </Link>
        {!signedIn && (
          <Link to="/signup" className="btn-outline h-9">
            Start your own arc
          </Link>
        )}
      </div>

      <ErrorNote message={error} />
      {!data && !error && <Loading />}

      {data && (
        <>
          <header className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar user={data.user} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{data.user.name}</span>
                <span className="block truncate font-mono text-[13px] text-muted">@{data.user.username}</span>
              </span>
            </div>
            {arc ? (
              <>
                <h1 className="text-[40px] leading-none font-bold">{arc.name}</h1>
                <p className="font-mono text-muted">
                  {arc.totalDays} days · {arcPhase(arc)}
                  {standing && ` · ${standing}`}
                </p>
              </>
            ) : (
              <h1 className="text-[32px] leading-[1.1] font-bold">No arc running right now</h1>
            )}
            {data.user.bio && <p className="text-muted">{data.user.bio}</p>}
          </header>

          {arc && (
            <>
              <div className="card grid grid-cols-3 overflow-hidden">
                {[
                  { label: 'Current streak', value: `${arc.streak.current}d` },
                  { label: 'Perfect days', value: arc.perfectDays },
                  { label: 'Check-ins', value: arc.totalCheckIns },
                ].map((s) => (
                  <div key={s.label} className="-mr-px border-r border-line p-5">
                    <div className="label">{s.label}</div>
                    <div className="mt-1.5 font-mono text-3xl font-semibold">{s.value}</div>
                  </div>
                ))}
              </div>

              <ActivityGrid arc={arc} />

              <section className="space-y-3">
                <h2 className="h2">The commitment</h2>
                {arc.tracks.length === 0 && <p className="text-muted">Their tracks are private.</p>}
                {arc.tracks.map((track) => {
                  const progress = trackProgress(track)
                  return (
                    <div key={track.id} className="card">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3">
                        <h3 className="flex-1 font-semibold">{track.name}</h3>
                        {progress !== null && <span className="font-mono text-[13px] text-muted">{progress}%</span>}
                        <span className="label">{scheduleSummary(track)}</span>
                      </div>
                      {track.goals.map((goal) => (
                        <div key={goal.id} className="flex min-h-11 items-center gap-3 border-b border-line px-4 last:border-b-0">
                          <span className="flex-1">{goal.title}</span>
                          <span className="font-mono text-[13px] text-muted">
                            {goal.total} {goal.total === 1 ? 'day' : 'days'} done
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </section>
            </>
          )}
        </>
      )}
    </main>
  )
}
