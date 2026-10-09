import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Schedule } from '../api'
import { DAY_NAMES, DURATIONS, REMINDERS, formatDuration } from '../schedule'
import { ClockPicker } from './ClockPicker'

// The shortest and longest session the server accepts.
const MIN_MINUTES = 15
const MAX_MINUTES = 720

const chipClass = (selected: boolean) =>
  `inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-3 font-mono text-[13px] transition ${
    selected ? 'border-fg bg-fg text-bg' : 'border-line hover:border-fg'
  }`

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="label w-20 shrink-0">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

type DropdownProps<T> = {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}

// A themed stand-in for <select> and <input type="time">, whose native
// pop-ups ignore the app's colours.
function Dropdown<T extends string | number | null>({ label, value, options, onChange, disabled }: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
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

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className={`${chipClass(false)} flex items-center gap-2`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {options.find((o) => o.value === value)?.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div role="listbox" aria-label={label} className="card absolute top-9 left-0 z-10 max-h-56 rounded-[20px] min-w-full overflow-y-auto p-1 shadow-lg">
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              role="option"
              aria-selected={o.value === value}
              // Opens with the current choice in view.
              ref={o.value === value ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
              className={`block w-full rounded px-2.5 py-1.5 text-left font-mono text-[13px] whitespace-nowrap ${
                o.value === value ? 'bg-fg text-bg' : 'hover:bg-subtle'
              }`}
              onClick={() => {
                setOpen(false)
                onChange(o.value)
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type Props = { value: Schedule; onChange: (changes: Partial<Schedule>) => void }

export function SchedulePicker({ value, onChange }: Props) {
  function toggleDay(day: number) {
    const days = value.days.includes(day) ? value.days.filter((d) => d !== day) : [...value.days, day].sort()
    // A track has to run on at least one day.
    if (days.length > 0) onChange({ days })
  }

  return (
    <div className="space-y-2.5 border-b border-line px-4 py-3">
      <Row label="Days">
        {DAY_NAMES.map((name, day) => (
          <button
            key={day}
            type="button"
            className={chipClass(value.days.includes(day))}
            aria-label={name}
            aria-pressed={value.days.includes(day)}
            onClick={() => toggleDay(day)}
          >
            {name.slice(0, 3)}
          </button>
        ))}
      </Row>
      <Row label="Time a day">
        {DURATIONS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className={chipClass(value.minutes === minutes)}
            aria-pressed={value.minutes === minutes}
            onClick={() => onChange({ minutes })}
          >
            {formatDuration(minutes)}
          </button>
        ))}
        {/* Anything between the presets, a quarter of an hour at a time. */}
        <span className="flex items-center gap-1" role="group" aria-label="Adjust by 15 minutes">
          <button
            type="button"
            className={chipClass(false)}
            aria-label="15 minutes less"
            disabled={value.minutes <= MIN_MINUTES}
            onClick={() => onChange({ minutes: Math.max(MIN_MINUTES, value.minutes - 15) })}
          >
            −
          </button>
          {!DURATIONS.includes(value.minutes) && <span className={chipClass(true)}>{formatDuration(value.minutes)}</span>}
          <button
            type="button"
            className={chipClass(false)}
            aria-label="15 minutes more"
            disabled={value.minutes >= MAX_MINUTES}
            onClick={() => onChange({ minutes: Math.min(MAX_MINUTES, value.minutes + 15) })}
          >
            +
          </button>
        </span>
      </Row>
      <Row label="Starts at">
        <ClockPicker
          value={value.startTime}
          // A reminder is relative to the start time, so it goes when the time does.
          onChange={(startTime) => onChange(startTime ? { startTime } : { startTime, reminder: null })}
        />
        <Dropdown
          label="Reminder"
          disabled={!value.startTime}
          value={value.reminder}
          options={[{ value: null, label: 'No reminder' }, ...REMINDERS]}
          onChange={(reminder) => onChange({ reminder })}
        />
      </Row>
    </div>
  )
}
