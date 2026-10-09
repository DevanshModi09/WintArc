import type { Arc, DayStatus } from './api'

// Draws the wrap as a 1080x1350 image (the portrait size social apps like),
// straight onto a canvas so there's nothing to screenshot.

const W = 1080
const H = 1350
const PAD = 80
const BG = '#141413'
const FG = '#f3f0ee'
const MUTED = '#a8a39d'
const CELLS: Record<DayStatus, string> = { perfect: FG, partial: '#77716a', missed: '#6b2d16', empty: '#2a2826' }

const SANS = "'Sofia Sans', Arial, sans-serif"
// The small print is the same face, just lighter.
const MONO = SANS

// `tiles` are up to six [number, label] pairs. `days` is how much of the grid
// to fill in, for a wrap of only the first part of the arc.
type Wrap = { arc: Arc; username: string; title: string; subtitle: string; tiles: string[][]; footer: string; days?: number }

export async function wrappedImage({ arc, username, title, subtitle, tiles, footer, days = arc.totalDays }: Wrap): Promise<Blob> {
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

  text(title, PAD, 250, `700 84px ${SANS}`)
  text(subtitle, PAD, 304, `500 30px ${MONO}`, MUTED)

  // The whole arc, one square a day.
  const cols = 15
  const gap = 8
  const cell = (W - PAD * 2 - gap * (cols - 1)) / cols
  for (let i = 0; i < arc.totalDays; i++) {
    ctx.fillStyle = CELLS[(i < days && arc.days[i]?.status) || 'empty']
    ctx.beginPath()
    ctx.roundRect(PAD + (i % cols) * (cell + gap), 360 + Math.floor(i / cols) * (cell + gap), cell, cell, cell / 2)
    ctx.fill()
  }

  // The headline numbers, three to a row.
  const top = 360 + 6 * (cell + gap) + 70
  tiles.forEach(([value, label], i) => {
    const x = PAD + (i % 3) * ((W - PAD * 2) / 3)
    const y = top + Math.floor(i / 3) * 190
    text(value, x, y + 80, `700 88px ${SANS}`)
    text(label, x, y + 122, `500 26px ${MONO}`, MUTED)
  })

  text(footer, PAD, H - PAD, `500 28px ${MONO}`, MUTED)

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the image"))), 'image/png'),
  )
}
