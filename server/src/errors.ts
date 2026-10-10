import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Prisma's "unique constraint failed" and "record not found". They show up
// when two requests race, e.g. the same goal deleted from two tabs.
const PRISMA_ERRORS: Record<string, [number, string]> = {
  P2002: [409, "That already exists"],
  P2025: [404, "Not found"],
};

// What express.json() reports for a body it can't accept.
const BODY_ERRORS: Record<string, [number, string]> = {
  "entity.parse.failed": [400, "Invalid JSON"],
  "entity.too.large": [413, "That's too large to upload"],
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  // What the person was told goes in the log entry for the request too.
  const fail = (status: number, error: string) => {
    res.locals.logError ??= error;
    res.status(status).json({ error });
  };
  if (err instanceof HttpError) return fail(err.status, err.message);
  if (err instanceof ZodError) return fail(400, err.issues[0]?.message ?? "Invalid input");
  const known = PRISMA_ERRORS[err?.code] ?? BODY_ERRORS[err?.type];
  if (known) return fail(known[0], known[1]);
  // Express's own errors, such as a static file that doesn't exist.
  if (err?.status >= 400 && err.status < 500) return fail(err.status, "Not found");
  console.error(`${req.method} ${req.originalUrl.split("?")[0]}`, err);
  // The log keeps what really went wrong; the person is told less.
  res.locals.logError = err?.message ?? String(err);
  res.locals.logStack = err?.stack;
  fail(500, "Something went wrong");
};
