import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

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
