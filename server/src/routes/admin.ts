import { Router, type RequestHandler } from "express";
import { currentArc, currentArcs } from "../arcs";
import { parseToday } from "../dates";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { buildArcView } from "../stats";
import { profileSelect, publicUserSelect, toPublicUser } from "../users";

// Everything here is for admins: the people who run WintArc, looking at how
// it's being used and at what's being uploaded. An admin sees every track,
// private ones included, and every check-in with its note and photo. The one
// thing left out is people's daily reflections, which the app promises are
// only ever shown to their author.

const requireAdmin: RequestHandler = async (_req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: res.locals.userId }, select: { isAdmin: true } });
  // The same answer as for a page that doesn't exist.
  if (!user?.isAdmin) throw new HttpError(404, "Not found");
  next();
};

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const checkInSelect = {
  id: true,
  date: true,
  note: true,
  photo: true,
  createdAt: true,
  checkpoint: { select: { title: true } },
} as const;

// The headline numbers, and a row per person.
adminRouter.get("/overview", async (req, res) => {
  const today = parseToday(req.query.today);
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { ...publicUserSelect, email: true, createdAt: true, isAdmin: true },
  });
  const arcs = await currentArcs(users.map((u) => u.id));
  // Each person's check-in count and latest check-in, in one pass.
  const activity = await prisma.$queryRaw<{ userId: string; count: bigint; last: string | null }[]>`
    SELECT a."userId" AS "userId", COUNT(c.id) AS count, MAX(c.date) AS last
    FROM "Arc" a
    JOIN "Track" t ON t."arcId" = a.id
    JOIN "Goal" g ON g."trackId" = t.id
    JOIN "CheckIn" c ON c."goalId" = g.id
    GROUP BY a."userId"`;
  const byUser = new Map(activity.map((a) => [a.userId, a]));

  const rows = users.map((user) => {
    const arc = arcs.get(user.id);
    const view = arc && buildArcView(arc, today);
    return {
      user: { ...toPublicUser(user), email: user.email, isAdmin: user.isAdmin, joined: user.createdAt },
      arc: view
        ? {
            startDate: view.startDate,
            dayNumber: view.dayNumber,
            totalDays: view.totalDays,
            isOver: view.isOver,
            streak: view.streak.current,
            bestStreak: view.streak.best,
            xp: view.xp,
            level: view.level.number,
            alive: view.survivor.alive,
            today: view.today,
            tracks: view.tracks.length,
          }
        : null,
      checkIns: Number(byUser.get(user.id)?.count ?? 0),
      lastCheckIn: byUser.get(user.id)?.last ?? null,
    };
  });

  const [checkInsToday, photos] = await Promise.all([
    prisma.checkIn.count({ where: { date: today } }),
    prisma.checkIn.count({ where: { photo: { not: null } } }),
  ]);
  res.json({
    totals: {
      users: users.length,
      withArc: rows.filter((r) => r.arc && !r.arc.isOver).length,
      standing: rows.filter((r) => r.arc?.alive).length,
      checkedInToday: rows.filter((r) => r.lastCheckIn === today).length,
      checkInsToday,
      photos,
    },
    users: rows,
  });
});

// One person, in full: profile, the whole arc with private tracks, their
// recent check-ins and who they're friends with.
adminRouter.get("/users/:username", async (req, res) => {
  const today = parseToday(req.query.today);
  const user = await prisma.user.findUnique({
    where: { username: req.params.username.toLowerCase() },
    select: { ...profileSelect, email: true, isAdmin: true, sharePublic: true },
  });
  if (!user) throw new HttpError(404, "User not found");

  const arc = await currentArc(user.id);
  const checkIns = await prisma.checkIn.findMany({
    where: { goal: { track: { arc: { userId: user.id } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { ...checkInSelect, goal: { select: { track: { select: { name: true, isPublic: true } } } } },
  });
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
    include: { requester: { select: publicUserSelect }, addressee: { select: publicUserSelect } },
  });

  res.json({
    user: { ...toPublicUser(user), email: user.email, isAdmin: user.isAdmin, sharePublic: user.sharePublic },
    arc: arc ? buildArcView(arc, today) : null,
    arcCount: await prisma.arc.count({ where: { userId: user.id } }),
    checkIns: checkIns.map((c) => ({
      id: c.id,
      date: c.date,
      uploadedAt: c.createdAt,
      note: c.note,
      photo: c.photo,
      track: c.goal.track.name,
      trackIsPublic: c.goal.track.isPublic,
      checkpoint: c.checkpoint?.title ?? null,
    })),
    friends: friendships.map((f) => ({
      user: toPublicUser(f.requesterId === user.id ? f.addressee : f.requester),
      accepted: f.accepted,
    })),
  });
});

// Everyone's recent proof photos, newest first, to check that what's being
// uploaded is what it should be. It returns where each photo is in storage;
// opening one still needs the admin's own sign-in.
adminRouter.get("/proofs", async (_req, res) => {
  const checkIns = await prisma.checkIn.findMany({
    where: { photo: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      ...checkInSelect,
      goal: { select: { track: { select: { name: true, arc: { select: { user: { select: publicUserSelect } } } } } } },
    },
  });
  res.json({
    proofs: checkIns.map((c) => ({
      id: c.id,
      date: c.date,
      uploadedAt: c.createdAt,
      note: c.note,
      photo: c.photo,
      track: c.goal.track.name,
      checkpoint: c.checkpoint?.title ?? null,
      user: toPublicUser(c.goal.track.arc.user),
    })),
  });
});
