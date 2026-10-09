import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Checkbox } from '../components/ArcParts'
import { THEMES, currentTheme, loadAllFonts, setTheme } from '../themes'
import { useTitle } from '../useTitle'

// Every look the app can wear, each tile drawn in its own theme. Picking one
// applies it straight away and remembers it on this device.
export function Themes() {
  const [active, setActive] = useState(() => currentTheme().id)
  useTitle('Themes')

  useEffect(loadAllFonts, [])

  return (
    <div className="mx-auto max-w-[1040px] space-y-8 px-4 py-10 sm:px-8">
      <header>
        <div className="eyebrow">{THEMES.length} themes</div>
        <h1 className="mt-3 text-[40px] leading-none font-medium">Pick a look</h1>
        <p className="mt-2 max-w-[60ch] text-muted">
          Your choice is saved on this device. Linear is the default. Cream and Ink are WintArc's own. The named ones are inspired by the
          public design write-ups at getdesign.md and aren't affiliated with those companies.{' '}
          <Link to="/" className="font-medium text-fg underline underline-offset-2">
            Back to the app
          </Link>
        </p>
      </header>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            data-theme={theme.id}
            aria-pressed={theme.id === active}
            className={`flex flex-col gap-3 rounded-[16px] border p-4 text-left text-[14px] transition ${
              theme.id === active ? 'border-fg outline-2 outline-offset-2 outline-fg' : 'border-line'
            }`}
            onClick={() => {
              setTheme(theme)
              setActive(theme.id)
            }}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="h2 text-[22px]">{theme.name}</span>
              <span className="text-[12px] text-muted">{theme.id === active ? 'In use' : theme.scheme}</span>
            </span>
            <span className="card flex flex-col gap-2.5 p-3">
              <span className="flex items-center gap-2.5">
                <Checkbox checked />
                <span className="text-muted line-through">Build one feature</span>
              </span>
              <span className="flex items-center gap-2.5">
                <Checkbox checked={false} />
                <span>Study a concept</span>
              </span>
              <span className="grid grid-cols-10 gap-[3px] pt-1">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={`aspect-square rounded-cell ${i < 6 ? 'bg-fg' : i === 6 ? 'bg-cell-missed' : 'bg-cell'}`} />
                ))}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="btn pointer-events-none h-8 px-4 text-[13px]">Add track</span>
              <span className="btn-outline pointer-events-none h-8 px-4 text-[13px]">Cancel</span>
              <span className="ml-auto size-2.5 rounded-full bg-accent" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
