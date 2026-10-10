import { supabase } from './supabase'

// Tells the server what went wrong in this browser, so it shows up in the
// admin log: requests that never got through, uploads that failed, crashes.
// Reports wait in localStorage until they've been delivered, because the
// ones that matter most happen exactly when the server can't be reached.

type Level = 'info' | 'warn' | 'error'
type Report = { at: number; level: Level; event: string; message?: string; detail: Record<string, unknown> }

const KEY = 'wintarc:reports'
const MAX_HELD = 60
const RETRY_MS = 30_000

function held(): Report[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function hold(reports: Report[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(reports.slice(-MAX_HELD)))
  } catch {
    // Storage is full or turned off: these reports are lost.
  }
}

let sending = false
let retry: ReturnType<typeof setTimeout> | undefined

async function send() {
  const batch = held().slice(0, 30)
  if (sending || batch.length === 0) return
  sending = true
  clearTimeout(retry)
  let delivered = false
  try {
    const { data } = await supabase.auth.getSession()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: batch }),
      keepalive: true,
      signal: AbortSignal.timeout(10_000),
    })
    // Anything but "try later" means these are dealt with, even a refusal:
    // a report the server won't take is not worth sending again.
    if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
      const sent = new Set(batch.map((r) => `${r.at}:${r.event}`))
      hold(held().filter((r) => !sent.has(`${r.at}:${r.event}`)))
      delivered = true
    }
  } catch {
    // Still unreachable. They stay held.
  }
  sending = false
  // More may have been reported meanwhile: send those now, or if the server
  // couldn't be reached, try again in a while.
  if (held().length > 0) retry = setTimeout(send, delivered ? 0 : RETRY_MS)
}

export function report(level: Level, event: string, message?: string, detail: Record<string, unknown> = {}) {
  const connection = (navigator as { connection?: { effectiveType?: string } }).connection
  hold([
    ...held(),
    {
      at: Date.now(),
      level,
      event,
      message: message?.slice(0, 2000),
      detail: {
        page: location.pathname,
        site: location.host,
        online: navigator.onLine,
        network: connection?.effectiveType,
        ...detail,
      },
    },
  ])
  send()
}

// Reports crashes nothing else caught, and sends whatever was left waiting
// from last time.
export function startReporting() {
  window.addEventListener('error', (e) =>
    report('error', 'page error', e.message, { file: e.filename, line: e.lineno, stack: e.error?.stack?.slice(0, 3000) }),
  )
  window.addEventListener('unhandledrejection', (e) =>
    report('error', 'unhandled rejection', e.reason?.message ?? String(e.reason), { stack: e.reason?.stack?.slice(0, 3000) }),
  )
  window.addEventListener('online', send)
  // Supabase repeats its sign-in event when a tab comes back into view, so
  // only a change of person counts.
  let signedIn: string | null | undefined
  supabase.auth.onAuthStateChange((event, session) => {
    const now = session?.user.id ?? null
    if (signedIn !== undefined && now !== signedIn) report('info', now ? 'signed in' : 'signed out', undefined, { how: event })
    signedIn = now
  })
  send()
}
