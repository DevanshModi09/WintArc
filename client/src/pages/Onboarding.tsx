import { useState, type FormEvent } from 'react'
import { api, type User } from '../api'
import { ErrorNote, Logo } from '../components/ArcParts'
import { ThemeToggle } from '../components/ThemeToggle'
import { supabase } from '../supabase'

// First sign-in only: pick the name and @username friends will find you by.
export function Onboarding({ suggestedName, onDone }: { suggestedName: string; onDone: (user: User) => void }) {
  const [name, setName] = useState(suggestedName)
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      onDone((await api.createProfile({ name, username })).user)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[360px] flex-col justify-center px-6 py-12">
      <ThemeToggle className="fixed top-5 right-6" />
      <Logo />
      <h1 className="mt-8 text-[40px] leading-none font-medium">Set up your profile</h1>
      <p className="mt-2 text-muted">Friends will find you by your username.</p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <label className="block space-y-1.5">
          <span className="label">Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Username</span>
          <div className="flex items-center rounded-full border border-fg/25 bg-surface focus-within:border-fg">
            <span className="pl-3 font-mono text-muted">@</span>
            <input
              className="h-10 w-full bg-transparent px-1 font-mono outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              minLength={3}
              maxLength={20}
              autoCapitalize="none"
              required
            />
          </div>
        </label>
        <ErrorNote message={error} />
        <button className="btn w-full" disabled={busy}>
          Continue
        </button>
      </form>

      <button className="mt-6 self-start text-muted hover:text-fg" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </main>
  )
}
