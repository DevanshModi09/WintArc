import { Router } from "express";
import webpush from "web-push";
import { z } from "zod";
import { currentArcs } from "./arcs";
import { prisma } from "./db";
import { env } from "./env";
import { HttpError } from "./errors";
import { localNow, remindersDue, type Message } from "./reminders";

// Reminders, sent as push notifications to the browsers and installed apps
// people have switched them on in. Two kinds: a heads-up before a track's
// start time, for tracks that have a reminder set, and one in the evening if
// anything due that day still hasn't been committed.
//
// It needs a VAPID key pair (see .env.example). Without one, reminders are
// simply off: nothing is offered in the app and nothing is sent.

const enabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (enabled) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);

async function send(userId: string, message: Message) {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(
    subscriptions.map((s) =>
      webpush
        .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message))
        .catch(async (err: { statusCode?: number }) => {
          // The browser has dropped this subscription, so forget it.
          if (err.statusCode === 404 || err.statusCode === 410) {
            await prisma.pushSubscription.deleteMany({ where: { id: s.id } });
          } else console.error("Could not send a reminder", err.statusCode ?? err);
        }),
    ),
  );
}

async function tick() {
  const subscriptions = await prisma.pushSubscription.findMany({ select: { userId: true, timezone: true } });
  if (subscriptions.length === 0) return;
  // One clock per person: the timezone of their most recently added device.
  const timezones = new Map(subscriptions.map((s) => [s.userId, s.timezone]));
  const arcs = await currentArcs([...timezones.keys()]);
  for (const [userId, timezone] of timezones) {
    const arc = arcs.get(userId);
    if (!arc) continue;
    const { date, minutes } = localNow(timezone);
    if (date < arc.startDate || date > arc.endDate) continue;
    for (const message of remindersDue(arc.tracks, date, minutes)) await send(userId, message);
  }
}

// Checks once a minute, on the minute, so each reminder goes out exactly once.
export function startReminders() {
  if (!enabled) {
    console.log("Reminders are off: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY aren't set.");
    return;
  }
  const run = () => tick().catch((err) => console.error("Reminder check failed", err));
  setTimeout(() => {
    run();
    setInterval(run, 60_000).unref();
  }, 60_000 - (Date.now() % 60_000)).unref();
}

const subscribeSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(200) }),
  timezone: z
    .string()
    .max(64)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone"),
});

export const pushRouter = Router();

// The public half of the key pair, which the browser needs to subscribe.
// Null means reminders aren't set up on this server.
pushRouter.get("/push/key", (_req, res) => {
  res.json({ key: enabled ? env.VAPID_PUBLIC_KEY : null });
});

pushRouter.post("/push/subscriptions", async (req, res) => {
  if (!enabled) throw new HttpError(503, "Reminders aren't set up yet");
  const { endpoint, keys, timezone } = subscribeSchema.parse(req.body);
  const data = { userId: res.locals.userId as string, p256dh: keys.p256dh, auth: keys.auth, timezone };
  await prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });
  res.status(201).json({ ok: true });
});

pushRouter.delete("/push/subscriptions", async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: res.locals.userId } });
  res.json({ ok: true });
});

// Sends one to yourself, so you can see reminders are working.
pushRouter.post("/push/test", async (_req, res) => {
  if (!enabled) throw new HttpError(503, "Reminders aren't set up yet");
  await send(res.locals.userId, { title: "Reminders are on", body: "This is what a WintArc reminder looks like.", url: "/" });
  res.json({ ok: true });
});
