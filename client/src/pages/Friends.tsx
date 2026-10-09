import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, today, type ArcSummary, type FeedEntry, type Friends as FriendsData, type PublicUser, type RelationInfo } from '../api'
import { arcPhase } from '../arcStats'
import { Avatar, ErrorNote, Loading } from '../components/ArcParts'
import { useTitle } from '../useTitle'

type SearchResult = PublicUser & RelationInfo

function UserLink({ user }: { user: PublicUser }) {
  return (
    <Link to={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar user={user} />
      <span className="min-w-0">
        <span className="block truncate font-medium">{user.name}</span>
        <span className="block truncate font-mono text-[13px] text-muted">@{user.username}</span>
      </span>
    </Link>
  )
}

// The ways to rank the leaderboard, each with the number it shows.
const RANKINGS = {
  Streak: { score: (arc: ArcSummary) => arc.streak.current, show: (arc: ArcSummary) => `${arc.streak.current}d` },
  XP: { score: (arc: ArcSummary) => arc.xp, show: (arc: ArcSummary) => arc.xp.toLocaleString() },
  Level: { score: (arc: ArcSummary) => arc.level.number, show: (arc: ArcSummary) => `L${arc.level.number}` },
}
type Ranking = keyof typeof RANKINGS

function Leaderboard({ data }: { data: FriendsData }) {
  const [ranking, setRanking] = useState<Ranking>('Streak')
  const { score, show } = RANKINGS[ranking]
  const rows = [{ ...data.me, isMe: true }, ...data.friends.map((f) => ({ ...f, isMe: false }))]
    // People without an arc go last. Ties keep the order they arrived in.
    .sort((a, b) => (b.arc ? score(b.arc) : -1) - (a.arc ? score(a.arc) : -1))

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="h2">Leaderboard</h2>
        <div className="flex gap-1.5" role="group" aria-label="Rank by">
          {(Object.keys(RANKINGS) as Ranking[]).map((r) => (
            <button
              key={r}
              className={`h-8 rounded-full border px-3 font-mono text-[13px] transition ${
                r === ranking ? 'border-fg bg-fg text-bg' : 'border-line hover:border-fg'
              }`}
              aria-pressed={r === ranking}
              onClick={() => setRanking(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <ol className="card divide-y divide-line">
        {rows.map((row, i) => (
          <li key={row.user.id} className={`flex items-center gap-4 px-4 py-3 ${row.isMe ? 'bg-subtle' : ''}`}>
            <span className="w-5 font-mono text-[13px] text-muted">{i + 1}</span>
            <UserLink user={row.isMe ? { ...row.user, name: `${row.user.name} (you)` } : row.user} />
            {row.arc ? (
              <>
                <span className="label hidden sm:inline">
                  {row.arc.startsIn > 0 || row.arc.isOver
                    ? arcPhase(row.arc)
                    : `${row.arc.today.done}/${row.arc.today.total} today`}
                </span>
                <span className="w-14 text-right font-mono font-semibold">{show(row.arc)}</span>
              </>
            ) : (
              <span className="label">No active arc</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

const feedDay = (date: string) => {
  if (date === today()) return 'today'
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

// The last week of work from you and your friends: what got done, with the
// proof people attached.
function Feed({ entries }: { entries: FeedEntry[] }) {
  return (
    <section className="space-y-3">
      <h2 className="h2">
        Feed <span className="label ml-1.5 font-normal">the last 7 days</span>
      </h2>
      {entries.length === 0 && <p className="text-muted">Nothing yet. Check-ins from you and your friends show up here.</p>}
      {entries.map((entry) => (
        <article key={`${entry.user.id} ${entry.date}`} className="card">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <UserLink user={entry.user} />
            <span className="label">
              {entry.items.length} done · {feedDay(entry.date)}
            </span>
          </div>
          <ul className="divide-y divide-line">
            {entry.items.map((item) => (
              <li key={item.id} className="px-4 py-2.5">
                <div className="flex items-baseline gap-3">
                  <span className="flex-1">{item.goal}</span>
                  <span className="label">{item.track}</span>
                </div>
                {(item.note || item.link) && (
                  <p className="mt-1 text-[13px] break-words text-muted">
                    {item.note}
                    {item.note && item.link && ' · '}
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noreferrer noopener" className="text-fg underline underline-offset-2">
                        {item.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}
                      </a>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  )
}

export function Friends() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [query, setQuery] = useState(q)
  const [results, setResults] = useState<SearchResult[]>()
  const [data, setData] = useState<FriendsData>()
  const [feed, setFeed] = useState<FeedEntry[]>()
  const [error, setError] = useState('')
  useTitle('Friends')

  useEffect(() => {
    api.getFeed().then((res) => setFeed(res.entries), (err: Error) => setError(err.message))
  }, [])

  const fetchLists = useCallback(
    () => Promise.all([api.getFriends(), q ? api.searchUsers(q) : null]),
    [q],
  )
  const show = ([friends, found]: Awaited<ReturnType<typeof fetchLists>>) => {
    setData(friends)
    setResults(found?.users)
  }

  useEffect(() => {
    fetchLists()
      .then(show)
      .catch((err: Error) => setError(err.message))
  }, [fetchLists])

  // Run a friend action, then refresh both lists so every button is current.
  async function act(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
      show(await fetchLists())
    } catch (err) {
      setError((err as Error).message)
    }
  }

  function search(e: FormEvent) {
    e.preventDefault()
    setParams(query.trim() ? { q: query.trim() } : {})
  }

  return (
    <div className="mx-auto max-w-[640px] space-y-8">
      <h1 className="text-[40px] leading-none font-medium">Friends</h1>

      <form onSubmit={search} className="flex gap-2">
        <input
          className="input"
          placeholder="Find people by name or username"
          aria-label="Find people by name or username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn">Search</button>
      </form>
      <ErrorNote message={error} />

      {q && results && (
        <section className="space-y-3">
          <h2 className="h2">Results for "{q}"</h2>
          {results.length === 0 ? (
            <p className="text-muted">Nobody found.</p>
          ) : (
            <div className="card divide-y divide-line">
              {results.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <UserLink user={u} />
                  {u.relation === 'none' && (
                    <button className="btn h-9" onClick={() => act(() => api.addFriend(u.username))}>
                      Add friend
                    </button>
                  )}
                  {u.relation === 'incoming' && (
                    <button className="btn h-9" onClick={() => act(() => api.acceptFriend(u.friendshipId!))}>
                      Accept
                    </button>
                  )}
                  {u.relation === 'outgoing' && <span className="label">Requested</span>}
                  {u.relation === 'friends' && <span className="label">Friends</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {data && data.incoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="h2">Requests</h2>
          <div className="card divide-y divide-line">
            {data.incoming.map((r) => (
              <div key={r.friendshipId} className="flex items-center gap-2 px-4 py-3">
                <UserLink user={r.user} />
                <button className="btn h-9" onClick={() => act(() => api.acceptFriend(r.friendshipId))}>
                  Accept
                </button>
                <button className="btn-outline h-9" onClick={() => act(() => api.removeFriend(r.friendshipId))}>
                  Decline
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!data && !error && <Loading />}
      {data &&
        (data.friends.length === 0 ? (
          <section className="space-y-3">
            <h2 className="h2">Your friends</h2>
            <p className="text-muted">No friends yet. Search for someone above to add them.</p>
          </section>
        ) : (
          <Leaderboard data={data} />
        ))}

      {feed && <Feed entries={feed} />}

      {data && data.outgoing.length > 0 && (
        <section className="space-y-3">
          <h2 className="h2">Sent</h2>
          <div className="card divide-y divide-line">
            {data.outgoing.map((r) => (
              <div key={r.friendshipId} className="flex items-center gap-2 px-4 py-3">
                <UserLink user={r.user} />
                <button className="btn-outline h-9" onClick={() => act(() => api.removeFriend(r.friendshipId))}>
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
