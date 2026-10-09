import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, today, type FeedEntry } from '../api'
import { Avatar, ErrorNote, Loading } from '../components/ArcParts'
import { useTitle } from '../useTitle'

const feedDay = (date: string) => {
  if (date === today()) return 'today'
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

// What you and your friends have committed over the last week, newest first:
// a card per person per day, each commit with its message and the checkpoint
// it went towards. Photos are private, so they're never here.
export function Feed() {
  const [entries, setEntries] = useState<FeedEntry[]>()
  const [error, setError] = useState('')
  useTitle('Feed')

  useEffect(() => {
    const load = () => api.getFeed().then((res) => setEntries(res.entries), (err: Error) => setError(err.message))
    load()
    // Coming back to the tab picks up what friends committed meanwhile.
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      <header>
        <div className="eyebrow">The last 7 days</div>
        <h1 className="mt-3 text-[40px] leading-none font-medium">Feed</h1>
        <p className="mt-2 text-muted">What you and your friends have committed. Only public tracks show up here.</p>
      </header>

      <ErrorNote message={error} />
      {!entries && !error && <Loading />}
      {entries?.length === 0 && (
        <p className="text-muted">
          Nothing yet. Commits from you and your friends land here.{' '}
          <Link to="/friends" className="font-medium text-fg underline underline-offset-2">
            Find friends
          </Link>
        </p>
      )}

      {entries?.map((entry) => (
        <article key={`${entry.user.id} ${entry.date}`} className="card">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Link to={`/u/${entry.user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar user={entry.user} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{entry.user.name}</span>
                <span className="label block truncate">@{entry.user.username}</span>
              </span>
            </Link>
            <span className="label whitespace-nowrap">
              {entry.items.length} {entry.items.length === 1 ? 'commit' : 'commits'} · {feedDay(entry.date)}
            </span>
          </div>
          <ul className="divide-y divide-line">
            {entry.items.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <p className="break-words">{item.note ?? <span className="text-muted">No message</span>}</p>
                <p className="label mt-1 truncate">
                  {item.track}
                  {item.checkpoint && ` · ${item.checkpoint}`}
                </p>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  )
}
