import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RequestHandler } from "express";
import { prisma } from "./db";
import { HttpError } from "./errors";

let client: SupabaseClient | undefined;

function supabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

// Verifies the Supabase access token sent as "Authorization: Bearer <token>".
// Sign-in itself (Google) happens in the browser, straight against Supabase.
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Not signed in");
  // getClaims checks the signature and expiry; it throws on a malformed token.
  const claims = await supabase()
    .auth.getClaims(token)
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
