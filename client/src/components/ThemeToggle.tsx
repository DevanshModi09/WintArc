import { useState } from 'react'
import { Link } from 'react-router-dom'
import { currentTheme, oppositeMode, setTheme } from '../themes'

// A light/dark switch, and the way in to the full theme picker.
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setCurrent] = useState(currentTheme)

  function toggle() {
    const next = oppositeMode(theme)
    setTheme(next)
    setCurrent(next)
  }

  return (
    <span className={`flex items-center gap-4 ${className}`}>
      <button className="text-muted hover:text-fg" onClick={toggle}>
        {theme.scheme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
      <Link to="/themes" className="text-muted hover:text-fg">
        Themes
      </Link>
    </span>
  )
}
