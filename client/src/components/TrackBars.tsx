import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect } from 'react'
import type { Track } from '../api'
import { trackProgress } from '../arcStats'
import { ProgressBar } from './Motion'

const EASE = [0.2, 0.7, 0.2, 1] as const
const SECONDS = 0.9

// A percentage that counts up from zero as its bar fills.
function CountUp({ to, delay }: { to: number; delay: number }) {
  const still = useReducedMotion()
  const value = useMotionValue(still ? to : 0)
  const shown = useTransform(value, (v) => `${Math.round(v)}%`)
  useEffect(() => {
    if (still) return value.set(to)
    const controls = animate(value, to, { duration: SECONDS, delay, ease: EASE })
    return () => controls.stop()
  }, [to, delay, still, value])
  return <motion.span>{shown}</motion.span>
}

// "Devansh has 4 tracks", then how far along each one is: a bar per track
// that fills as the page opens, one after another. A track's progress is the
// share of its checkpoints finished; one without checkpoints has nothing to
// measure, so it shows its days done instead.
export function TrackBars({ name, tracks, own }: { name: string; tracks: Track[]; own: boolean }) {
  if (tracks.length === 0) return null
  const checkpoints = tracks.flatMap((t) => t.checkpoints)
  const overall = trackProgress({ checkpoints })
  const count = `${tracks.length} ${own ? '' : 'public '}${tracks.length === 1 ? 'track' : 'tracks'}`

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="h2 text-xl">{own ? `You have ${count}` : `${name} has ${count}`}</h2>
        {overall !== null && (
          <span className="label">
            <span className="text-xl font-medium text-fg">
              <CountUp to={overall} delay={0} />
            </span>{' '}
            overall · {checkpoints.filter((c) => c.done).length} of {checkpoints.length} checkpoints
          </span>
        )}
      </div>

      <ul className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2">
        {tracks.map((track, i) => {
          const progress = trackProgress(track)
          const delay = 0.15 + i * 0.09
          const done = track.checkpoints.filter((c) => c.done).length
          return (
            <li key={track.id} className="min-w-0 space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate font-medium">{track.name}</span>
                <span className="font-medium tabular-nums">{progress === null ? '–' : <CountUp to={progress} delay={delay} />}</span>
              </div>
              <ProgressBar percent={progress ?? 0} delay={delay} label={`${track.name} progress`} className="h-2" fill="bg-accent" />
              <p className="label truncate">
                {progress === null
                  ? `No checkpoints · ${track.total} ${track.total === 1 ? 'day' : 'days'} done`
                  : track.complete
                    ? `All ${track.checkpoints.length} checkpoints finished`
                    : `${done} of ${track.checkpoints.length} · on ${track.active?.title}`}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
