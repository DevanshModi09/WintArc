import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type Arc, type User } from '../api'
import { MILESTONES, milestoneStats, milestoneUnlocked, wrappedStats } from '../arcStats'
import { ErrorNote, Loading, Logo } from '../components/ArcParts'
import { useTitle } from '../useTitle'
import { wrappedImage } from '../wrappedImage'

const CELL: Record<string, string> = {
  perfect: 'bg-fg',
  partial: 'bg-cell-partial',
  missed: 'bg-cell-missed',
  empty: 'bg-cell',
}

const longDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

// What goes on the card: either the whole arc, or just its first `day` days.
function cardFor(arc: Arc, user: User, day: number | null) {
  if (day) {
    const s = milestoneStats(arc, day)
    return {
      title: `${day} days in`,
      subtitle: `${user.name} · ${arc.name}`,
      days: day,
      tiles: [
        [`${s.perfectDays}`, 'perfect days'],
        [`${s.bestStreak}d`, 'best streak'],
        [`${s.consistency}%`, 'consistency'],
        [`${s.totalCheckIns}`, 'check-ins'],
      ],
      footer: `${arc.totalDays - day} days to go`,
    }
  }
  const s = wrappedStats(arc)
  const footer = s.topTrack ? `Strongest track: ${s.topTrack.name} · ${s.topTrack.bestStreak}d` : `${s.xp.toLocaleString()} XP`
  return {
    title: arc.name,
    subtitle: `${user.name} · ${arc.isOver ? `${arc.totalDays} days` : `day ${arc.dayNumber} of ${arc.totalDays}`}`,
    days: arc.totalDays,
    tiles: [
      [`${s.perfectDays}`, 'perfect days'],
      [`${s.bestStreak}d`, 'best streak'],
      [`${s.consistency}%`, 'consistency'],
      [`${s.totalCheckIns}`, 'check-ins'],
      [s.checkpointsTotal ? `${s.checkpointsDone}/${s.checkpointsTotal}` : '–', 'checkpoints'],
      [`L${s.level}`, s.levelTitle.toLowerCase()],
    ],
    footer: footer + (s.badges > 0 ? ` · ${s.badges} ${s.badges === 1 ? 'reward' : 'rewards'}` : ''),
  }
}

// The arc summed up on one card you can save or share. Day 30 and day 60 each
// unlock a smaller one on the way, and the full wrap works mid-arc too as a
// look at how things stand so far.
export function Wrapped({ user }: { user: User }) {
  // undefined = still loading
  const [arc, setArc] = useState<Arc | null>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [params, setParams] = useSearchParams()
  useTitle('Wrapped')

  useEffect(() => {
    api.getArc().then(
      (res) => setArc(res.arc),
      (err: Error) => setError(err.message),
    )
  }, [])

  if (arc === undefined) return error ? <ErrorNote message={error} /> : <Loading />
  if (arc === null || arc.startsIn > 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-[40px] leading-none font-medium">Wrapped</h1>
        <p className="text-muted">
          {arc ? 'Your arc hasn’t started yet. Your wrap fills in from day 1.' : "You don't have an arc yet."}{' '}
          <Link to="/" className="font-medium text-fg hover:underline">
            Back to Today
          </Link>
        </p>
      </div>
    )
  }

  // A milestone that isn't open yet falls back to the full wrap.
  const asked = Number(params.get('day'))
  const day = MILESTONES.includes(asked) && milestoneUnlocked(arc, asked) ? asked : null
  const card = cardFor(arc, user, day)
  const reflections = arc.reflections ?? []

  async function make(action: (file: File) => Promise<void> | void) {
    if (!arc) return
    setError('')
    setBusy(true)
    try {
      const blob = await wrappedImage({ arc, username: user.username, ...card })
      await action(new File([blob], `${arc.name} ${day ? `day ${day}` : 'wrapped'}.png`, { type: 'image/png' }))
    } catch (err) {
      // Closing the share sheet isn't a failure.
      if ((err as Error).name !== 'AbortError') setError((err as Error).message)
    }
    setBusy(false)
  }

  const save = () =>
    make((file) => {
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })

  const share = () => make((file) => navigator.share({ files: [file], title: `${arc.name} wrapped` }))
  // Mostly phones: desktop browsers rarely share files.
  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([], 'x.png', { type: 'image/png' })] })

  const tabClass = (selected: boolean) =>
    `h-8 rounded-full border px-3 font-mono text-[13px] transition disabled:cursor-not-allowed ${
      selected ? 'border-fg bg-fg text-bg' : 'border-line hover:border-fg disabled:hover:border-line'
    }`

  return (
    <div className="mx-auto max-w-[520px] space-y-6">
      <header className="space-y-3">
        <h1 className="text-[40px] leading-none font-medium">{arc.isOver ? 'Your arc, wrapped' : 'Your arc so far'}</h1>
        {!arc.isOver && (
          <p className="text-muted">
            Day {arc.dayNumber} of {arc.totalDays}. A card unlocks after day 30 and day 60, and the final wrap lands when
            the arc ends.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Which wrap">
          {MILESTONES.map((m) => {
            const open = milestoneUnlocked(arc, m)
            return (
              <button
                key={m}
                className={tabClass(day === m)}
                aria-pressed={day === m}
                disabled={!open}
                title={open ? undefined : `Unlocks after day ${m}`}
                onClick={() => setParams({ day: String(m) })}
              >
                Day {m}
                {!open && ' · locked'}
              </button>
            )
          })}
          <button className={tabClass(day === null)} aria-pressed={day === null} onClick={() => setParams({})}>
            {arc.isOver ? 'Final' : 'So far'}
          </button>
        </div>
      </header>

      <ErrorNote message={error} />

      <section className="card space-y-6 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="font-mono text-[13px] text-muted">@{user.username}</span>
        </div>
        <div>
          <h2 className="text-[48px] leading-none font-medium">{card.title}</h2>
          <p className="mt-2 font-mono text-[13px] text-muted">{card.subtitle}</p>
        </div>
        <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-[3px]">
          {Array.from({ length: arc.totalDays }, (_, i) => (
            <div key={i} className={`aspect-square rounded-cell ${CELL[(i < card.days && arc.days[i]?.status) || 'empty']}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-6">
          {card.tiles.map(([value, label]) => (
            <div key={label}>
              <div className="text-[34px] leading-none font-bold">{value}</div>
              <div className="mt-1.5 font-mono text-[12px] text-muted">{label}</div>
            </div>
          ))}
        </div>
        <p className="font-mono text-[13px] text-muted">{card.footer}</p>
      </section>

      <div className="flex flex-wrap gap-2">
        {canShare && (
          <button className="btn" disabled={busy} onClick={share}>
            Share
          </button>
        )}
        <button className={canShare ? 'btn-outline' : 'btn'} disabled={busy} onClick={save}>
          Save as image
        </button>
        <Link to="/" className="btn-outline">
          Back to Today
        </Link>
      </div>

      {reflections.length > 0 && (
        <section className="space-y-3 pt-4">
          <h2 className="h2">
            In your own words <span className="label ml-1.5 font-normal">only you can see this</span>
          </h2>
          <ol className="card divide-y divide-line">
            {reflections.map((r) => (
              <li key={r.date} className="flex gap-4 px-4 py-3">
                <span className="w-16 shrink-0 font-mono text-[13px] text-muted">{longDate(r.date)}</span>
                <span className="min-w-0 break-words">{r.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
