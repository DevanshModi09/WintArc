import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { User } from '../api'
import { supabase } from '../supabase'
import { Logo } from './ArcParts'
import type { LayoutContext } from './focus'

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'font-bold tracking-[-0.02em] text-fg' : 'font-medium tracking-[-0.02em] text-muted hover:text-fg'

export function Layout({ user }: { user: User }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  function search(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setQuery('')
    navigate(`/friends?q=${encodeURIComponent(q)}`)
  }

  return (
    <>
      <nav className="mx-4 mt-6 flex min-h-14 max-w-[1040px] flex-wrap items-center gap-x-6 gap-y-2 rounded-[min(var(--radius-nav),28px)] bg-surface px-6 py-2 shadow-nav sm:mx-8 lg:rounded-nav xl:mx-auto">
        {focused ? (
          // Nowhere to go until the page in front of you is dealt with.
          <>
            <span className="flex-1">
              <Logo />
            </span>
            <button className="text-muted hover:text-fg" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/">
              <Logo />
            </Link>
            <div className="flex flex-1 gap-5">
              <NavLink to="/" end className={navClass}>
                Today
              </NavLink>
              <NavLink to="/tracks" className={navClass}>
                Tracks
              </NavLink>
              <NavLink to="/feed" className={navClass}>
                Feed
              </NavLink>
              <NavLink to="/board" className={navClass}>
                Board
              </NavLink>
              <NavLink to="/friends" className={navClass}>
                Friends
              </NavLink>
              <NavLink to={`/u/${user.username}`} className={navClass}>
                Profile
              </NavLink>
              {user.isAdmin && (
                <NavLink to="/admin" className={navClass}>
                  Admin
                </NavLink>
              )}
            </div>
            <form onSubmit={search} className="w-full sm:w-52">
              <input
                className="input h-9"
                placeholder="Search people"
                aria-label="Search people"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </form>
            <button className="text-muted hover:text-fg" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </>
        )}
      </nav>
      <main className="mx-auto max-w-[1040px] px-4 py-10 sm:px-8">
        {/* Keyed by address, so every page eases in as you arrive on it. */}
        <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
          <Outlet context={{ setFocused } satisfies LayoutContext} />
        </motion.div>
      </main>
    </>
  )
}
