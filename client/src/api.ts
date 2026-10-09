import { supabase } from './supabase'
import { today } from './today'

export { today }

export type PublicUser = { id: string; name: string; username: string; avatarUrl: string | null }
export type User = PublicUser & { email: string; sharePublic: boolean }

export type Streak = { current: number; best: number }
export type DayStatus = 'perfect' | 'partial' | 'missed' | 'empty'
export type Level = { number: number; title: string; xpIntoLevel: number; xpPerLevel: number }
export type Badge = { days: number; name: string; xp: number; earned: boolean }

// A mini task inside a goal. Ticking every one of them completes the goal.
export type Subtask = { id: string; title: string; done: boolean }

// What you did for a goal today: a line about it, a link to it, or both.
export type Proof = { note: string | null; link: string | null }

export type Goal = {
  id: string
  title: string
  // Locked goals can't be renamed or removed: the bar only goes up.
  locked: boolean
  doneToday: boolean
  proof: Proof | null
  subtasks: Subtask[]
  total: number
  streak: Streak
}

// When a track runs: weekdays (0 = Sunday), minutes per session, and an
// optional "HH:MM" start time with a reminder that many minutes before it.
export type Schedule = { days: number[]; minutes: number; startTime: string | null; reminder: number | null }

// A one-off milestone in a track. The share of them ticked is how far along
// the track is.
export type Checkpoint = { id: string; title: string; done: boolean }

export type Track = Schedule & {
  checkpoints: Checkpoint[]
  id: string
  name: string
  isPublic: boolean
  // False on the weekdays this track isn't scheduled for.
  dueToday: boolean
  // True once it holds a locked goal, after which it can't be deleted.
  locked: boolean
  streak: Streak
  goals: Goal[]
}

// Still standing until the first day something is left undone.
export type Survivor = { alive: boolean; fellOnDay: number | null }
export type Reflection = { date: string; text: string }

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
  survivor: Survivor
  perfectDays: number
  totalCheckIns: number
  today: { done: number; total: number }
  xp: number
  level: Level
  badges: Badge[]
  // `done` is how many goals were checked in that day.
  days: { date: string; status: DayStatus; done: number }[]
  tracks: Track[]
  // Your one line a day. Only present on your own arc.
  reflections?: Reflection[]
}

// The headline numbers a friend sees in a list.
export type ArcSummary = Pick<
  Arc,
  'name' | 'dayNumber' | 'totalDays' | 'startsIn' | 'isOver' | 'streak' | 'level' | 'xp' | 'today'
>

export type Relation = 'self' | 'friends' | 'incoming' | 'outgoing' | 'none'
export type RelationInfo = { relation: Relation; friendshipId: string | null }

export type ProfileDetails = { bio: string | null; stack: string[]; location: string | null; link: string | null }
export type ProfileUser = PublicUser & ProfileDetails & { createdAt: string }
export type ProfileEdit = { name: string; bio: string; stack: string[]; location: string; link: string }
// An earlier arc, summed up in one line.
export type PastArc = Pick<Arc, 'id' | 'name' | 'startDate' | 'endDate' | 'perfectDays' | 'xp'> & {
  bestStreak: number
  totalCheckIns: number
  level: number
}
export type Profile = RelationInfo & { user: ProfileUser; arc: Arc | null; pastArcs: PastArc[] }
export type FriendRequest = { friendshipId: string; user: PublicUser }
export type Friends = {
  me: { user: PublicUser; arc: ArcSummary | null }
  friends: (FriendRequest & { arc: ArcSummary | null })[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}

export type Survivors = {
  season: { startDate: string; totalDays: number; startsIn: number; dayNumber: number }
  started: number
  standing: number
  // null when you aren't running this season's arc.
  me: Survivor | null
  survivors: { user: PublicUser; streak: number; xp: number; level: number }[]
}

export type FeedEntry = {
  user: PublicUser
  date: string
  items: ({ id: string; goal: string; track: string } & Proof)[]
}

export type Commitment = { user: PublicUser & { bio: string | null }; arc: Arc | null }

// A track as it's set up with a new arc: its plan and its checkpoints.
export type NewTrack = Schedule & { name: string; isPublic: boolean; checkpoints: string[] }

type ArcResponse = { arc: Arc | null }

const OFFLINE = "Can't reach WintArc. Check your connection and try again."

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const headers: Record<string, string> = {}
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // A request that hangs is reported rather than leaving the page stuck.
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {
    throw new Error(OFFLINE)
  })
  const json = await res.json().catch(() => null)
  // The session ran out or was revoked: drop it, which sends them to log in.
  if (res.status === 401 && data.session) await supabase.auth.signOut({ scope: 'local' })
  if (!res.ok) throw new Error(json?.error ?? OFFLINE)
  return json as T
}

export const api = {
  me: () => request<{ user: User | null; suggestedName: string }>('GET', '/auth/me'),
  createProfile: (input: { name: string; username: string }) =>
    request<{ user: User }>('POST', '/auth/profile', input),
  updateProfile: (input: ProfileEdit) => request<{ user: ProfileUser }>('PATCH', '/auth/profile', input),
  setAvatar: (image: string) => request<{ user: User }>('PUT', '/auth/avatar', { image }),
  removeAvatar: () => request<{ user: User }>('DELETE', '/auth/avatar'),
  exportData: () => request<unknown>('GET', '/auth/export'),
  setSharing: (sharePublic: boolean) => request<{ user: User }>('PUT', '/auth/sharing', { sharePublic }),
  deleteAccount: (username: string) => request<{ ok: true }>('DELETE', '/auth/account', { username }),

  getArc: () => request<ArcResponse>('GET', `/arc?today=${today()}`),
  createArc: (input: { name: string; tracks: NewTrack[] }) =>
    request<ArcResponse>('POST', '/arc', { ...input, today: today() }),
  deleteArc: (id: string) => request<ArcResponse>('DELETE', `/arc/${id}?today=${today()}`),

  addTrack: (track: { name: string; isPublic: boolean; checkpoints: string[] } & Partial<Schedule>) =>
    request<ArcResponse>('POST', '/tracks', { ...track, today: today() }),
  updateTrack: (id: string, changes: { name?: string; isPublic?: boolean } & Partial<Schedule>) =>
    request<ArcResponse>('PATCH', `/tracks/${id}`, { ...changes, today: today() }),
  deleteTrack: (id: string) => request<ArcResponse>('DELETE', `/tracks/${id}?today=${today()}`),

  addGoal: (trackId: string, title: string) =>
    request<ArcResponse>('POST', '/goals', { trackId, title, today: today() }),
  renameGoal: (id: string, title: string) =>
    request<ArcResponse>('PATCH', `/goals/${id}`, { title, today: today() }),
  deleteGoal: (id: string) => request<ArcResponse>('DELETE', `/goals/${id}?today=${today()}`),
  checkIn: (id: string, done: boolean) =>
    request<ArcResponse>('PUT', `/goals/${id}/checkin`, { done, today: today() }),
  setProof: (id: string, proof: { note: string; link: string }) =>
    request<ArcResponse>('PUT', `/goals/${id}/proof`, { ...proof, today: today() }),
  setReflection: (text: string) => request<ArcResponse>('PUT', '/arc/reflection', { text, today: today() }),

  addSubtask: (goalId: string, title: string) =>
    request<ArcResponse>('POST', '/subtasks', { goalId, title, today: today() }),
  deleteSubtask: (id: string) => request<ArcResponse>('DELETE', `/subtasks/${id}?today=${today()}`),
  checkSubtask: (id: string, done: boolean) =>
    request<ArcResponse>('PUT', `/subtasks/${id}/check`, { done, today: today() }),

  // A track's checkpoints are fixed when it's created, so ticking is all there is.
  tickCheckpoint: (id: string, done: boolean) =>
    request<ArcResponse>('PATCH', `/checkpoints/${id}`, { done, today: today() }),
  reorderCheckpoints: (trackId: string, ids: string[]) =>
    request<ArcResponse>('PUT', `/tracks/${trackId}/checkpoints/order`, { ids, today: today() }),

  searchUsers: (q: string) =>
    request<{ users: (PublicUser & RelationInfo)[] }>('GET', `/users?q=${encodeURIComponent(q)}`),
  getProfile: (username: string) =>
    request<Profile>('GET', `/users/${encodeURIComponent(username)}?today=${today()}`),
  getSurvivors: () => request<Survivors>('GET', `/survivors?today=${today()}`),
  getFeed: () => request<{ entries: FeedEntry[] }>('GET', `/feed?today=${today()}`),
  getCommitment: (username: string) =>
    request<Commitment>('GET', `/public/${encodeURIComponent(username)}?today=${today()}`),
  getFriends: () => request<Friends>('GET', `/friends?today=${today()}`),
  addFriend: (username: string) => request<RelationInfo>('POST', '/friends', { username }),
  acceptFriend: (friendshipId: string) =>
    request<{ ok: true }>('POST', `/friends/${friendshipId}/accept`),
  removeFriend: (friendshipId: string) => request<{ ok: true }>('DELETE', `/friends/${friendshipId}`),
}
