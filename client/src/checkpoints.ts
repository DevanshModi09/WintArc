// Turns a pasted block of text into checkpoint titles, one per line.
//
// A numbered list ("6. Arrays", "7) Strings") is taken at its word: only the
// numbered lines count, which is what makes a playlist copied off a video
// site work, where every title sits among durations, view counts and dates.
// Anything else is treated as a plain list, minus bullets and that same noise.

const NUMBERED = /^\d{1,3}[.)]\s+(.+)$/
const BULLET = /^(?:[-*•–]|\[[ xX]?\])\s+/
// "1:24:51", "148K", "6.5K views", "4y ago", "3 months ago".
const NOISE = /^(?:\d{1,2}(?::\d{2}){1,2}|[\d.,]+\s*[KMB]?(?:\s+views?)?|\d+\s*(?:y|mo|w|d|h|years?|months?|weeks?|days?|hours?)\s+ago)$/i

export function parseCheckpoints(text: string, maxLength = 80): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const numbered = lines.flatMap((line) => line.match(NUMBERED)?.[1] ?? [])
  const titles = numbered.length >= 2 ? numbered : lines.filter((line) => !NOISE.test(line)).map((line) => line.replace(BULLET, ''))

  const seen = new Set<string>()
  return titles
    .map((title) => title.trim().slice(0, maxLength).trim())
    .filter((title) => title && !seen.has(title.toLowerCase()) && seen.add(title.toLowerCase()))
}
