import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request, RequestHandler } from "express";
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

// Reads the Supabase access token sent as "Authorization: Bearer <token>".
async function claimsOf(req: Request) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  // getClaims checks the signature and expiry; it throws on a malformed token.
  return supabase.auth
    .getClaims(token)
    .then(({ data, error }) => (error ? null : (data?.claims ?? null)))
    .catch(() => null);
}

// Who sent a request, for the routes that take one from anybody.
export async function identify(req: Request): Promise<string | null> {
  return (await claimsOf(req))?.sub ?? null;
}

// Sign-in itself (Google) happens in the browser, straight against Supabase.
export const requireAuth: RequestHandler = async (req, res, next) => {
  const claims = await claimsOf(req);
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
