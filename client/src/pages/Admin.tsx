import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import { api, today, type AdminOverview, type AdminProof, type AdminUser as AdminUserData } from '../api'
import { trackProgress } from '../arcStats'
import { ActivityGrid, Avatar, Checkbox, ErrorNote, Loading } from '../components/ArcParts'
import { ProofPhoto } from '../components/ProofPhoto'
import { scheduleSummary } from '../schedule'
import { useTitle } from '../useTitle'

// The admin area: how the app is being used, every person in full, and
// everything that's been uploaded. Only admins can open any of it. People's
// daily reflections are the one thing that isn't here: the app promises those
// are only ever shown to their author.

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

const day = (date: string) => {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `h-8 rounded-full border px-3.5 text-[14px] leading-[30px] transition ${isActive ? 'border-fg bg-fg text-bg' : 'border-line hover:border-fg'}`

function Shell({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  useTitle(`Admin · ${title}`)
  return (
    <div className="space-y-8">
      <header>
        <div className="eyebrow">Admin</div>
        <h1 className="mt-3 text-[40px] leading-none font-medium">{title}</h1>
        <p className="mt-2 max-w-[64ch] text-muted">{intro}</p>
        <nav className="mt-5 flex gap-1.5" aria-label="Admin sections">
          <NavLink to="/admin" end className={tabClass}>
            People
          </NavLink>
          <NavLink to="/admin/uploads" className={tabClass}>
            Uploads
          </NavLink>
        </nav>
      </header>
      {children}
    </div>
  )
}

// Loads one admin resource, and shows the wait or the failure in its place.
function useAdmin<T>(load: () => Promise<T>, key = '') {
  const [data, setData] = useState<T>()
  const [error, setError] = useState('')
  useEffect(() => {
    load().then(setData, (err: Error) => setError(err.message))
    // `load` is a fresh function every render; `key` says when it really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return { data, placeholder: error ? <ErrorNote message={error} /> : <Loading /> }
}

function Tiles({ tiles }: { tiles: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.label} className="card flex flex-col-reverse gap-1.5 px-4 py-3">
          <dd className="text-2xl leading-none font-medium whitespace-nowrap">{t.value}</dd>
          <dt className="label leading-none">{t.label}</dt>
        </div>
      ))}
    </dl>
  )
}

export function AdminPeople() {
  const { data, placeholder } = useAdmin<AdminOverview>(api.getAdminOverview)
  const [query, setQuery] = useState('')
  if (!data) return <Shell title="People" intro="Everyone who has signed up.">{placeholder}</Shell>

  const { totals } = data
  const q = query.trim().toLowerCase()
  const rows = data.users.filter(
    ({ user }) => !q || user.name.toLowerCase().includes(q) || user.username.includes(q) || user.email.toLowerCase().includes(q),
  )

  return (
    <Shell title="People" intro="Everyone who has signed up, newest first. Click a person to see everything about their arc.">
      <Tiles
        tiles={[
          { label: 'Signed up', value: totals.users },
          { label: 'Arc running', value: totals.withArc },
          { label: 'Still standing', value: totals.standing },
          { label: 'Checked in today', value: totals.checkedInToday },
          { label: 'Check-ins today', value: totals.checkInsToday },
          { label: 'Photos stored', value: totals.photos },
        ]}
      />

      <input
        className="input max-w-[360px]"
        placeholder="Filter by name, username or email"
        aria-label="Filter people"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-[14px]">
          <thead className="label">
            <tr className="border-b border-line">
              {['Person', 'Joined', 'Arc', 'Today', 'Streak', 'XP', 'Check-ins', 'Last check-in'].map((h) => (
                <th key={h} className="px-4 py-2.5 font-normal whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ user, arc, checkIns, lastCheckIn }) => (
              <tr key={user.id} className="border-b border-line last:border-b-0 hover:bg-subtle">
                <td className="px-4 py-2.5">
                  <Link to={`/admin/u/${user.username}`} className="flex items-center gap-3">
                    <Avatar user={user} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {user.name}
                        {user.isAdmin && <span className="label ml-2">admin</span>}
                      </span>
                      <span className="label block truncate">
                        @{user.username} · {user.email}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">{day(user.joined)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {!arc ? (
                    <span className="label">none</span>
                  ) : arc.isOver ? (
                    'finished'
                  ) : (
                    <>
                      day {arc.dayNumber}/{arc.totalDays}
                      <span className="label"> · {arc.alive ? 'standing' : 'out'}</span>
                    </>
                  )}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">{arc && !arc.isOver ? `${arc.today.done}/${arc.today.total}` : '–'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{arc ? `${arc.streak}d` : '–'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{arc ? arc.xp.toLocaleString() : '–'}</td>
                <td className="px-4 py-2.5">{checkIns}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {lastCheckIn ? (lastCheckIn === today() ? 'today' : day(lastCheckIn)) : <span className="label">never</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="label px-4 py-6">Nobody matches that.</p>}
      </div>
    </Shell>
  )
}

export function AdminPerson() {
  const { username = '' } = useParams()
  const { data, placeholder } = useAdmin<AdminUserData>(() => api.getAdminUser(username), username)
  if (!data) return <Shell title={`@${username}`} intro="Everything about this person.">{placeholder}</Shell>

  const { user, arc, checkIns, friends } = data
  return (
    <Shell
      title={user.name}
      intro={
        <>
          @{user.username} · {user.email} · joined {day(user.createdAt)}
          {user.isAdmin && ' · admin'}
          {user.sharePublic && ' · public page on'} ·{' '}
          <Link to={`/u/${user.username}`} className="text-fg underline underline-offset-2">
            their profile
          </Link>
        </>
      }
    >
      {(user.bio || user.location || user.link || user.stack.length > 0) && (
        <section className="card space-y-1.5 p-4 text-[14px]">
          {user.bio && <p className="whitespace-pre-line">{user.bio}</p>}
          <p className="label">{[user.location, user.link, user.stack.join(', ')].filter(Boolean).join(' · ')}</p>
        </section>
      )}

      {!arc ? (
        <p className="text-muted">No arc yet.</p>
      ) : (
        <>
          <Tiles
            tiles={[
              { label: 'Arc day', value: arc.isOver ? 'finished' : `${arc.dayNumber}/${arc.totalDays}` },
              { label: 'Streak', value: `${arc.streak.current}d` },
              { label: 'Best streak', value: `${arc.streak.best}d` },
              { label: 'Perfect days', value: arc.perfectDays },
              { label: 'XP · level', value: `${arc.xp.toLocaleString()} · ${arc.level.number}` },
              { label: 'Board', value: arc.survivor.alive ? 'standing' : arc.survivor.fellOnDay ? `out, day ${arc.survivor.fellOnDay}` : '–' },
            ]}
          />

          <div className="flex flex-wrap items-start gap-8">
            <div className="min-w-0 flex-[999_1_420px] space-y-4">
              <h2 className="h2">Tracks</h2>
              {arc.tracks.map((track) => (
                <section key={track.id} className="card">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3">
                    <h3 className="flex-1 font-medium">{track.name}</h3>
                    <span className="label">{track.isPublic ? 'public' : 'private'}</span>
                    <span className="label">{scheduleSummary(track)}</span>
                    <span className="label">{track.total} days done</span>
                    <span className="font-medium">{trackProgress(track) ?? 0}%</span>
                  </div>
                  {track.checkpoints.length === 0 && <p className="label px-4 py-3">No checkpoints.</p>}
                  {track.checkpoints.map((c) => (
                    <div key={c.id} className="flex min-h-10 items-center gap-3 border-b border-line px-4 last:border-b-0">
                      <Checkbox checked={c.done} />
                      <span className={c.done ? 'text-muted line-through' : ''}>{c.title}</span>
                      {track.active?.id === c.id && <span className="label ml-auto">on this now</span>}
                    </div>
                  ))}
                </section>
              ))}
            </div>
            <aside className="min-w-0 flex-[1_1_300px] space-y-6">
              <ActivityGrid arc={arc} />
              <section className="space-y-2">
                <h2 className="h2">Friends</h2>
                {friends.length === 0 && <p className="label">None.</p>}
                {friends.map((f) => (
                  <Link key={f.user.id} to={`/admin/u/${f.user.username}`} className="flex items-center gap-3">
                    <Avatar user={f.user} />
                    <span className="min-w-0 flex-1 truncate">{f.user.name}</span>
                    {!f.accepted && <span className="label">pending</span>}
                  </Link>
                ))}
              </section>
            </aside>
          </div>
        </>
      )}

      <section className="space-y-3">
        <h2 className="h2">
          Check-ins <span className="label ml-1.5 font-normal">latest {checkIns.length}</span>
        </h2>
        {checkIns.length === 0 && <p className="text-muted">None yet.</p>}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {checkIns.map((c) => (
            <article key={c.id} className="card overflow-hidden">
              {c.photo ? (
                <ProofPhoto path={c.photo} alt={`Proof for ${c.track}`} className="aspect-[4/3] w-full" />
              ) : (
                <div className="label flex aspect-[4/3] items-center justify-center bg-subtle">Photo cleared</div>
              )}
              <div className="space-y-1 p-3 text-[14px]">
                <div className="truncate">{c.checkpoint ?? c.track}</div>
                <div className="label truncate">
                  {c.checkpoint ? `${c.track} · ` : ''}
                  {c.trackIsPublic ? '' : 'private · '}
                  {when(c.uploadedAt)}
                </div>
                {c.note && <p className="label break-words">{c.note}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  )
}

export function AdminUploads() {
  const { data, placeholder } = useAdmin<{ proofs: AdminProof[] }>(api.getAdminProofs)
  const proofs = data?.proofs
  return (
    <Shell
      title="Uploaded photos"
      intro="The latest proof photos from everyone, newest first. Nobody but admins sees these, not even the uploader's friends. Click a photo to open it full size."
    >
      {!proofs ? (
        placeholder
      ) : (
        <>
          {proofs.length === 0 && <p className="text-muted">Nobody has uploaded a photo yet.</p>}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {proofs.map((proof) => (
              <article key={proof.id} className="card overflow-hidden">
                <ProofPhoto path={proof.photo} alt={`Proof from ${proof.user.name}`} className="aspect-[4/3] w-full" />
                <div className="space-y-2 p-3 text-[14px]">
                  <Link to={`/admin/u/${proof.user.username}`} className="flex items-center gap-2">
                    <Avatar user={proof.user} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{proof.user.name}</span>
                      <span className="label block truncate">@{proof.user.username}</span>
                    </span>
                  </Link>
                  <div>
                    <div className="truncate">{proof.checkpoint ?? proof.track}</div>
                    <div className="label truncate">
                      {proof.checkpoint ? `${proof.track} · ` : ''}
                      {when(proof.uploadedAt)}
                    </div>
                  </div>
                  {proof.note && <p className="label break-words">{proof.note}</p>}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </Shell>
  )
}
