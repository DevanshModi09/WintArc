import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Arc, type User } from '../api'
import { wrappedStats } from '../arcStats'
import { ErrorNote, Loading, Logo } from '../components/ArcParts'
import { useTitle } from '../useTitle'
import { wrappedImage } from '../wrappedImage'

const CELL: Record<string, string> = {
  perfect: 'bg-fg',
  partial: 'bg-cell-partial',
  missed: 'bg-cell-missed',
  empty: 'bg-cell',
}

// The arc summed up on one card you can save or share. It works mid-arc too,
// as a look at how things stand so far.
export function Wrapped({ user }: { user: User }) {
  // undefined = still loading
  const [arc, setArc] = useState<Arc | null>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
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
        <h1 className="text-[32px] leading-[1.1] font-bold">Wrapped</h1>
        <p className="text-muted">
          {arc ? 'Your arc hasn’t started yet. Your wrap fills in from day 1.' : "You don't have an arc yet."}{' '}
          <Link to="/" className="font-medium text-fg hover:underline">
            Back to Today
          </Link>
        </p>
      </div>
    )
  }

  const stats = wrappedStats(arc)
  const tiles = [
    { value: stats.perfectDays, label: 'perfect days' },
    { value: `${stats.bestStreak}d`, label: 'best streak' },
    { value: `${stats.consistency}%`, label: 'consistency' },
    { value: stats.totalCheckIns, label: 'check-ins' },
    { value: stats.checkpointsTotal ? `${stats.checkpointsDone}/${stats.checkpointsTotal}` : '–', label: 'checkpoints' },
    { value: `L${stats.level}`, label: stats.levelTitle.toLowerCase() },
  ]

  async function make(action: (file: File) => Promise<void> | void) {
    if (!arc) return
    setError('')
    setBusy(true)
    try {
      const blob = await wrappedImage({ arc, name: user.name, username: user.username, stats })
      await action(new File([blob], `${arc.name} wrapped.png`, { type: 'image/png' }))
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

  return (
    <div className="mx-auto max-w-[520px] space-y-6">
      <header>
        <h1 className="text-[32px] leading-[1.1] font-bold">{arc.isOver ? 'Your arc, wrapped' : 'Your arc so far'}</h1>
        {!arc.isOver && (
          <p className="mt-2 text-muted">
            Day {arc.dayNumber} of {arc.totalDays}. The final wrap lands when the arc ends.
          </p>
        )}
      </header>

      <ErrorNote message={error} />

      <section className="card space-y-6 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="font-mono text-[13px] text-muted">@{user.username}</span>
        </div>
        <div>
          <h2 className="text-[40px] leading-none font-bold">{arc.name}</h2>
          <p className="mt-2 font-mono text-[13px] text-muted">
            {user.name} · {arc.isOver ? `${arc.totalDays} days` : `day ${arc.dayNumber} of ${arc.totalDays}`}
          </p>
        </div>
        <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-[3px]">
          {Array.from({ length: arc.totalDays }, (_, i) => (
            <div key={i} className={`aspect-square rounded-[3px] ${CELL[arc.days[i]?.status ?? 'empty']}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-6">
          {tiles.map((t) => (
            <div key={t.label}>
              <div className="text-[34px] leading-none font-bold">{t.value}</div>
              <div className="mt-1.5 font-mono text-[12px] text-muted">{t.label}</div>
            </div>
          ))}
        </div>
        <p className="font-mono text-[13px] text-muted">
          {stats.topTrack
            ? `Strongest track: ${stats.topTrack.name} · ${stats.topTrack.bestStreak}d`
            : `${stats.xp.toLocaleString()} XP`}
          {stats.badges > 0 && ` · ${stats.badges} ${stats.badges === 1 ? 'reward' : 'rewards'}`}
        </p>
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
    </div>
  )
}
