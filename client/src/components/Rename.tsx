import { useRef, useState } from 'react'

type RenameProps = { value: string; label: string; maxLength: number; onSave: (value: string) => void; onCancel: () => void }

// A text field that saves on Enter or when you click away, and backs out on Escape.
export function Rename({ value, label, maxLength, onSave, onCancel }: RenameProps) {
  const [draft, setDraft] = useState(value)
  // Escape unmounts the field, which would otherwise fire its blur and save.
  const cancelled = useRef(false)

  function save() {
    if (cancelled.current) return
    const next = draft.trim()
    if (next && next !== value) onSave(next)
    else onCancel()
  }

  return (
    <input
      autoFocus
      className="h-8 min-w-0 flex-1 rounded-xl border border-fg bg-transparent px-2 outline-none"
      aria-label={label}
      maxLength={maxLength}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          cancelled.current = true
          onCancel()
        }
      }}
    />
  )
}

export function Pencil() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}
