import { useState, type FormEvent } from 'react'
import { api, type User } from '../api'

export function AuthScreen({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res =
        mode === 'signup'
          ? await api.signup({ name, email, password })
          : await api.login({ email, password })
      onAuth(res.user)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="text-5xl">❄️</div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">WintArc</h1>
        <p className="mt-2 text-white/50">Set your daily goals. Check in. Don't break the streak.</p>
      </div>

      <form onSubmit={submit} className="card space-y-3">
        {mode === 'signup' && (
          <input
            className="input"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        )}
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          className="input"
          type="password"
          placeholder={mode === 'signup' ? 'Password (8+ characters)' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
        />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button className="btn w-full" disabled={busy}>
          {mode === 'signup' ? 'Start my arc' : 'Log in'}
        </button>
      </form>

      <button
        className="mt-4 cursor-pointer text-sm text-white/50 hover:text-frost"
        onClick={() => {
          setMode(mode === 'signup' ? 'login' : 'signup')
          setError('')
        }}
      >
        {mode === 'signup' ? 'Already have an account? Log in' : 'New here? Create an account'}
      </button>
    </main>
  )
}
