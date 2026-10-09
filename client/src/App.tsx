import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api, type User } from './api'
import { ErrorNote, Loading, Logo } from './components/ArcParts'
import { Layout } from './components/Layout'
import { AdminPeople, AdminPerson, AdminUploads } from './pages/Admin'
import { AuthPage } from './pages/AuthPage'
import { Board } from './pages/Board'
import { Commitment } from './pages/Commitment'
import { Feed } from './pages/Feed'
import { Friends } from './pages/Friends'
import { Legal } from './pages/Legal'
import { Onboarding } from './pages/Onboarding'
import { Profile } from './pages/Profile'
import { Today } from './pages/Today'
import { Tracks } from './pages/Tracks'
import { Wrapped } from './pages/Wrapped'
import { supabase } from './supabase'

export default function App() {
  // undefined = still restoring the session
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <Loading />

  return (
    <BrowserRouter>
      {session ? (
        <SignedIn key={session.user.id} />
      ) : (
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route path="/c/:username" element={<Commitment />} />
          <Route path="/u/:username" element={<GuestProfile />} />
          <Route path="/privacy" element={<Legal doc="privacy" />} />
          <Route path="/terms" element={<Legal doc="terms" />} />
          <Route path="*" element={<RememberAndSignIn />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}

const NEXT = 'afterSignIn'

// Someone opened a link to a page that needs an account: remember where they
// were headed, and send them to sign in.
function RememberAndSignIn() {
  const { pathname, search } = useLocation()
  try {
    sessionStorage.setItem(NEXT, pathname + search)
  } catch {
    // No storage: they just land on Today after signing in.
  }
  return <Navigate to="/login" replace />
}

// A profile opened by someone who isn't signed in. Signing in from here
// brings them back to the same profile, where they can add the person.
function GuestProfile() {
  const { pathname } = useLocation()
  const remember = () => {
    try {
      sessionStorage.setItem(NEXT, pathname)
    } catch {
      // No storage: they just land on Today after signing in.
    }
  }
  return (
    <main className="mx-auto max-w-[1040px] space-y-8 px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <Link to="/login">
          <Logo />
        </Link>
        <Link to="/login" className="btn h-9" onClick={remember}>
          Start your own arc
        </Link>
      </div>
      <Profile guest />
    </main>
  )
}

// Where a just-signed-in person was trying to go, if anywhere. Read once.
function takeNext() {
  try {
    const next = sessionStorage.getItem(NEXT)
    sessionStorage.removeItem(NEXT)
    // Only ever a path on this site.
    return next?.startsWith('/') && !next.startsWith('//') ? next : null
  } catch {
    return null
  }
}

function SignedIn() {
  const navigate = useNavigate()
  useEffect(() => {
    const next = takeNext()
    if (next) navigate(next, { replace: true })
  }, [navigate])

  const [me, setMe] = useState<{ user: User | null; suggestedName: string }>()
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch((err: Error) => setError(err.message))
  }, [])

  if (error) {
    return (
      <main className="mx-auto max-w-sm space-y-4 px-6 py-24">
        <ErrorNote message={error} />
        <button className="btn-outline w-full" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </main>
    )
  }
  if (!me) return <Loading />
  if (!me.user) {
    return <Onboarding suggestedName={me.suggestedName} onDone={(user) => setMe({ ...me, user })} />
  }

  const user = me.user
  return (
    <Routes>
      <Route path="c/:username" element={<Commitment signedIn />} />
      <Route path="privacy" element={<Legal doc="privacy" />} />
      <Route path="terms" element={<Legal doc="terms" />} />
      <Route element={<Layout user={user} />}>
        <Route index element={<Today user={user} onUser={(next) => setMe({ ...me, user: next })} />} />
        <Route path="feed" element={<Feed />} />
        <Route path="board" element={<Board />} />
        {user.isAdmin && (
          <>
            <Route path="admin" element={<AdminPeople />} />
            <Route path="admin/uploads" element={<AdminUploads />} />
            <Route path="admin/u/:username" element={<AdminPerson />} />
          </>
        )}
        <Route path="tracks" element={<Tracks />} />
        <Route path="wrapped" element={<Wrapped user={user} />} />
        <Route path="friends" element={<Friends />} />
        <Route path="u/:username" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
