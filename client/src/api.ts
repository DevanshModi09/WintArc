export type User = { id: string; name: string; email: string }

export type Streak = { current: number; best: number }

export type DayStatus = 'perfect' | 'partial' | 'missed' | 'empty'

export type Goal = {
  id: string
  title: string
  emoji: string | null
  doneToday: boolean
  total: number
  streak: Streak
}

export type Arc = {
  id: string
  name: string
  startDate: string
  endDate: string
  totalDays: number
  dayNumber: number
  isOver: boolean
  streak: Streak
  perfectDays: number
  totalCheckIns: number
  xp: number
  level: { number: number; title: string; xpIntoLevel: number; xpPerLevel: number }
  badges: { days: number; name: string; xp: number; earned: boolean }[]
  days: { date: string; status: DayStatus; done: number; total: number }[]
  goals: Goal[]
}

export type NewGoal = { title: string; emoji?: string }

type ArcResponse = { arc: Arc | null }
type UserResponse = { user: User }

// The user's local calendar date, which is what a "day" means for streaks.
export function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? 'Could not reach the server')
  return data as T
}

export const api = {
  me: () => request<UserResponse>('GET', '/auth/me'),
  signup: (input: { name: string; email: string; password: string }) =>
    request<UserResponse>('POST', '/auth/signup', input),
  login: (input: { email: string; password: string }) =>
    request<UserResponse>('POST', '/auth/login', input),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),

  getArc: () => request<ArcResponse>('GET', `/arc?today=${today()}`),
  createArc: (input: { name: string; days: number; goals: NewGoal[] }) =>
    request<ArcResponse>('POST', '/arc', { ...input, today: today() }),
  deleteArc: (id: string) => request<ArcResponse>('DELETE', `/arc/${id}?today=${today()}`),
  addGoal: (goal: NewGoal) => request<ArcResponse>('POST', '/goals', { ...goal, today: today() }),
  deleteGoal: (id: string) => request<ArcResponse>('DELETE', `/goals/${id}?today=${today()}`),
  checkIn: (id: string, done: boolean) =>
    request<ArcResponse>('PUT', `/goals/${id}/checkin`, { done, today: today() }),
}
