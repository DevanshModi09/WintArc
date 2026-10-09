import { supabase } from './supabase'
import { today } from './today'

export { today }

export type PublicUser = { id: string; name: string; username: string; avatarUrl: string | null }
export type User = PublicUser & { email: string; sharePublic: boolean; isAdmin: boolean }

export type Streak = { current: number; best: number }
export type DayStatus = 'perfect' | 'partial' | 'missed' | 'empty'
export type Level = { number: number; title: string; xpIntoLevel: number; xpPerLevel: number }
export type Badge = { days: number; name: string; xp: number; earned: boolean }

// The photo that backs up a day's check-in (its path in storage) and the line
// that went with it. Photos are private: only you ever get your own back.
export type Proof = { photo: string; note: string | null }

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
  // False on the weekdays this track isn't scheduled for, and once every
  // checkpoint is finished.
  dueToday: boolean
  // The checkpoint being worked on: the first in line that isn't finished.
  // Null when there are none left, or the track never had any.
  active: { id: string; title: string; number: number } | null
  complete: boolean
  doneToday: boolean
  proof: Proof | null
  // How many days a check-in was made.
  total: number
  streak: Streak
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

// When this year's arc can be started, and when it ends for everyone.
export type Season = { opens: string; lastStart: string; endDate: string; canStart: boolean }

export type Survivors = {
  season: Pick<Season, 'endDate' | 'lastStart' | 'canStart'> & { daysLeft: number }
  started: number
  standing: number
  // null when you aren't running this season's arc.
  me: Survivor | null
  survivors: { user: PublicUser; streak: number; xp: number; level: number }[]
}

export type FeedEntry = {
  user: PublicUser
  date: string
  items: { id: string; track: string; checkpoint: string | null; note: string | null }[]
}

// One uploaded proof photo, as an admin sees it.
export type AdminProof = {
  id: string
  date: string
  uploadedAt: string
  note: string | null
  photo: string
  track: string
  checkpoint: string | null
  user: PublicUser
}

export type Commitment = { user: PublicUser & { bio: string | null }; arc: Arc | null }

// A track as it's set up with a new arc: its plan and its checkpoints.
export type NewTrack = Schedule & { name: string; isPublic: boolean; checkpoints: string[] }

export type ArcResponse = { arc: Arc | null; season: Season }

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
  createArc: (input: { tracks: NewTrack[] }) =>
    request<ArcResponse>('POST', '/arc', { ...input, today: today() }),

  addTrack: (track: { name: string; isPublic: boolean; checkpoints: string[] } & Partial<Schedule>) =>
    request<ArcResponse>('POST', '/tracks', { ...track, today: today() }),
  updateTrack: (id: string, changes: { name?: string; isPublic?: boolean } & Partial<Schedule>) =>
    request<ArcResponse>('PATCH', `/tracks/${id}`, { ...changes, today: today() }),

  // The day's entry for a track: a photo already uploaded to storage.
  checkIn: (trackId: string, entry: { photo: string; note: string }) =>
    request<ArcResponse>('PUT', `/tracks/${trackId}/checkin`, { ...entry, today: today() }),
  setReflection: (text: string) => request<ArcResponse>('PUT', '/arc/reflection', { text, today: today() }),

  // Finishing a checkpoint moves the track on to the next one.
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
  getAdminProofs: () => request<{ proofs: AdminProof[] }>('GET', '/admin/proofs'),
  getFriends: () => request<Friends>('GET', `/friends?today=${today()}`),
  addFriend: (username: string) => request<RelationInfo>('POST', '/friends', { username }),
  acceptFriend: (friendshipId: string) =>
    request<{ ok: true }>('POST', `/friends/${friendshipId}/accept`),
  removeFriend: (friendshipId: string) => request<{ ok: true }>('DELETE', `/friends/${friendshipId}`),
}
