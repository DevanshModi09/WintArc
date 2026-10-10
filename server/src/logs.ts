import type { Request, RequestHandler } from "express";
import { z } from "zod";
import type { Prisma } from "../generated/prisma/client";
import { identify } from "./auth";
import { prisma } from "./db";
import { isProduction } from "./env";

// The log admins read to work out what went wrong for someone. Three things
// write to it: every API request as it's answered, what browsers report
// (requests that never arrived, failed uploads, crashes), and the server's
// own housekeeping.

export type LogEntry = {
  source: "request" | "client" | "server";
  level: "info" | "warn" | "error";
  event: string;
  at?: Date;
  message?: string | null;
  userId?: string | null;
  method?: string;
  path?: string;
  status?: number;
  ms?: number;
  host?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  detail?: Prisma.InputJsonValue;
};

const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 6 * 60 * 60 * 1000;

const clip = (text: string | null | undefined, max: number) => (text ? text.slice(0, max) : null);

// Never awaited and never throws: a log that can't be written must not take
// the thing it was describing down with it.
export function writeLog(entry: LogEntry) {
  prisma.log
    .create({
      data: {
        ...entry,
        event: entry.event.slice(0, 200),
        message: clip(entry.message, 2000),
        path: clip(entry.path, 300) ?? undefined,
        host: clip(entry.host, 200),
        userAgent: clip(entry.userAgent, 300),
        ip: clip(entry.ip, 60),
      },
    })
    .catch((err) => console.error("Could not write a log entry", err));
}

// Where a request came from. Vercel passes on the address the site was
// opened at as x-forwarded-host, and the visitor's own address at the front
// of x-forwarded-for. Either can be faked, which is fine for a log.
const origin = (req: Request) => ({
  host: req.get("x-forwarded-host") ?? req.get("host") ?? null,
  userAgent: req.get("user-agent") ?? null,
  ip: req.get("x-forwarded-for")?.split(",")[0].trim() || req.ip || null,
});

// Not worth a row each: the health check, avatars that loaded fine, and the
// log's own traffic (reading it, and reports that were taken in).
function isNoise(path: string, status: number) {
  if (path === "/api/health") return true;
  if (path.startsWith("/api/avatars/") && status < 400) return true;
  return (path === "/api/admin/logs" || path === "/api/logs") && status < 400;
}

// One entry per API request, written once it has been answered, or once the
// browser gave up waiting for an answer.
export const logRequests: RequestHandler = (req, res, next) => {
  const started = performance.now();
  res.on("close", () => {
    const ms = Math.round(performance.now() - started);
    const path = req.originalUrl.split("?")[0];
    // The connection closed before the answer was fully sent.
    const abandoned = !res.writableFinished;
    const status = res.statusCode;
    if (isProduction) console.log(JSON.stringify({ method: req.method, path, status, ms, abandoned }));
    if (!abandoned && isNoise(path, status)) return;

    let level: LogEntry["level"] = "info";
    if (status >= 500) level = "error";
    else if (status >= 400 || abandoned) level = "warn";

    const detail: Record<string, string> = {};
    const query = req.originalUrl.split("?")[1];
    if (query) detail.query = query.slice(0, 500);
    if (res.locals.logStack) detail.stack = String(res.locals.logStack).slice(0, 4000);
    writeLog({
      source: "request",
      level,
      event: `${req.method} ${path}`,
      message: abandoned ? "The browser stopped waiting before the answer was sent" : (res.locals.logError ?? null),
      userId: res.locals.userId ?? res.locals.authId ?? null,
      method: req.method,
      path,
      status: abandoned ? undefined : status,
      ms,
      ...origin(req),
      detail,
    });
  });
  next();
};

const reportSchema = z.object({
  events: z
    .array(
      z.object({
        // When it happened on the reporter's clock, in milliseconds.
        at: z.number().optional(),
        level: z.enum(["info", "warn", "error"]),
        event: z.string().trim().min(1).max(200),
        message: z.string().max(2000).nullish(),
        detail: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(30),
});

// What a browser reports. Anyone can send these, signed in or not, since the
// most useful ones come from someone the app isn't working for. Reports are
// held in the browser while the server can't be reached, so they can arrive
// well after the fact; each one carries the time it happened.
export const receiveReports: RequestHandler = async (req, res) => {
  const { events } = reportSchema.parse(req.body);
  const userId = await identify(req);
  const now = Date.now();
  for (const e of events) {
    // Trust the reporter's clock only when it's plausible.
    const at = e.at && e.at <= now + 60_000 && e.at > now - 7 * 24 * 60 * 60 * 1000 ? new Date(e.at) : new Date(now);
    const detail = JSON.stringify(e.detail ?? {});
    writeLog({
      source: "client",
      level: e.level,
      event: e.event,
      message: e.message,
      at,
      userId,
      ...origin(req),
      detail: detail.length <= 6000 ? JSON.parse(detail) : { truncated: detail.slice(0, 6000) },
    });
  }
  res.json({ ok: true });
};

// Notes the server starting and anything that crashes outside a request, and
// clears out entries past their 30 days.
export function startLogs() {
  writeLog({ source: "server", level: "info", event: "server started", detail: { node: process.version } });
  process.on("unhandledRejection", (reason) => {
    console.error(reason);
    const err = reason as Error | undefined;
    writeLog({ source: "server", level: "error", event: "unhandled rejection", message: err?.message ?? String(reason), detail: { stack: err?.stack?.slice(0, 4000) ?? "" } });
  });
  const sweep = () =>
    prisma.log
      .deleteMany({ where: { at: { lt: new Date(Date.now() - KEEP_MS) } } })
      .catch((err) => console.error("Could not clear old log entries", err));
  sweep();
  setInterval(sweep, SWEEP_EVERY_MS).unref();
}
