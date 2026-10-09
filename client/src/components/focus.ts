import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'

// What the layout hands to the page it's showing.
export type LayoutContext = { setFocused: (focused: boolean) => void }

// Lets the page being shown strip the nav down to the logo and Sign out, for
// the one screen that has to be finished before anything else: arc setup.
export function useFocusedLayout() {
  const { setFocused } = useOutletContext<LayoutContext>()
  useEffect(() => {
    setFocused(true)
    return () => setFocused(false)
  }, [setFocused])
}
