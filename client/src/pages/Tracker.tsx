import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Arc, type User } from '../api'
import { ErrorNote, Loading } from '../components/ArcParts'
import { Checklist, type TrackerData } from '../tracker/Checklist'
import '../tracker/tracker.css'
import { useTitle } from '../useTitle'

// An A4 sheet is 210mm wide, which is this many CSS pixels.
const SHEET_PX = (210 / 25.4) * 96

const toTracker = (arc: Arc, user: User): TrackerData => ({
  name: arc.name,
  owner: user.name,
  startDate: arc.startDate,
  endDate: arc.endDate,
  tracks: arc.tracks,
})

// Your arc as a paper tracker: every checkpoint, to print or to save as a PDF
// from the browser's print window. Only the sheet is printed.
export function Tracker({ user }: { user: User }) {
  // undefined = still loading
  const [arc, setArc] = useState<Arc | null>()
  const [error, setError] = useState('')
  // The name the browser suggests for the saved PDF.
  useTitle('Checkpoint tracker')

  useEffect(() => {
    api.getArc().then(
      (res) => setArc(res.arc),
      (err: Error) => setError(err.message),
    )
  }, [])

  // Shrinks the sheet to the width there is, so a phone shows the whole page.
  const frame = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const fit = () => setScale(Math.min(1, el.clientWidth / SHEET_PX))
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [arc])

  const data = arc && toTracker(arc, user)

  return (
    <main className="mx-auto max-w-[1040px] px-4 py-8 sm:px-8 print:m-0 print:max-w-none print:p-0">
      <div className="trk-hide-in-print space-y-6 pb-8">
        <header>
          <Link to="/tracks" className="label hover:text-fg">
            ← Tracks
          </Link>
          <h1 className="mt-3 text-[32px] leading-none font-medium sm:text-[40px]">Paper tracker</h1>
          <p className="mt-2 max-w-[64ch] text-muted">
            Every checkpoint of every track, with a box to tick and a line for the date. Print it, or choose “Save as
            PDF” in the print window to keep a file. It's made for A4.
          </p>
        </header>

        <ErrorNote message={error} />

        <button className="btn" disabled={!data} onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>

      {arc === undefined && !error && <Loading />}
      {arc === null && (
        <p className="text-muted">
          You don't have an arc yet.{' '}
          <Link to="/" className="font-medium text-fg hover:underline">
            Set one up
          </Link>{' '}
          and you can print it here.
        </p>
      )}
      <div ref={frame}>
        {data && (
          <div className="trk-paper trk-preview" style={{ zoom: scale }}>
            <Checklist data={data} />
          </div>
        )}
      </div>
    </main>
  )
}
