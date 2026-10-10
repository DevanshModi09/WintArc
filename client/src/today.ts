// The user's local calendar date, which is what a "day" means for streaks.
export function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// The local weekday, indexed like Date#getDay: 0 = Sunday.
export function weekdayToday(): number {
  return new Date().getDay()
}
