import { createClient } from '@supabase/supabase-js'

const url: string = import.meta.env.VITE_SUPABASE_URL

// Some networks can't reach supabase.co reliably: a new connection hangs about
// half the time, which leaves the page stuck restoring a session or signing
// in. With VITE_SUPABASE_PROXY set to a path on this site that forwards to the
// Supabase project (see vercel.json), the browser only ever talks to us.
const proxy: string | undefined = import.meta.env.VITE_SUPABASE_PROXY

export const supabase = createClient(proxy ? new URL(proxy, window.location.origin).href : url, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  // Named after the project either way, so turning the proxy on or off
  // doesn't sign anyone out.
  auth: { storageKey: `sb-${new URL(url).hostname.split('.')[0]}-auth-token` },
})

// The plain way to sign in with Google: off to Supabase, on to Google, and
// back. It works everywhere, but Google's screen then says "continue to" the
// Supabase project's address rather than ours. See googleSignIn.ts for the
// nicer route, which this is the fallback for.
export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
}
