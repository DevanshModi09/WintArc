import { useEffect, useState } from 'react'
import { proofUrl } from '../proof'

// A private proof photo, as a thumbnail that opens full size. It is fetched
// with the viewer's own sign-in, so it shows nothing for anyone not allowed
// to see it, or once the photo has been cleared out of storage.
export function ProofPhoto({ path, className, alt }: { path: string; className: string; alt: string }) {
  // undefined = still asking, null = can't be shown
  const [url, setUrl] = useState<string | null>()

  useEffect(() => {
    let live = true
    proofUrl(path).then((next) => live && setUrl(next))
    return () => {
      live = false
    }
  }, [path])

  if (!url) {
    return (
      <span className={`flex shrink-0 items-center justify-center bg-subtle text-[11px] text-muted ${className}`}>
        {url === null ? 'No photo' : ''}
      </span>
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className="shrink-0">
      <img src={url} alt={alt} loading="lazy" className={`object-cover ${className}`} onError={() => setUrl(null)} />
    </a>
  )
}
