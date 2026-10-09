import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type AdminProof } from '../api'
import { Avatar, ErrorNote, Loading } from '../components/ArcParts'
import { ProofPhoto } from '../components/ProofPhoto'
import { useTitle } from '../useTitle'

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// For admins: every proof photo people have uploaded lately, newest first.
// Nobody else can open this page, and the photos here are shown to no one
// else, not even the uploader's friends.
export function Admin() {
  const [proofs, setProofs] = useState<AdminProof[]>()
  const [error, setError] = useState('')
  useTitle('Uploads')

  useEffect(() => {
    api.getAdminProofs().then((res) => setProofs(res.proofs), (err: Error) => setError(err.message))
  }, [])

  if (!proofs) return error ? <ErrorNote message={error} /> : <Loading />

  return (
    <div className="space-y-8">
      <header>
        <div className="eyebrow">Admin</div>
        <h1 className="mt-3 text-[40px] leading-none font-medium">Uploaded photos</h1>
        <p className="mt-2 max-w-[60ch] text-muted">
          The latest {proofs.length} proof {proofs.length === 1 ? 'photo' : 'photos'} from everyone. Only admins see
          this. Click a photo to open it full size.
        </p>
      </header>

      {proofs.length === 0 && <p className="text-muted">Nobody has uploaded a photo yet.</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {proofs.map((proof) => (
          <article key={proof.id} className="card overflow-hidden">
            <ProofPhoto path={proof.photo} alt={`Proof from ${proof.user.name}`} className="aspect-[4/3] w-full" />
            <div className="space-y-2 p-3 text-[14px]">
              <Link to={`/u/${proof.user.username}`} className="flex items-center gap-2">
                <Avatar user={proof.user} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{proof.user.name}</span>
                  <span className="label block truncate">@{proof.user.username}</span>
                </span>
              </Link>
              <div>
                <div className="truncate">{proof.checkpoint ?? proof.track}</div>
                <div className="label truncate">
                  {proof.checkpoint ? `${proof.track} · ` : ''}
                  {when(proof.uploadedAt)}
                </div>
              </div>
              {proof.note && <p className="label break-words">{proof.note}</p>}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
