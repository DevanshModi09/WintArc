import type { RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { HttpError } from "./errors";

const COOKIE = "arc_session";
const MAX_AGE_DAYS = 30;

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set");
  return value;
}

export function startSession(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, secret(), { expiresIn: `${MAX_AGE_DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_DAYS * 86_400_000,
  });
}

export function endSession(res: Response) {
  res.clearCookie(COOKIE);
}

export const requireAuth: RequestHandler = (req, res, next) => {
  try {
    const payload = jwt.verify(req.cookies?.[COOKIE] ?? "", secret());
    if (typeof payload === "string" || !payload.sub) throw new Error("bad token");
    res.locals.userId = payload.sub;
    next();
  } catch {
    next(new HttpError(401, "Not signed in"));
  }
};
