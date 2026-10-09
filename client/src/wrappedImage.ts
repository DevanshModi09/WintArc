import type { Arc, DayStatus } from './api'

// Draws the wrap as a 1080x1350 image (the portrait size social apps like),
// straight onto a canvas so there's nothing to screenshot.

const W = 1080
const H = 1350
const PAD = 80

// Blends two "#rrggbb" colours: `share` of the first, the rest of the second.
function mix(a: string, b: string, share: number) {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const rgb = [0, 1, 2].map((i) => Math.round(channel(a, i) * share + channel(b, i) * (1 - share)))
  return `rgb(${rgb.join(' ')})`
}

// The active theme's colours and typefaces, so the image matches the screen.
function palette() {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  const bg = read('--color-bg', '#f3f0ee')
  const fg = read('--color-fg', '#141413')
  const cells: Record<DayStatus, string> = {
    perfect: fg,
    partial: mix(fg, bg, 0.45),
    missed: mix(read('--color-danger', '#b42318'), bg, 0.38),
    empty: mix(fg, bg, 0.11),
  }
  return {
    bg,
    fg,
    muted: read('--color-muted', '#696969'),
    cells,
    sans: read('--font-sans', 'Arial, sans-serif'),
    display: read('--font-display', 'Arial, sans-serif'),
    headWeight: read('--weight-head', '500'),
    round: parseFloat(read('--radius-cell', '999')) || 0,
  }
}

// `tiles` are up to six [number, label] pairs. `days` is how much of the grid
// to fill in, for a wrap of only the first part of the arc.
type Wrap = { arc: Arc; username: string; title: string; subtitle: string; tiles: string[][]; footer: string; days?: number }

export async function wrappedImage({ arc, username, title, subtitle, tiles, footer, days = arc.totalDays }: Wrap): Promise<Blob> {
  const { bg: BG, fg: FG, muted: MUTED, cells: CELLS, sans: MONO, display: SANS, headWeight, round } = palette()
  // Canvas text falls back to a system font unless the web fonts are in.
  await Promise.all([document.fonts.load(`${headWeight} 80px ${SANS}`), document.fonts.load(`500 28px ${MONO}`)]).catch(() => {})

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
  text('WintArc', PAD + 50, 118, `${headWeight} 34px ${SANS}`)
  text(`@${username}`, W - PAD, 118, `500 28px ${MONO}`, MUTED, 'right')

  text(title, PAD, 250, `${headWeight} 84px ${SANS}`)
  text(subtitle, PAD, 304, `500 30px ${MONO}`, MUTED)

  // The whole arc, one square a day.
  const cols = 15
  const gap = 8
  const cell = (W - PAD * 2 - gap * (cols - 1)) / cols
  for (let i = 0; i < arc.totalDays; i++) {
    ctx.fillStyle = CELLS[(i < days && arc.days[i]?.status) || 'empty']
    ctx.beginPath()
    ctx.roundRect(PAD + (i % cols) * (cell + gap), 360 + Math.floor(i / cols) * (cell + gap), cell, cell, Math.min(round, cell / 2))
    ctx.fill()
  }

  // The headline numbers, three to a row.
  const top = 360 + 6 * (cell + gap) + 70
  tiles.forEach(([value, label], i) => {
    const x = PAD + (i % 3) * ((W - PAD * 2) / 3)
    const y = top + Math.floor(i / 3) * 190
    text(value, x, y + 80, `${headWeight} 88px ${SANS}`)
    text(label, x, y + 122, `500 26px ${MONO}`, MUTED)
  })

  text(footer, PAD, H - PAD, `500 28px ${MONO}`, MUTED)

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the image"))), 'image/png'),
  )
}
