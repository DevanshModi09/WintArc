import { Router } from "express";
import { z } from "zod";
import { allArcs, type currentArc, currentArcs, seasonArcs } from "../arcs";
import { ARC_DAYS, addDays, diffDays, parseToday, seasonStart } from "../dates";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { buildArcView } from "../stats";
import { profileSelect, publicUserSelect, toPublicUser } from "../users";

type Relation = "self" | "friends" | "incoming" | "outgoing" | "none";

const involving = (me: string, others: string[]) => ({
  OR: [
    { requesterId: me, addresseeId: { in: others } },
    { requesterId: { in: others }, addresseeId: me },
  ],
});

type FriendshipRow = { id: string; requesterId: string; accepted: boolean };

function describe(me: string, f: FriendshipRow | undefined) {
  let relation: Relation = "none";
  if (f?.accepted) relation = "friends";
  else if (f) relation = f.requesterId === me ? "outgoing" : "incoming";
  return { relation, friendshipId: f?.id ?? null };
}

// The friendship row between two users, whichever of them sent the request.
async function friendshipBetween(a: string, b: string) {
  return prisma.friendship.findFirst({ where: involving(a, [b]) });
}

async function relationTo(me: string, other: string) {
  if (me === other) return { relation: "self" as Relation, friendshipId: null };
  return describe(me, (await friendshipBetween(me, other)) ?? undefined);
}

type ArcRow = NonNullable<Awaited<ReturnType<typeof currentArc>>>;

// What a friend sees of someone's arc in a list: headline numbers only.
function arcSummary(arc: ArcRow | undefined, today: string) {
  if (!arc) return null;
  const { name, dayNumber, totalDays, startsIn, isOver, streak, level, xp, today: progress } = buildArcView(arc, today);
  return { name, dayNumber, totalDays, startsIn, isOver, streak, level, xp, today: progress };
}

// An arc that has been replaced by a newer one, as a single line of history.
function pastArc(arc: ArcRow, today: string) {
  const { id, name, startDate, endDate, streak, perfectDays, totalCheckIns, xp, level } = buildArcView(arc, today);
  return { id, name, startDate, endDate, bestStreak: streak.best, perfectDays, totalCheckIns, xp, level: level.number };
}

export const socialRouter = Router();

socialRouter.get("/users", async (req, res) => {
  const q = z.string().trim().min(2, "Type at least 2 characters").max(40).parse(req.query.q);
  const users = await prisma.user.findMany({
    where: {
      id: { not: res.locals.userId },
      OR: [
        { username: { contains: q.toLowerCase() } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    select: publicUserSelect,
    orderBy: { username: "asc" },
    take: 10,
  });
  const me: string = res.locals.userId;
  const friendships = await prisma.friendship.findMany({ where: involving(me, users.map((u) => u.id)) });
  res.json({
    users: users.map((u) => ({
      ...toPublicUser(u),
      ...describe(me, friendships.find((f) => f.requesterId === u.id || f.addresseeId === u.id)),
    })),
  });
});

// Anyone signed in can view a profile, but only its public tracks.
socialRouter.get("/users/:username", async (req, res) => {
  const today = parseToday(req.query.today);
  const user = await prisma.user.findUnique({
    where: { username: req.params.username.toLowerCase() },
    select: profileSelect,
  });
  if (!user) throw new HttpError(404, "User not found");
  const isSelf = user.id === res.locals.userId;
  const [arc, ...older] = await allArcs(user.id);
  res.json({
    user: toPublicUser(user),
    ...(await relationTo(res.locals.userId, user.id)),
    arc: arc ? buildArcView(arc, today, { publicOnly: !isSelf }) : null,
    pastArcs: older.map((a) => pastArc(a, today)),
  });
});

socialRouter.get("/friends", async (req, res) => {
  const today = parseToday(req.query.today);
  const me: string = res.locals.userId;
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: me }, { addresseeId: me }] },
    include: { requester: { select: publicUserSelect }, addressee: { select: publicUserSelect } },
    orderBy: { createdAt: "desc" },
  });
  const other = (f: (typeof rows)[number]) => (f.requesterId === me ? f.addressee : f.requester);

  const accepted = rows.filter((f) => f.accepted);
  const arcs = await currentArcs([me, ...accepted.map((f) => other(f).id)]);
  const friends = accepted.map((f) => ({
    friendshipId: f.id,
    user: toPublicUser(other(f)),
    arc: arcSummary(arcs.get(other(f).id), today),
  }));
  friends.sort((a, b) => (b.arc?.streak.current ?? -1) - (a.arc?.streak.current ?? -1));

  const pending = rows.filter((f) => !f.accepted);
  const self = await prisma.user.findUniqueOrThrow({ where: { id: me }, select: publicUserSelect });
  res.json({
    // Your own numbers, so the page can rank you against your friends.
    me: { user: toPublicUser(self), arc: arcSummary(arcs.get(me), today) },
    friends,
    incoming: pending.filter((f) => f.addresseeId === me).map((f) => ({ friendshipId: f.id, user: toPublicUser(f.requester) })),
    outgoing: pending.filter((f) => f.requesterId === me).map((f) => ({ friendshipId: f.id, user: toPublicUser(f.addressee) })),
  });
});

// Everyone running this season's arc, and who hasn't dropped a day yet.
// Working it out reads every arc of the season, so the result is kept for a
// short while and shared between viewers.
const BOARD_TTL_MS = 30_000;
let board: { key: string; at: number; rows: Promise<BoardRow[]> } | undefined;

type BoardRow = { user: ReturnType<typeof toPublicUser>; alive: boolean; fellOnDay: number | null; streak: number; xp: number; level: number };

async function boardRows(startDate: string, today: string): Promise<BoardRow[]> {
  const arcs = await seasonArcs(startDate);
  const users = await prisma.user.findMany({ where: { id: { in: [...arcs.keys()] } }, select: publicUserSelect });
  return users.flatMap((user) => {
    const arc = arcs.get(user.id)!;
    // An arc with no goals isn't in the running.
    if (!arc.tracks.some((t) => t.goals.length > 0)) return [];
    const { survivor, streak, xp, level } = buildArcView(arc, today);
    return [{ user: toPublicUser(user), ...survivor, streak: streak.current, xp, level: level.number }];
  });
}

socialRouter.get("/survivors", async (req, res) => {
  const today = parseToday(req.query.today);
  const startDate = seasonStart(today);
  const key = `${startDate} ${today}`;
  if (board?.key !== key || Date.now() - board.at > BOARD_TTL_MS) {
    board = { key, at: Date.now(), rows: boardRows(startDate, today) };
    // A failed load shouldn't be served to the next viewer.
    board.rows.catch(() => (board = undefined));
  }
  const rows = await board.rows;
  const standing = rows.filter((r) => r.alive).sort((a, b) => b.xp - a.xp);
  const me = rows.find((r) => r.user.id === res.locals.userId);
  res.json({
    season: {
      startDate,
      totalDays: ARC_DAYS,
      startsIn: Math.max(0, diffDays(today, startDate)),
      dayNumber: Math.min(ARC_DAYS, Math.max(0, diffDays(startDate, today) + 1)),
    },
    started: rows.length,
    standing: standing.length,
    me: me ? { alive: me.alive, fellOnDay: me.fellOnDay } : null,
    survivors: standing.slice(0, 100).map(({ user, streak, xp, level }) => ({ user, streak, xp, level })),
  });
});

// The last week of work from you and your friends, a card per person per day.
// Friends' private tracks never appear.
socialRouter.get("/feed", async (req, res) => {
  const today = parseToday(req.query.today);
  const me: string = res.locals.userId;
  const friendships = await prisma.friendship.findMany({
    where: { accepted: true, OR: [{ requesterId: me }, { addresseeId: me }] },
    select: { requesterId: true, addresseeId: true },
  });
  const friendIds = friendships.map((f) => (f.requesterId === me ? f.addresseeId : f.requesterId));

  const checkIns = await prisma.checkIn.findMany({
    where: {
      date: { gte: addDays(today, -6) },
      goal: { track: { OR: [{ arc: { userId: me } }, { isPublic: true, arc: { userId: { in: friendIds } } }] } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      date: true,
      note: true,
      link: true,
      goal: { select: { title: true, track: { select: { name: true, arc: { select: { userId: true } } } } } },
    },
  });

  const users = await prisma.user.findMany({ where: { id: { in: [me, ...friendIds] } }, select: publicUserSelect });
  const byId = new Map(users.map((u) => [u.id, toPublicUser(u)]));
  type Entry = { user: ReturnType<typeof toPublicUser>; date: string; items: { id: string; goal: string; track: string; note: string | null; link: string | null }[] };
  // Newest first, so each card sits where its latest check-in does.
  const entries = new Map<string, Entry>();
  for (const c of checkIns) {
    const userId = c.goal.track.arc.userId;
    const key = `${userId} ${c.date}`;
    if (!entries.has(key)) entries.set(key, { user: byId.get(userId)!, date: c.date, items: [] });
    entries.get(key)!.items.push({ id: c.id, goal: c.goal.title, track: c.goal.track.name, note: c.note, link: c.link });
  }
  res.json({ entries: [...entries.values()].slice(0, 40) });
});

socialRouter.post("/friends", async (req, res) => {
  const me: string = res.locals.userId;
  const { username } = z.object({ username: z.string().trim().toLowerCase() }).parse(req.body);
  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) throw new HttpError(404, "User not found");
  if (target.id === me) throw new HttpError(400, "You can't add yourself");

  const existing = await friendshipBetween(me, target.id);
  if (existing?.accepted) throw new HttpError(409, "You're already friends");
  if (existing?.requesterId === me) throw new HttpError(409, "Request already sent");
  // They had already asked us, so sending a request back just accepts theirs.
  const friendship = existing
    ? await prisma.friendship.update({ where: { id: existing.id }, data: { accepted: true } })
    : await prisma.friendship.create({ data: { requesterId: me, addresseeId: target.id } });
  res.status(201).json({ friendshipId: friendship.id, relation: friendship.accepted ? "friends" : "outgoing" });
});

socialRouter.post("/friends/:id/accept", async (req, res) => {
  const { count } = await prisma.friendship.updateMany({
    where: { id: req.params.id, addresseeId: res.locals.userId, accepted: false },
    data: { accepted: true },
  });
  if (count === 0) throw new HttpError(404, "Request not found");
  res.json({ ok: true });
});

// Declines a request, cancels one you sent, or removes a friend.
socialRouter.delete("/friends/:id", async (req, res) => {
  const me: string = res.locals.userId;
  const { count } = await prisma.friendship.deleteMany({
    where: { id: req.params.id, OR: [{ requesterId: me }, { addresseeId: me }] },
  });
  if (count === 0) throw new HttpError(404, "Friendship not found");
  res.json({ ok: true });
});
