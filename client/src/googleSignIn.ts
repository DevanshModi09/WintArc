import { supabase } from './supabase'

// Google's own sign-in button, running on our page. Because the hand-off to
// Google starts from our address instead of Supabase's, Google's screen names
// this site rather than the Supabase project. Google gives the page a signed
// token, which Supabase accepts as a sign-in.
//
// It needs VITE_GOOGLE_CLIENT_ID (the same client id Supabase's Google provider
// uses) and this site listed under that client's authorised JavaScript
// origins. Without either, callers fall back to the redirect in supabase.ts.

const CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCRIPT = 'https://accounts.google.com/gsi/client'

type GoogleId = {
  initialize: (options: { client_id: string; nonce: string; callback: (response: { credential: string }) => void }) => void
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

let script: Promise<void> | undefined
function loadScript() {
  script ??= new Promise((resolve, reject) => {
    const tag = document.createElement('script')
    tag.src = SCRIPT
    tag.async = true
    tag.onload = () => resolve()
    tag.onerror = () => reject(new Error("Couldn't load Google sign-in"))
    document.head.append(tag)
  })
  return script
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Draws Google's button into `parent`. Resolves to false when it can't be
// used here, so the caller can show the fallback instead.
export async function renderGoogleButton(parent: HTMLElement, onError: (message: string) => void) {
  if (!CLIENT_ID) return false
  try {
    await loadScript()
    const id = window.google?.accounts.id
    if (!id) return false
    // Google gets the hash and Supabase the original, which ties the token
    // Google hands back to this one page load.
    const nonce = crypto.randomUUID()
    id.initialize({
      client_id: CLIENT_ID,
      nonce: await sha256(nonce),
      callback: async ({ credential }) => {
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce })
        if (error) onError(error.message)
      },
    })
    id.renderButton(parent, { theme: 'filled_black', size: 'large', shape: 'rectangular', text: 'continue_with', width: Math.min(400, parent.clientWidth || 360) })
    return true
  } catch {
    return false
  }
}
