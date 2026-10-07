import { useState } from 'react'
import { currentTheme, setTheme } from '../theme'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setThemeState] = useState(currentTheme)

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  return (
    <button className={`text-muted hover:text-fg ${className}`} onClick={toggle}>
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
