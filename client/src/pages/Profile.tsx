import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useParams } from 'react-router-dom'
import { api, type PastArc, type ProfileEdit, type ProfileUser, type Profile as ProfileData } from '../api'
import { arcPhase, arcStats, trackProgress } from '../arcStats'
import { toAvatarDataUrl } from '../avatar'
import { ActivityGrid, Avatar, Checkbox, ErrorNote, Loading, Rewards, StatStrip } from '../components/ArcParts'
import { downloadFile } from '../download'
import { scheduleSummary } from '../schedule'
import { supabase } from '../supabase'
import { useTitle } from '../useTitle'

export function Profile() {
  const { username = '' } = useParams()
  // Keyed by username so navigating between profiles starts from a clean slate.
  return <ProfileView key={username} username={username} />
}

function ProfileView({ username }: { username: string }) {
  const [profile, setProfile] = useState<ProfileData>()
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(() => api.getProfile(username).then(setProfile), [username])

  useEffect(() => {
    load().catch((err: Error) => setError(err.message))
  }, [load])

  // Resolves to whether the action went through.
  async function act(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
      await load()
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    }
  }

  function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Clear the input so picking the same file again still fires a change.
    e.target.value = ''
    if (file) act(async () => api.setAvatar(await toAvatarDataUrl(file)))
  }

  useTitle(profile?.user.name)

  if (!profile) return error ? <ErrorNote message={error} /> : <Loading />
  const { user, arc, relation, friendshipId } = profile
  const isSelf = relation === 'self'

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start gap-5">
        {isSelf ? (
          <button
            className="group relative shrink-0 rounded-full"
            aria-label={user.avatarUrl ? 'Change photo' : 'Add photo'}
            onClick={() => fileInput.current?.click()}
          >
            <Avatar user={user} size="lg" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </span>
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickPhoto} />
          </button>
        ) : (
          <Avatar user={user} size="lg" />
        )}
        <div className="min-w-48 flex-1">
          <h1 className="text-[40px] leading-none font-medium">{user.name}</h1>
          <div className="mt-1 font-mono text-muted">
            @{user.username}
            {arc && ` · ${arc.name} · ${arcPhase(arc)}`}
          </div>
          {user.bio && <p className="mt-3 max-w-[60ch] whitespace-pre-line">{user.bio}</p>}
          <div className="label mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {user.location && <span>{user.location}</span>}
            {user.link && (
              <a href={user.link} target="_blank" rel="noreferrer" className="text-fg hover:underline">
                {user.link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            )}
            <span>
              Joined {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
          </div>
          {user.stack.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {user.stack.map((tag) => (
                <span key={tag} className="rounded-full border border-line px-3 py-1 font-mono text-[13px]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {isSelf && !editing && (
          <button className="btn-outline" onClick={() => setEditing(true)}>
            Edit profile
          </button>
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

      {isSelf && editing && (
        <EditProfile
          user={user}
          onSave={async (input) => {
            if (await act(() => api.updateProfile(input))) setEditing(false)
          }}
          onRemovePhoto={() => act(api.removeAvatar)}
          onCancel={() => setEditing(false)}
        />
      )}
      {isSelf && editing && <AccountActions username={user.username} />}

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
                    {track.checkpoints.length > 0 && (
                      <span className="font-mono text-[13px]" title="Checkpoints done">
                        {trackProgress(track)}%
                      </span>
                    )}
                    <span className="label hidden sm:inline">{scheduleSummary(track)}</span>
                    {isSelf && <span className="label">{track.isPublic ? 'Public' : 'Private'}</span>}
                    <span className="font-mono text-[13px] text-muted">{track.streak.current}d streak</span>
                  </div>
                  {track.goals.map((goal) => (
                    <div key={goal.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                      <Checkbox checked={goal.doneToday} />
                      <span className="flex-1">{goal.title}</span>
                      {goal.subtasks.length > 0 && (
                        <span className="font-mono text-[13px] text-muted">
                          {goal.subtasks.filter((s) => s.done).length}/{goal.subtasks.length}
                        </span>
                      )}
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

      <PastArcs arcs={profile.pastArcs} />
    </div>
  )
}

const shortDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })

function PastArcs({ arcs }: { arcs: PastArc[] }) {
  if (arcs.length === 0) return null
  return (
    <section className="space-y-3">
      <h2 className="h2">Past arcs</h2>
      <div className="card divide-y divide-line">
        {arcs.map((arc) => (
          <div key={arc.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
            <span className="font-semibold">{arc.name}</span>
            <span className="label flex-1">
              {shortDate(arc.startDate)} to {shortDate(arc.endDate)}
            </span>
            <span className="font-mono text-[13px] text-muted">
              best {arc.bestStreak}d · {arc.perfectDays} perfect days · L{arc.level} · {arc.xp.toLocaleString()} XP
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

// Download everything, or delete the account for good.
function AccountActions({ username }: { username: string }) {
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function attempt(action: () => Promise<void>) {
    setError('')
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError((err as Error).message)
    }
    setBusy(false)
  }

  const exportData = () =>
    attempt(async () => {
      downloadFile(`wintarc-${username}.json`, JSON.stringify(await api.exportData(), null, 2), 'application/json')
    })

  const deleteAccount = (e: FormEvent) => {
    e.preventDefault()
    attempt(async () => {
      await api.deleteAccount(typed)
      await supabase.auth.signOut()
    })
  }

  return (
    <section className="card max-w-[560px] space-y-4 p-4">
      <h2 className="h2">Your account</h2>
      <ErrorNote message={error} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label">A file with your profile, arcs, goals and every check-in.</p>
        <button className="btn-outline" disabled={busy} onClick={exportData}>
          Export my data
        </button>
      </div>
      {confirming ? (
        <form onSubmit={deleteAccount} className="space-y-3 border-t border-line pt-4">
          <p>
            This deletes your profile, arcs, streaks and friendships for good. Type{' '}
            <span className="font-mono font-semibold">{username}</span> to confirm.
          </p>
          <input
            className="input font-mono"
            aria-label="Your username"
            autoCapitalize="none"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn bg-danger hover:bg-danger/80" disabled={busy || typed.trim().toLowerCase() !== username}>
              Delete my account
            </button>
            <button type="button" className="btn-outline" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="label">Deleting your account can't be undone.</p>
          <button className="btn-outline text-danger" onClick={() => setConfirming(true)}>
            Delete account
          </button>
        </div>
      )}
    </section>
  )
}

const MAX_TAGS = 12
const MAX_BIO = 160

type EditProfileProps = {
  user: ProfileUser
  onSave: (input: ProfileEdit) => Promise<void>
  onRemovePhoto: () => void
  onCancel: () => void
}

function EditProfile({ user, onSave, onRemovePhoto, onCancel }: EditProfileProps) {
  const [name, setName] = useState(user.name)
  const [bio, setBio] = useState(user.bio ?? '')
  const [location, setLocation] = useState(user.location ?? '')
  const [link, setLink] = useState(user.link ?? '')
  const [stack, setStack] = useState(user.stack)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  // Returns the tags including whatever is still sitting in the input.
  function withDraft() {
    const tag = draft.trim().replace(/,$/, '').trim()
    const known = stack.some((t) => t.toLowerCase() === tag.toLowerCase())
    return tag && !known && stack.length < MAX_TAGS ? [...stack, tag] : stack
  }

  function tagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      setStack(withDraft())
      setDraft('')
    } else if (e.key === 'Backspace' && !draft) {
      setStack(stack.slice(0, -1))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const url = link.trim()
    await onSave({
      name,
      bio,
      location,
      // People type "github.com/me", so fill in the scheme for them.
      link: url && !/^https?:\/\//i.test(url) ? `https://${url}` : url,
      stack: withDraft(),
    })
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="card max-w-[560px] space-y-4 p-4">
      <h2 className="h2">Edit profile</h2>
      <label className="block space-y-1.5">
        <span className="label">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required />
      </label>
      <label className="block space-y-1.5">
        <span className="label flex justify-between">
          Bio
          <span className="font-mono">
            {bio.length}/{MAX_BIO}
          </span>
        </span>
        <textarea
          className="input h-auto py-2"
          rows={3}
          placeholder="What you're working on this arc"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={MAX_BIO}
        />
      </label>
      <div className="space-y-1.5">
        <span className="label">Tech stack</span>
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-[20px] border border-fg/25 bg-surface px-2 py-1.5 focus-within:border-fg">
          {stack.map((tag) => (
            <span key={tag} className="flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1 font-mono text-[13px]">
              {tag}
              <button
                type="button"
                className="text-muted hover:text-fg"
                aria-label={`Remove ${tag}`}
                onClick={() => setStack(stack.filter((t) => t !== tag))}
              >
                ✕
              </button>
            </span>
          ))}
          <input
            className="h-7 min-w-32 flex-1 bg-transparent px-1 outline-none placeholder:text-muted"
            placeholder={stack.length >= MAX_TAGS ? `Up to ${MAX_TAGS} tags` : 'Rust, React, Postgres… press Enter to add'}
            aria-label="Add a tech stack tag"
            maxLength={24}
            disabled={stack.length >= MAX_TAGS}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={tagKey}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="label">Location</span>
          <input className="input" placeholder="City, Country" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={60} />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Link</span>
          <input className="input" placeholder="github.com/you" value={link} onChange={(e) => setLink(e.target.value)} maxLength={190} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" disabled={busy || !name.trim()}>
          Save
        </button>
        <button type="button" className="btn-outline" onClick={onCancel}>
          Cancel
        </button>
        {user.avatarUrl && (
          <button type="button" className="ml-auto text-[13px] text-muted hover:text-fg" onClick={onRemovePhoto}>
            Remove photo
          </button>
        )}
      </div>
    </form>
  )
}
