import { useEffect, useRef, useState } from 'react'
import { formatTime } from '../schedule'

const pad = (n: number) => String(n).padStart(2, '0')

// Where the nth of twelve marks sits on the dial, as percentages of its box.
function spot(n: number, radius = 40) {
  const angle = (n / 12) * 2 * Math.PI
  return { left: 50 + radius * Math.sin(angle), top: 50 - radius * Math.cos(angle) }
}

type Props = { value: string | null; onChange: (time: string | null) => void }

// A start time picked on a clock face: tap the hour, then the minutes, and
// flip AM or PM. Minutes go in fives on the dial, with a nudge either way for
// anything in between. Every tap applies straight away.
export function ClockPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'hour' | 'minute'>('hour')
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Evenings are the usual answer, so an unset time starts from 6 PM.
  const [hours24, minutes] = (value ?? '18:00').split(':').map(Number)
  const pm = hours24 >= 12
  const hour12 = hours24 % 12 || 12

  const set = (hour: number, minute: number, isPm: boolean) =>
    onChange(`${pad((hour % 12) + (isPm ? 12 : 0))}:${pad(((minute % 60) + 60) % 60)}`)

  // In hour mode the marks are 12, 1 … 11; in minute mode 00, 05 … 55.
  const marks = Array.from({ length: 12 }, (_, n) =>
    mode === 'hour'
      ? { n, label: String(n || 12), selected: hour12 % 12 === n, pick: () => set(n, minutes, pm) }
      : { n, label: pad(n * 5), selected: minutes === n * 5, pick: () => set(hour12, n * 5, pm) },
  )
  const hand = spot(mode === 'hour' ? hour12 % 12 : minutes / 5, 30)

  const segment = (selected: boolean) =>
    `rounded-[8px] px-2 py-1 text-[32px] leading-none font-medium tabular-nums ${selected ? 'bg-accent/20 text-fg' : 'text-muted hover:text-fg'}`
  const half = (selected: boolean) =>
    `h-7 w-11 text-[12px] font-medium ${selected ? 'bg-fg text-bg' : 'text-muted hover:text-fg'}`

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="flex h-8 items-center gap-2 rounded-full border border-line px-3 font-mono text-[13px] transition hover:border-fg"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Start time"
        onClick={() => {
          setMode('hour')
          setOpen(!open)
        }}
      >
        {value ? formatTime(value) : 'Any time'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>

      {open && (
        <div role="dialog" aria-label="Pick a start time" className="card absolute top-10 left-0 z-20 w-[264px] space-y-4 p-4 shadow-2xl max-sm:fixed max-sm:top-1/2 max-sm:left-1/2 max-sm:-translate-x-1/2 max-sm:-translate-y-1/2">
          <div className="flex items-center justify-center gap-1">
            <button type="button" className={segment(mode === 'hour')} aria-label="Hour" aria-pressed={mode === 'hour'} onClick={() => setMode('hour')}>
              {value ? hour12 : '–'}
            </button>
            <span className="text-[32px] leading-none text-muted">:</span>
            <button type="button" className={segment(mode === 'minute')} aria-label="Minutes" aria-pressed={mode === 'minute'} onClick={() => setMode('minute')}>
              {value ? pad(minutes) : '––'}
            </button>
            <span className="ml-2 flex flex-col overflow-hidden rounded-[8px] border border-line" role="group" aria-label="AM or PM">
              <button type="button" className={half(value !== null && !pm)} aria-pressed={value !== null && !pm} onClick={() => set(hour12, minutes, false)}>
                AM
              </button>
              <button type="button" className={half(value !== null && pm)} aria-pressed={value !== null && pm} onClick={() => set(hour12, minutes, true)}>
                PM
              </button>
            </span>
          </div>

          <div className="relative mx-auto aspect-square w-[216px] rounded-full bg-subtle">
            {value && (
              <svg className="absolute inset-0 size-full text-accent" viewBox="0 0 100 100" aria-hidden="true">
                <line x1="50" y1="50" x2={hand.left} y2={hand.top} stroke="currentColor" strokeWidth="1" />
                <circle cx="50" cy="50" r="1.6" fill="currentColor" />
              </svg>
            )}
            {marks.map((mark) => {
              const at = spot(mark.n)
              return (
                <button
                  key={mark.label}
                  type="button"
                  className={`absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[13px] tabular-nums transition ${
                    value && mark.selected ? 'bg-accent font-medium text-white' : 'hover:bg-cell'
                  }`}
                  style={{ left: `${at.left}%`, top: `${at.top}%` }}
                  aria-pressed={value !== null && mark.selected}
                  onClick={() => {
                    mark.pick()
                    // Hour first, then straight on to the minutes.
                    if (mode === 'hour') setMode('minute')
                  }}
                >
                  {mark.label}
                </button>
              )
            })}
          </div>

          {mode === 'minute' && (
            <div className="flex items-center justify-center gap-2 text-[13px]">
              <button type="button" className="h-7 rounded-full border border-line px-3 hover:border-fg" onClick={() => set(hour12, minutes - 1, pm)}>
                − 1 min
              </button>
              <button type="button" className="h-7 rounded-full border border-line px-3 hover:border-fg" onClick={() => set(hour12, minutes + 1, pm)}>
                + 1 min
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
            <button
              type="button"
              className="text-[13px] text-muted hover:text-fg"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              No set time
            </button>
            <button type="button" className="btn h-8 px-4 text-[13px]" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
