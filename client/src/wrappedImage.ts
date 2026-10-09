import type { Arc, DayStatus } from './api'
import type { wrappedStats } from './arcStats'

// Draws the wrap as a 1080x1350 image (the portrait size social apps like),
// straight onto a canvas so there's nothing to screenshot.

const W = 1080
const H = 1350
const PAD = 80
const BG = '#0a0a0a'
const FG = '#ededed'
const MUTED = '#a1a1a1'
const CELLS: Record<DayStatus, string> = { perfect: FG, partial: '#6b6b6b', missed: '#5c2424', empty: '#1f1f1f' }

const SANS = "'Space Grotesk', system-ui, sans-serif"
const MONO = "'Geist Mono', ui-monospace, monospace"

type Wrap = { arc: Arc; name: string; username: string; stats: ReturnType<typeof wrappedStats> }

export async function wrappedImage({ arc, name, username, stats }: Wrap): Promise<Blob> {
  // Canvas text falls back to a system font unless the web fonts are in.
  await Promise.all([document.fonts.load(`700 80px ${SANS}`), document.fonts.load(`500 28px ${MONO}`)]).catch(() => {})

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  const text = (value: string, x: number, y: number, font: string, color = FG, align: CanvasTextAlign = 'left') => {
    ctx.font = font
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.fillText(value, x, y)
  }

  // Header: the mark, who it is, and the arc.
  ctx.fillStyle = FG
  ctx.beginPath()
  ctx.moveTo(PAD + 18, 86)
  ctx.lineTo(PAD + 36, 120)
  ctx.lineTo(PAD, 120)
  ctx.fill()
  text('WintArc', PAD + 50, 118, `700 34px ${SANS}`)
  text(`@${username}`, W - PAD, 118, `500 28px ${MONO}`, MUTED, 'right')

  text(arc.name, PAD, 250, `700 84px ${SANS}`)
  text(`${name} · ${arc.isOver ? `${arc.totalDays} days` : `day ${arc.dayNumber} of ${arc.totalDays}`}`, PAD, 304, `500 30px ${MONO}`, MUTED)

  // The whole arc, one square a day.
  const cols = 15
  const gap = 8
  const cell = (W - PAD * 2 - gap * (cols - 1)) / cols
  for (let i = 0; i < arc.totalDays; i++) {
    ctx.fillStyle = CELLS[arc.days[i]?.status ?? 'empty']
    ctx.beginPath()
    ctx.roundRect(PAD + (i % cols) * (cell + gap), 360 + Math.floor(i / cols) * (cell + gap), cell, cell, 6)
    ctx.fill()
  }

  // Six headline numbers in a 2 x 3 grid.
  const tiles = [
    [`${stats.perfectDays}`, 'perfect days'],
    [`${stats.bestStreak}d`, 'best streak'],
    [`${stats.consistency}%`, 'consistency'],
    [`${stats.totalCheckIns}`, 'check-ins'],
    [stats.checkpointsTotal ? `${stats.checkpointsDone}/${stats.checkpointsTotal}` : '–', 'checkpoints'],
    [`L${stats.level}`, stats.levelTitle.toLowerCase()],
  ]
  const top = 360 + 6 * (cell + gap) + 70
  tiles.forEach(([value, label], i) => {
    const x = PAD + (i % 3) * ((W - PAD * 2) / 3)
    const y = top + Math.floor(i / 3) * 190
    text(value, x, y + 80, `700 88px ${SANS}`)
    text(label, x, y + 122, `500 26px ${MONO}`, MUTED)
  })

  const footer = stats.topTrack ? `Strongest track: ${stats.topTrack.name} · ${stats.topTrack.bestStreak}d` : `${stats.xp.toLocaleString()} XP`
  text(footer, PAD, H - PAD, `500 28px ${MONO}`, MUTED)

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the image"))), 'image/png'),
  )
}
