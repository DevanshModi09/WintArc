import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { User } from '../api'
import { supabase } from '../supabase'
import { currentTheme, setTheme } from '../theme'
import { Logo } from './ArcParts'

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'font-medium text-fg' : 'text-muted hover:text-fg'

export function Layout({ user }: { user: User }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [theme, setThemeState] = useState(currentTheme)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  function search(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setQuery('')
    navigate(`/friends?q=${encodeURIComponent(q)}`)
  }

  return (
    <>
      <nav className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-2 sm:px-8">
        <Link to="/">
          <Logo />
        </Link>
        <div className="flex flex-1 gap-5">
          <NavLink to="/" end className={navClass}>
            Today
          </NavLink>
          <NavLink to="/friends" className={navClass}>
            Friends
          </NavLink>
          <NavLink to={`/u/${user.username}`} className={navClass}>
            Profile
          </NavLink>
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
        <button className="text-muted hover:text-fg" onClick={toggleTheme}>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <button className="text-muted hover:text-fg" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </nav>
      <main className="mx-auto max-w-[1040px] px-4 py-10 sm:px-8">
        <Outlet />
      </main>
    </>
  )
}
