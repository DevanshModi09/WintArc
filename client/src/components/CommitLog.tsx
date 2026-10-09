import { useState } from 'react'
import { today, type Commit } from '../api'

// How many show before the rest are folded away.
const SHOWN = 3

const commitDay = (date: string) => {
  if (date === today()) return 'Today'
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

// A track's commits, newest first: the day, the message, and the checkpoint it
// went towards. The latest few show, and the rest open on a click.
export function CommitLog({ commits }: { commits: Commit[] }) {
  const [open, setOpen] = useState(false)
  if (commits.length === 0) return null
  const shown = open ? commits : commits.slice(0, SHOWN)

  return (
    <div className="border-t border-line">
      <div className="label px-4 pt-3">
        {commits.length} {commits.length === 1 ? 'commit' : 'commits'}
      </div>
      <ol className="px-4 py-2">
        {shown.map((commit) => (
          <li key={commit.date} className="flex gap-3 py-1.5 text-[14px]">
            <span className="w-14 shrink-0 text-muted">{commitDay(commit.date)}</span>
            <span className="min-w-0 flex-1">
              <span className="break-words">{commit.note ?? <span className="text-muted">No message</span>}</span>
              {commit.checkpoint && <span className="label block truncate">{commit.checkpoint}</span>}
            </span>
          </li>
        ))}
      </ol>
      {commits.length > SHOWN && (
        <button className="label block w-full border-t border-line px-4 py-2.5 text-left hover:text-fg" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Show fewer' : `Show all ${commits.length}`}
        </button>
      )}
    </div>
  )
}
