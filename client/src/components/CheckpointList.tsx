import { useState, type ClipboardEvent } from 'react'
import { parseCheckpoints } from '../checkpoints'

// Matches the server's limit.
const MAX_CHECKPOINTS = 30

export const CHECKPOINT_WARNING =
  "Checkpoints lock when the track is created. After that you can tick and reorder them, but you can't add, edit or delete any, so get the list right first."

// The checkpoints of a track that hasn't been created yet: type them one at a
// time, or paste a whole list and every line becomes one.
export function CheckpointList({ value, onChange }: { value: string[]; onChange: (checkpoints: string[]) => void }) {
  const [draft, setDraft] = useState('')

  function add() {
    const title = draft.trim()
    if (!title) return
    onChange([...value, title])
    setDraft('')
  }

  function paste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    if (!text.includes('\n')) return
    const titles = parseCheckpoints(text)
    if (titles.length === 0) return
    e.preventDefault()
    onChange([...value, ...titles].slice(0, MAX_CHECKPOINTS))
  }

  return (
    <>
      {value.map((checkpoint, i) => (
        <div key={i} className="flex min-h-11 items-center gap-3 border-b border-line px-4">
          <span className="flex-1">{checkpoint}</span>
          <button
            type="button"
            className="text-muted hover:text-fg"
            aria-label={`Remove ${checkpoint}`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      {value.length < MAX_CHECKPOINTS && (
        <div className="flex items-center gap-3 px-4">
          <span className="text-muted">+</span>
          <input
            className="h-11 flex-1 bg-transparent outline-none placeholder:text-muted"
            placeholder="Add a checkpoint, or paste a whole list"
            aria-label="Add a checkpoint"
            maxLength={80}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={add}
            onPaste={paste}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
          />
        </div>
      )}
    </>
  )
}

// The heads-up shown wherever a track is being created.
export function CheckpointWarning() {
  return (
    <p role="note" className="rounded-card border border-accent/40 bg-accent/10 px-4 py-3 text-[14px]">
      <span className="font-medium">Heads up.</span> {CHECKPOINT_WARNING}
    </p>
  )
}
