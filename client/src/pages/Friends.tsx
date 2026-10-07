import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type Friends as FriendsData, type PublicUser, type RelationInfo } from '../api'
import { arcPhase } from '../arcStats'
import { Avatar, ErrorNote } from '../components/ArcParts'

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

export function Friends() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [query, setQuery] = useState(q)
  const [results, setResults] = useState<SearchResult[]>()
  const [data, setData] = useState<FriendsData>()
  const [error, setError] = useState('')

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
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Friends</h1>

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

      {data && (
        <section className="space-y-3">
          <h2 className="h2">Your friends</h2>
          {data.friends.length === 0 ? (
            <p className="text-muted">No friends yet. Search for someone above to add them.</p>
          ) : (
            <div className="card divide-y divide-line">
              {data.friends.map((f) => (
                <div key={f.friendshipId} className="flex items-center gap-4 px-4 py-3">
                  <UserLink user={f.user} />
                  {f.arc ? (
                    <>
                      <span className="label">
                        {f.arc.startsIn > 0 || f.arc.isOver
                          ? arcPhase(f.arc)
                          : `${f.arc.today.done}/${f.arc.today.total} today`}
                      </span>
                      <span className="w-12 text-right font-mono font-semibold">{f.arc.streak.current}d</span>
                    </>
                  ) : (
                    <span className="label">No active arc</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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
