import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import { api, type Profile as ProfileData } from '../api'
import { arcPhase, arcStats } from '../arcStats'
import { toAvatarDataUrl } from '../avatar'
import { ActivityGrid, Avatar, Checkbox, ErrorNote, Rewards, StatStrip } from '../components/ArcParts'

export function Profile() {
  const { username = '' } = useParams()
  // Keyed by username so navigating between profiles starts from a clean slate.
  return <ProfileView key={username} username={username} />
}

function ProfileView({ username }: { username: string }) {
  const [profile, setProfile] = useState<ProfileData>()
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(() => api.getProfile(username).then(setProfile), [username])

  useEffect(() => {
    load().catch((err: Error) => setError(err.message))
  }, [load])

  async function act(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Clear the input so picking the same file again still fires a change.
    e.target.value = ''
    if (file) act(async () => api.setAvatar(await toAvatarDataUrl(file)))
  }

  if (!profile) return <ErrorNote message={error} />
  const { user, arc, relation, friendshipId } = profile
  const isSelf = relation === 'self'

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center gap-5">
        <Avatar user={user} size="lg" />
        <div className="min-w-48 flex-1">
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">{user.name}</h1>
          <div className="mt-1 font-mono text-muted">
            @{user.username}
            {arc && ` · ${arc.name} · ${arcPhase(arc)}`}
          </div>
        </div>
        {isSelf && (
          <div className="flex gap-2">
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickPhoto} />
            <button className="btn-outline" onClick={() => fileInput.current?.click()}>
              {user.avatarUrl ? 'Change photo' : 'Add photo'}
            </button>
            {user.avatarUrl && (
              <button className="btn-outline" onClick={() => act(api.removeAvatar)}>
                Remove
              </button>
            )}
          </div>
        )}
        {relation === 'none' && (
          <button className="btn" onClick={() => act(() => api.addFriend(user.username))}>
            Add friend
          </button>
        )}
        {relation === 'incoming' && (
          <button className="btn" onClick={() => act(() => api.acceptFriend(friendshipId!))}>
            Accept request
          </button>
        )}
        {relation === 'outgoing' && (
          <button className="btn-outline" onClick={() => act(() => api.removeFriend(friendshipId!))}>
            Cancel request
          </button>
        )}
        {relation === 'friends' && (
          <button className="btn-outline" onClick={() => act(() => api.removeFriend(friendshipId!))}>
            Remove friend
          </button>
        )}
      </header>

      <ErrorNote message={error} />

      {!arc ? (
        <p className="text-muted">{isSelf ? "You haven't" : `${user.name} hasn't`} started an arc yet.</p>
      ) : (
        <>
          <StatStrip stats={arcStats(arc)} />
          <div className="flex flex-wrap items-start gap-8">
            <div className="min-w-0 flex-[999_1_420px] space-y-4">
              <h2 className="h2">{isSelf ? 'Your tracks' : 'Public tracks'}</h2>
              {arc.tracks.length === 0 && <p className="text-muted">No public tracks.</p>}
              {arc.tracks.map((track) => (
                <section key={track.id} className="card">
                  <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                    <h3 className="flex-1 font-semibold">{track.name}</h3>
                    {isSelf && <span className="label">{track.isPublic ? 'Public' : 'Private'}</span>}
                    <span className="font-mono text-[13px] text-muted">{track.streak.current}d streak</span>
                  </div>
                  {track.goals.map((goal) => (
                    <div key={goal.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                      <Checkbox checked={goal.doneToday} />
                      <span className="flex-1">{goal.title}</span>
                      <span className="label">{goal.doneToday ? 'done today' : `${goal.streak.current}d streak`}</span>
                    </div>
                  ))}
                </section>
              ))}
            </div>
            <aside className="min-w-0 flex-[1_1_300px] space-y-6">
              <ActivityGrid arc={arc} />
              <Rewards arc={arc} />
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
