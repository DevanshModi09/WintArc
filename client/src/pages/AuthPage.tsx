import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNote, Logo } from '../components/ArcParts'
import { ThemeToggle } from '../components/ThemeToggle'
import { signInWithGoogle, supabase } from '../supabase'

const COPY = {
  login: {
    title: 'Log in to WintArc',
    submit: 'Log in',
    switchText: "Don't have an account?",
    switchLink: 'Sign up',
    switchTo: '/signup',
  },
  signup: {
    title: 'Create your account',
    submit: 'Sign up',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
    switchTo: '/login',
  },
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const copy = COPY[mode]
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    const { data, error } =
      mode === 'signup'
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setError(error.message)
    // With email confirmation on, sign-up returns no session until the link is clicked.
    else if (!data.session) setNotice(`Check ${email} for a link to confirm your account.`)
  }

  async function google() {
    setError('')
    const { error } = await signInWithGoogle()
    if (error) setError(error.message)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[360px] flex-col justify-center px-6 py-12">
      <ThemeToggle className="fixed top-5 right-6" />
      <Logo />
      <h1 className="mt-8 text-[40px] leading-none font-medium">{copy.title}</h1>
      <p className="mt-2 text-muted">Daily goals, streaks and friends for your arc.</p>

      <div className="mt-8 space-y-4">
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
          </label>
          <ErrorNote message={error} />
          {notice && <p className="rounded-[20px] border border-line bg-subtle px-4 py-2.5">{notice}</p>}
          <button className="btn w-full" disabled={busy}>
            {copy.submit}
          </button>
        </form>

        <div className="flex items-center gap-3 font-mono text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <button className="btn-outline w-full gap-2.5" onClick={google}>
          <GoogleMark />
          Continue with Google
        </button>
      </div>

      <p className="mt-6 text-muted">
        {copy.switchText}{' '}
        <Link to={copy.switchTo} className="font-medium text-fg hover:underline">
          {copy.switchLink}
        </Link>
      </p>
    </main>
  )
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
