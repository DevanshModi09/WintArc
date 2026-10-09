import { useEffect } from 'react'

// Names the browser tab after the page, e.g. "Friends · WintArc".
export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · WintArc` : 'WintArc'
  }, [title])
}
