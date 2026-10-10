import { report } from './log'
import { supabase } from './supabase'

const BUCKET = 'proofs'
// Long edge of the stored photo. Enough to read a screen or a notebook page.
const MAX_SIDE = 1600
// The bucket refuses anything over 1 MB.
const MAX_BYTES = 1_000_000

function toJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that photo"))), 'image/jpeg', quality),
  )
}

// Shrinks a photo to a JPEG the bucket will take, whatever the camera made.
async function shrink(file: File) {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That file isn't a photo we can read")
  })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  for (const quality of [0.82, 0.7, 0.55]) {
    const blob = await toJpeg(canvas, quality)
    if (blob.size <= MAX_BYTES) return blob
  }
  throw new Error('That photo is too large')
}

// Puts a proof photo in storage, in the signed-in person's own folder, and
// returns its path there. The path is what a check-in is made with.
export async function uploadProof(file: File): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) throw new Error('Sign in again to upload a photo')
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const original = { type: file.type, bytes: file.size }
  const started = performance.now()
  const took = () => Math.round(performance.now() - started)
  const photo = await shrink(file).catch((err: Error) => {
    report('error', 'photo could not be read', err.message, { original, ms: took() })
    throw err
  })
  const shrunk = took()
  const { error } = await supabase.storage.from(BUCKET).upload(path, photo, { contentType: 'image/jpeg' })
  const detail = { original, bytes: photo.size, shrinkMs: shrunk, uploadMs: took() - shrunk }
  if (error) {
    report('error', 'photo upload failed', error.message, detail)
    throw new Error("Couldn't upload the photo. Check your connection and try again.")
  }
  report('info', 'photo uploaded', undefined, detail)
  return path
}

// A short-lived link to a photo. The bucket is private, so this only works
// for the person who uploaded it, or for an admin.
export async function proofUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? null
}
