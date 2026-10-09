import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RequestHandler } from "express";
import { prisma } from "./db";
import { env } from "./env";
import { HttpError } from "./errors";

const serverOnly = { auth: { persistSession: false, autoRefreshToken: false } };

const supabase: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, serverOnly);

// Removes someone's Supabase login. Needs the service role key, so it quietly
// does nothing on a deployment that hasn't been given one.
export async function deleteAuthUser(id: string) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return;
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, serverOnly);
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) console.error("Could not delete the Supabase login", error);
}

// Verifies the Supabase access token sent as "Authorization: Bearer <token>".
// Sign-in itself (Google) happens in the browser, straight against Supabase.
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Not signed in");
  // getClaims checks the signature and expiry; it throws on a malformed token.
  const claims = await supabase.auth
    .getClaims(token)
    .then(({ data, error }) => (error ? null : data?.claims))
    .catch(() => null);
  if (!claims?.sub) throw new HttpError(401, "Not signed in");

  const { sub, email, user_metadata } = claims;
  res.locals.authId = sub;
  res.locals.email = email;
  res.locals.suggestedName = user_metadata?.full_name ?? user_metadata?.name ?? "";
  next();
};

// A signed-in person only becomes a WintArc user once they've picked a username.
export const requireProfile: RequestHandler = async (_req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: res.locals.authId }, select: { id: true } });
  if (!user) throw new HttpError(403, "Finish setting up your profile first");
  res.locals.userId = user.id;
  next();
};
