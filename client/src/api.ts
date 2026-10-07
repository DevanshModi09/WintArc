import { supabase } from './supabase'

export type PublicUser = { id: string; name: string; username: string; avatarUrl: string | null }
export type User = PublicUser & { email: string }

export type Streak = { current: number; best: number }
export type DayStatus = 'perfect' | 'partial' | 'missed' | 'empty'
export type Level = { number: number; title: string; xpIntoLevel: number; xpPerLevel: number }
export type Badge = { days: number; name: string; xp: number; earned: boolean }

export type Goal = {
  id: string
  title: string
  doneToday: boolean
  total: number
  streak: Streak
}

export type Track = { id: string; name: string; isPublic: boolean; streak: Streak; goals: Goal[] }

export type Arc = {
  id: string
  name: string
  startDate: string
  endDate: string
  totalDays: number
  dayNumber: number
  // Days until the arc begins; 0 once it has started.
  startsIn: number
  isOver: boolean
  streak: Streak
  perfectDays: number
  today: { done: number; total: number }
  xp: number
  level: Level
  badges: Badge[]
  days: { date: string; status: DayStatus }[]
  tracks: Track[]
}

// The headline numbers a friend sees in a list.
export type ArcSummary = Pick<
  Arc,
  'name' | 'dayNumber' | 'totalDays' | 'startsIn' | 'isOver' | 'streak' | 'level' | 'xp' | 'today'
>

export type Relation = 'self' | 'friends' | 'incoming' | 'outgoing' | 'none'
export type RelationInfo = { relation: Relation; friendshipId: string | null }

export type Profile = RelationInfo & { user: PublicUser & { createdAt: string }; arc: Arc | null }
export type FriendRequest = { friendshipId: string; user: PublicUser }
export type Friends = {
  friends: (FriendRequest & { arc: ArcSummary | null })[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}

export type NewTrack = { name: string; isPublic: boolean; goals: { title: string }[] }

type ArcResponse = { arc: Arc | null }

// The user's local calendar date, which is what a "day" means for streaks.
export function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const headers: Record<string, string> = {}
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error ?? 'Could not reach the server')
  return json as T
}

export const api = {
  me: () => request<{ user: User | null; suggestedName: string }>('GET', '/auth/me'),
  createProfile: (input: { name: string; username: string }) =>
    request<{ user: User }>('POST', '/auth/profile', input),
  setAvatar: (image: string) => request<{ user: User }>('PUT', '/auth/avatar', { image }),
  removeAvatar: () => request<{ user: User }>('DELETE', '/auth/avatar'),

  getArc: () => request<ArcResponse>('GET', `/arc?today=${today()}`),
  createArc: (input: { name: string; tracks: NewTrack[] }) =>
    request<ArcResponse>('POST', '/arc', { ...input, today: today() }),
  deleteArc: (id: string) => request<ArcResponse>('DELETE', `/arc/${id}?today=${today()}`),

  addTrack: (track: { name: string; isPublic: boolean }) =>
    request<ArcResponse>('POST', '/tracks', { ...track, today: today() }),
  updateTrack: (id: string, changes: { name?: string; isPublic?: boolean }) =>
    request<ArcResponse>('PATCH', `/tracks/${id}`, { ...changes, today: today() }),
  deleteTrack: (id: string) => request<ArcResponse>('DELETE', `/tracks/${id}?today=${today()}`),

  addGoal: (trackId: string, title: string) =>
    request<ArcResponse>('POST', '/goals', { trackId, title, today: today() }),
  deleteGoal: (id: string) => request<ArcResponse>('DELETE', `/goals/${id}?today=${today()}`),
  checkIn: (id: string, done: boolean) =>
    request<ArcResponse>('PUT', `/goals/${id}/checkin`, { done, today: today() }),

  searchUsers: (q: string) =>
    request<{ users: (PublicUser & RelationInfo)[] }>('GET', `/users?q=${encodeURIComponent(q)}`),
  getProfile: (username: string) =>
    request<Profile>('GET', `/users/${encodeURIComponent(username)}?today=${today()}`),
  getFriends: () => request<Friends>('GET', `/friends?today=${today()}`),
  addFriend: (username: string) => request<RelationInfo>('POST', '/friends', { username }),
  acceptFriend: (friendshipId: string) =>
    request<{ ok: true }>('POST', `/friends/${friendshipId}/accept`),
  removeFriend: (friendshipId: string) => request<{ ok: true }>('DELETE', `/friends/${friendshipId}`),
}
