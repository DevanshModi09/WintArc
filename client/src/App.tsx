import { useEffect, useState } from 'react'
import { api, type User } from './api'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'

export default function App() {
  // undefined = still checking the session
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
  }, [])

  if (user === undefined) return null
  if (user === null) return <AuthScreen onAuth={setUser} />

  return (
    <Dashboard
      user={user}
      onLogout={async () => {
        await api.logout()
        setUser(null)
      }}
    />
  )
}
