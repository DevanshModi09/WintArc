import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { User } from '../api'
import { supabase } from '../supabase'
import { Logo } from './ArcParts'
import type { LayoutContext } from './focus'

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'font-bold tracking-[-0.02em] text-fg' : 'font-medium tracking-[-0.02em] text-muted hover:text-fg'

// The sections of the app: a row of links on a wide screen, a tab bar with
// these icons along the bottom of a phone.
const sections = (username: string) => [
  { to: '/', label: 'Today', icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8.5 12l2.5 2.5 4.5-5' },
  { to: '/tracks', label: 'Tracks', icon: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01' },
  { to: '/feed', label: 'Feed', icon: 'M3 12h4l3-8 4 16 3-8h4' },
  { to: '/board', label: 'Board', icon: 'M5 20V10M12 20V4M19 20v-7' },
  { to: '/friends', label: 'Friends', icon: 'M12.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6' },
  { to: `/u/${username}`, label: 'Profile', icon: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21a8 8 0 0 1 16 0' },
]

export function Layout({ user }: { user: User }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const tabs = sections(user.username)

  function search(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setQuery('')
    navigate(`/friends?q=${encodeURIComponent(q)}`)
  }

  return (
    <>
      <nav className="mx-4 mt-4 flex min-h-14 max-w-[1040px] flex-wrap items-center gap-x-6 gap-y-2 md:mt-6 rounded-[min(var(--radius-nav),28px)] bg-surface px-6 py-2 shadow-nav sm:mx-8 lg:rounded-nav xl:mx-auto">
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
            <Link to="/" className="mr-auto md:mr-0">
              <Logo />
            </Link>
            {/* On a phone these live in the tab bar at the bottom instead. */}
            <div className="hidden flex-1 gap-5 md:flex">
              {tabs.map((tab) => (
                <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className={navClass}>
                  {tab.label}
                </NavLink>
              ))}
              {user.isAdmin && (
                <NavLink to="/admin" className={navClass}>
                  Admin
                </NavLink>
              )}
            </div>
            <form onSubmit={search} className="hidden md:block md:w-52">
              <input
                className="input h-9"
                placeholder="Search people"
                aria-label="Search people"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </form>
            {user.isAdmin && (
              <NavLink to="/admin" className={(state) => `md:hidden ${navClass(state)}`}>
                Admin
              </NavLink>
            )}
            <button className="text-muted hover:text-fg" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </>
        )}
      </nav>
      {/* Room at the bottom on a phone, so the tab bar never covers the page. */}
      <main className={`mx-auto max-w-[1040px] px-4 pt-8 sm:px-8 md:py-10 ${focused ? 'pb-10' : 'pb-28'}`}>
        {/* Keyed by address, so every page eases in as you arrive on it. */}
        <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
          <Outlet context={{ setFocused } satisfies LayoutContext} />
        </motion.div>
      </main>

      {!focused && (
        <nav
          aria-label="Sections"
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 text-[10.5px] leading-none ${isActive ? 'font-medium text-fg' : 'text-muted'}`
              }
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={tab.icon} />
              </svg>
              {tab.label}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  )
}
