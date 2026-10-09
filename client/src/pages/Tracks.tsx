import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type Arc, type Track } from '../api'
import { trackProgress } from '../arcStats'
import { Checkbox, ErrorNote, Loading, Lock } from '../components/ArcParts'
import { CheckpointList, CheckpointWarning } from '../components/CheckpointList'
import { Pencil, Rename } from '../components/Rename'
import { SchedulePicker } from '../components/SchedulePicker'
import { scheduleSummary } from '../schedule'
import { useTitle } from '../useTitle'

// `optimistic` is shown straight away, so ticking doesn't wait on the network.
type Run = (action: () => Promise<{ arc: Arc | null }>, optimistic?: Arc) => Promise<void>

const withCheckpoint = (arc: Arc, id: string, done: boolean): Arc => ({
  ...arc,
  tracks: arc.tracks.map((t) => ({
    ...t,
    checkpoints: t.checkpoints.map((c) => (c.id === id ? { ...c, done } : c)),
  })),
})

const withOrder = (arc: Arc, trackId: string, ids: string[]): Arc => ({
  ...arc,
  tracks: arc.tracks.map((t) =>
    t.id === trackId ? { ...t, checkpoints: ids.map((id) => t.checkpoints.find((c) => c.id === id)!) } : t,
  ),
})

// Where tracks are set up (name, schedule, visibility) and the only place
// checkpoints are reordered. The daily check-in happens on Today.
export function Tracks() {
  // undefined = still loading
  const [arc, setArc] = useState<Arc | null>()
  const [error, setError] = useState('')
  // Counts requests, so a slow early response can't overwrite a newer one.
  const latest = useRef(0)
  useTitle('Tracks')

  const run: Run = async (action, optimistic) => {
    const id = ++latest.current
    setError('')
    if (optimistic) setArc(optimistic)
    try {
      const res = await action()
      if (id === latest.current) setArc(res.arc)
    } catch (err) {
      setError((err as Error).message)
      // Put back whatever the server really has.
      if (optimistic) api.getArc().then((res) => id === latest.current && setArc(res.arc), () => {})
    }
  }

  useEffect(() => {
    api.getArc().then(
      (res) => setArc(res.arc),
      (err: Error) => setError(err.message),
    )
  }, [])

  if (arc === undefined) return error ? <ErrorNote message={error} /> : <Loading />
  if (arc === null) {
    return (
      <div className="space-y-4">
        <h1 className="text-[40px] leading-none font-medium">Tracks</h1>
        <p className="text-muted">
          You don't have an arc yet.{' '}
          <Link to="/" className="font-medium text-fg hover:underline">
            Set one up
          </Link>{' '}
          and its tracks will show here.
        </p>
      </div>
    )
  }

  const all = arc.tracks.flatMap((t) => t.checkpoints)
  const overall = trackProgress({ checkpoints: all })
  const done = all.filter((c) => c.done).length

  return (
    <div className="mx-auto max-w-[720px] space-y-8">
      <header>
        <div className="eyebrow">{arc.name}</div>
        <div className="mt-3 flex items-end justify-between gap-6">
          <h1 className="text-[40px] leading-none font-medium">Tracks</h1>
          {/* Every checkpoint across every track, as one number. */}
          <div className="text-right" title={`${done} of ${all.length} checkpoints finished across all tracks`}>
            <div className="text-[40px] leading-none font-medium">{overall ?? 0}%</div>
            <div className="label mt-1">
              overall · {done} of {all.length} checkpoints
            </div>
          </div>
        </div>
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-cell"
          role="progressbar"
          aria-label="All checkpoints finished"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={overall ?? 0}
        >
          <div className="h-full bg-fg transition-[width]" style={{ width: `${overall ?? 0}%` }} />
        </div>
        <p className="mt-4 text-muted">
          Each track's name, when it runs, and its checkpoints. The first unfinished checkpoint in a track is the one
          you're on, and it's what you check in against on Today. Checkpoints are fixed when a track is created, so
          here you can only finish and reorder them.
        </p>
      </header>

      <ErrorNote message={error} />

      {arc.tracks.map((track) => (
        <TrackProgress
          key={track.id}
          track={track}
          editable={!arc.isOver}
          run={run}
          tick={(id, done) => run(() => api.tickCheckpoint(id, done), withCheckpoint(arc, id, done))}
          reorder={(ids) => run(() => api.reorderCheckpoints(track.id, ids), withOrder(arc, track.id, ids))}
        />
      ))}
      {!arc.isOver && <NewTrack run={run} />}
    </div>
  )
}

function NewTrack({ run }: { run: Run }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [checkpoints, setCheckpoints] = useState<string[]>([])

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    run(() => api.addTrack({ name: trimmed, isPublic, checkpoints }))
    setName('')
    setCheckpoints([])
    setOpen(false)
  }

  if (!open) {
    return (
      <button className="btn-outline" onClick={() => setOpen(true)}>
        Add a track
      </button>
    )
  }

  // The checkpoints go in with the track, because they can't be added later.
  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="h2">New track</h2>
      <p className="text-muted">Add only what you can afford to do. A new track is more time out of every day it runs.</p>
      <CheckpointWarning />
      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <input
            autoFocus
            className="input min-w-40 flex-1"
            placeholder="Track name, e.g. Web Dev"
            aria-label="New track name"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="button" className="btn-outline" onClick={() => setIsPublic(!isPublic)}>
            {isPublic ? 'Public' : 'Private'}
          </button>
        </div>
        <CheckpointList value={checkpoints} onChange={setCheckpoints} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" disabled={!name.trim()}>
          {checkpoints.length === 0
            ? 'Create track with no checkpoints'
            : `Create track with ${checkpoints.length} ${checkpoints.length === 1 ? 'checkpoint' : 'checkpoints'}`}
        </button>
        <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}

type TrackProgressProps = {
  track: Track
  editable: boolean
  run: Run
  tick: (id: string, done: boolean) => void
  reorder: (ids: string[]) => void
}

function Grip() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  )
}

const move = (ids: string[], from: number, to: number) => {
  const next = [...ids]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

function TrackProgress({ track, editable, run, tick, reorder }: TrackProgressProps) {
  const [renaming, setRenaming] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // While a checkpoint is being dragged: its id, and the order shown so far.
  const [drag, setDrag] = useState<{ id: string; ids: string[] }>()
  const saved = track.checkpoints.map((c) => c.id)
  const shown = drag ? drag.ids.map((id) => track.checkpoints.find((c) => c.id === id)!) : track.checkpoints

  // Pointer events rather than HTML drag and drop, so it works by touch too.
  function dragOver(e: PointerEvent) {
    if (!drag) return
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-checkpoint]')
    const over = row?.dataset.checkpoint
    if (!over || over === drag.id || !drag.ids.includes(over)) return
    setDrag({ ...drag, ids: move(drag.ids, drag.ids.indexOf(drag.id), drag.ids.indexOf(over)) })
  }

  function drop() {
    if (drag && drag.ids.join() !== saved.join()) reorder(drag.ids)
    setDrag(undefined)
  }

  // The same thing from the keyboard: arrow keys on the handle.
  function nudge(e: KeyboardEvent, id: string) {
    const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
    const from = saved.indexOf(id)
    if (!step || from + step < 0 || from + step >= saved.length) return
    e.preventDefault()
    reorder(move(saved, from, from + step))
  }

  const progress = trackProgress(track)
  const done = track.checkpoints.filter((c) => c.done).length

  return (
    <section className="card">
      <div className="space-y-3 border-b border-line px-4 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {renaming ? (
            <Rename
              value={track.name}
              label="Track name"
              maxLength={40}
              onCancel={() => setRenaming(false)}
              onSave={(name) => {
                setRenaming(false)
                run(() => api.updateTrack(track.id, { name }))
              }}
            />
          ) : (
            <h2 className="h2 flex flex-1 items-center gap-2">
              {track.name}
              {editable && (
                <button className="text-muted hover:text-fg" aria-label={`Rename ${track.name}`} onClick={() => setRenaming(true)}>
                  <Pencil />
                </button>
              )}
            </h2>
          )}
          <button
            className="rounded-full border border-line px-3 py-1 font-mono text-[13px] hover:border-fg disabled:opacity-100"
            title="Days, session length and start time"
            aria-expanded={editingSchedule}
            disabled={!editable}
            onClick={() => setEditingSchedule(!editingSchedule)}
          >
            {scheduleSummary(track)}
          </button>
          <button
            className="rounded-full border border-line px-3 py-1 text-[13px] hover:border-fg disabled:opacity-100"
            title={track.isPublic ? 'Visible on your profile. Click to make private.' : 'Only you can see this. Click to make public.'}
            disabled={!editable}
            onClick={() => run(() => api.updateTrack(track.id, { isPublic: !track.isPublic }))}
          >
            {track.isPublic ? 'Public' : 'Private'}
          </button>
          {confirmDelete ? (
            <>
              <button className="text-[13px] font-medium text-danger" onClick={() => run(() => api.deleteTrack(track.id))}>
                Delete track
              </button>
              <button className="text-[13px] text-muted" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          ) : track.locked ? (
            <span className="px-1 text-muted" title="This track has goals locked in for the arc, so it can't be deleted.">
              <Lock />
              <span className="sr-only">Locked in</span>
            </span>
          ) : (
            editable && (
              <button className="px-1 text-muted hover:text-fg" aria-label={`Delete ${track.name}`} onClick={() => setConfirmDelete(true)}>
                ✕
              </button>
            )
          )}
          <span className="font-mono text-xl font-semibold">{progress === null ? '–' : `${progress}%`}</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-cell"
          role="progressbar"
          aria-label={`${track.name} completed`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress ?? 0}
        >
          <div className="h-full bg-fg transition-[width]" style={{ width: `${progress ?? 0}%` }} />
        </div>
        <p className="label">
          {progress === null
            ? 'This track was created without checkpoints.'
            : `${done} of ${track.checkpoints.length} checkpoints done`}
        </p>
      </div>

      {editingSchedule && (
        <SchedulePicker value={track} onChange={(changes) => run(() => api.updateTrack(track.id, changes))} />
      )}

      {shown.map((checkpoint) => (
        <div
          key={checkpoint.id}
          data-checkpoint={checkpoint.id}
          className={`flex items-center border-b border-line last:border-b-0 ${drag?.id === checkpoint.id ? 'bg-subtle' : ''}`}
        >
          {editable && shown.length > 1 && (
            <button
              className={`flex h-11 w-9 touch-none items-center justify-center text-muted hover:text-fg ${drag ? 'cursor-grabbing' : 'cursor-grab'}`}
              aria-label={`Move ${checkpoint.title}. Drag, or use the arrow keys.`}
              title="Drag to reorder"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                setDrag({ id: checkpoint.id, ids: saved })
              }}
              onPointerMove={dragOver}
              onPointerUp={drop}
              onPointerCancel={() => setDrag(undefined)}
              onKeyDown={(e) => nudge(e, checkpoint.id)}
            >
              <Grip />
            </button>
          )}
          <button
            className={`flex min-h-11 flex-1 items-center gap-3 pr-4 text-left disabled:opacity-100 ${editable && shown.length > 1 ? '' : 'pl-4'}`}
            aria-pressed={checkpoint.done}
            disabled={!editable}
            onClick={() => tick(checkpoint.id, !checkpoint.done)}
          >
            <Checkbox checked={checkpoint.done} />
            <span className={checkpoint.done ? 'text-muted line-through' : ''}>{checkpoint.title}</span>
          </button>
        </div>
      ))}

    </section>
  )
}
