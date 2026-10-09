import { motion } from 'motion/react'
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
// a card per commit, saying who committed to which track, with the message
// and the checkpoint it went towards. Photos are private, so never here.
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

      {/* One line of who did what per commit, with the message quoted under it. */}
      <ol className="space-y-3">
        {entries?.flatMap((entry) =>
          entry.items.map((item) => (
            <motion.li
              key={item.id}
              className="card flex gap-3 p-4"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <Link to={`/u/${entry.user.username}`} className="shrink-0">
                <Avatar user={entry.user} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="leading-snug">
                  <Link to={`/u/${entry.user.username}`} className="font-medium hover:underline">
                    {entry.user.name.split(' ')[0]}
                  </Link>{' '}
                  <span className="text-muted">committed to</span> <span className="font-medium">{item.track}</span>
                  <span className="label"> · {feedDay(entry.date)}</span>
                </p>
                <blockquote className="mt-2 border-l-2 border-accent pl-3 break-words">
                  {item.note ? `“${item.note}”` : <span className="text-muted">No message</span>}
                </blockquote>
                {item.checkpoint && <p className="label mt-2 truncate">Working on {item.checkpoint}</p>}
              </div>
            </motion.li>
          )),
        )}
      </ol>
    </div>
  )
}
