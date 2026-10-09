import { createClient } from "@supabase/supabase-js";
import { prisma } from "./db";
import { env } from "./env";

// Proof photos only need to be seen around the time of the check-in, so they
// are deleted once they're two days old. The check-in itself stays; it just
// no longer has a picture.
const KEEP_MS = 2 * 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 6 * 60 * 60 * 1000;
const BATCH = 100;

// Works from what is actually in the bucket rather than from check-ins, so
// photos that were replaced, or uploaded and never used, go too.
export async function deleteOldProofs() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  const storage = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from("proofs");
  const cutoff = new Date(Date.now() - KEEP_MS);

  let deleted = 0;
  for (;;) {
    const old = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM storage.objects WHERE bucket_id = 'proofs' AND created_at < ${cutoff} LIMIT ${BATCH}`;
    if (old.length === 0) return deleted;
    const paths = old.map((o) => o.name);
    const { error } = await storage.remove(paths);
    // Leave the rest for the next sweep rather than spin on a failure.
    if (error) throw new Error(`Could not delete old proof photos: ${error.message}`);
    await prisma.checkIn.updateMany({ where: { photo: { in: paths } }, data: { photo: null } });
    deleted += paths.length;
  }
}

// Sweeps when the server starts, and every few hours after that.
export function startProofCleanup() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Old proof photos won't be deleted: SUPABASE_SERVICE_ROLE_KEY isn't set.");
    return;
  }
  const sweep = () =>
    deleteOldProofs().then(
      (count) => count > 0 && console.log(`Deleted ${count} proof photos older than two days`),
      (err) => console.error(err),
    );
  sweep();
  setInterval(sweep, SWEEP_EVERY_MS).unref();
}
