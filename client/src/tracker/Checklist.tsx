import { scheduleSummary } from '../schedule'

// The paper tracker: an arc's checkpoints laid out to be printed and ticked
// off by hand. It's styled by tracker.css alone, in black on white, so it
// prints the same from any browser and doesn't drain a cartridge.

export type TrackerTrack = {
  name: string
  // Weekdays it runs on, 0 = Sunday.
  days: number[]
  minutes: number
  startTime: string | null
  checkpoints: { title: string }[]
}

export type TrackerData = {
  name: string
  owner: string
  startDate: string
  endDate: string
  tracks: TrackerTrack[]
}

// Read as UTC, so a printout never shifts a day with the timezone.
const utc = (date: string) => new Date(`${date}T00:00:00Z`)

// "12 Oct 2026"
const fullDate = (date: string) =>
  utc(date).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })

const dayCount = (data: TrackerData) => Math.round((utc(data.endDate).getTime() - utc(data.startDate).getTime()) / 86_400_000) + 1

// Every checkpoint of every track, with a box to tick and a line for the
// date. Every box is empty, whatever is finished in the app: the paper is
// ticked by hand.
export function Checklist({ data }: { data: TrackerData }) {
  return (
    <section className="trk-sheet">
      <header className="trk-head">
        <div>
          <div className="trk-brand">WintArc · {data.name}</div>
          <h1>Checkpoint checklist</h1>
        </div>
        <div className="trk-meta">
          <div>{data.owner}</div>
          <div>
            {fullDate(data.startDate)} – {fullDate(data.endDate)} · {dayCount(data)} days
          </div>
        </div>
      </header>
      {data.tracks.map((track, i) => (
        <div key={i} className="trk-track">
          <div className="trk-track-head">
            <h2>
              {i + 1}. {track.name}
            </h2>
            <span>{scheduleSummary(track)}</span>
            <span className="trk-count">
              {track.checkpoints.length} {track.checkpoints.length === 1 ? 'checkpoint' : 'checkpoints'}
            </span>
          </div>
          <ol className="trk-checks">
            {track.checkpoints.map((c, n) => (
              <li key={n}>
                <span className="trk-box" />
                <span className="trk-num">{n + 1}</span>
                <span className="trk-title">{c.title}</span>
                <span className="trk-date-line" />
              </li>
            ))}
          </ol>
        </div>
      ))}
      <p className="trk-foot">Tick a checkpoint when it's reached and write the date on the line.</p>
    </section>
  )
}
