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
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const known = PRISMA_ERRORS[err?.code] ?? BODY_ERRORS[err?.type];
  if (known) {
    res.status(known[0]).json({ error: known[1] });
    return;
  }
  // Express's own errors, such as a static file that doesn't exist.
  if (err?.status >= 400 && err.status < 500) {
    res.status(err.status).json({ error: "Not found" });
    return;
  }
  console.error(`${req.method} ${req.originalUrl.split("?")[0]}`, err);
  res.status(500).json({ error: "Something went wrong" });
};
