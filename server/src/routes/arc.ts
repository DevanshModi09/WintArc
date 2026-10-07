import { Router } from "express";
import { z } from "zod";
import { currentArc } from "../arcs";
import { ARC_DAYS, addDays, parseToday, seasonStart } from "../dates";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { buildArcView } from "../stats";

const MAX_TRACKS = 8;
const MAX_GOALS_PER_TRACK = 10;

const goalSchema = z.object({
  title: z.string().trim().min(1, "Goal can't be empty").max(80),
  emoji: z.string().trim().max(8).optional(),
});

const trackSchema = z.object({
  name: z.string().trim().min(1, "Give the track a name").max(40),
  isPublic: z.boolean().default(true),
});

const createArcSchema = z.object({
  name: z.string().trim().min(1, "Give your arc a name").max(60),
  tracks: z
    .array(
      trackSchema.extend({
        goals: z.array(goalSchema).min(1, "Every track needs at least one daily goal").max(MAX_GOALS_PER_TRACK),
      }),
    )
    .min(1, "Add at least one track")
    .max(MAX_TRACKS),
});

const checkInSchema = z.object({ done: z.boolean() });

async function arcResponse(userId: string, today: string) {
  const arc = await currentArc(userId);
  return { arc: arc ? buildArcView(arc, today) : null };
}

async function ownedTrack(userId: string, trackId: string) {
  const track = await prisma.track.findFirst({
    where: { id: trackId, arc: { userId } },
    include: { arc: true, _count: { select: { goals: true } } },
  });
  if (!track) throw new HttpError(404, "Track not found");
  return track;
}

async function ownedGoal(userId: string, goalId: string) {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, track: { arc: { userId } } },
    include: { track: { include: { arc: true } } },
  });
  if (!goal) throw new HttpError(404, "Goal not found");
  return goal;
}

export const arcRouter = Router();

arcRouter.get("/arc", async (req, res) => {
  res.json(await arcResponse(res.locals.userId, parseToday(req.query.today)));
});

arcRouter.post("/arc", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { name, tracks } = createArcSchema.parse(req.body);
  const startDate = seasonStart(today);
  // Someone joining mid-arc isn't marked as missing the days before they joined.
  const startsOn = today > startDate ? today : startDate;
  await prisma.arc.create({
    data: {
      userId: res.locals.userId,
      name,
      startDate,
      endDate: addDays(startDate, ARC_DAYS - 1),
      tracks: {
        create: tracks.map((t) => ({
          name: t.name,
          isPublic: t.isPublic,
          goals: { create: t.goals.map((g) => ({ ...g, startsOn })) },
        })),
      },
    },
  });
  res.status(201).json(await arcResponse(res.locals.userId, today));
});

arcRouter.delete("/arc/:id", async (req, res) => {
  const today = parseToday(req.query.today);
  await prisma.arc.deleteMany({ where: { id: req.params.id, userId: res.locals.userId } });
  res.json(await arcResponse(res.locals.userId, today));
});

arcRouter.post("/tracks", async (req, res) => {
  const today = parseToday(req.body?.today);
  const track = trackSchema.parse(req.body);
  const arc = await currentArc(res.locals.userId);
  if (!arc) throw new HttpError(404, "Start an arc first");
  if (arc.tracks.length >= MAX_TRACKS) throw new HttpError(400, `You can have up to ${MAX_TRACKS} tracks`);
  await prisma.track.create({ data: { ...track, arcId: arc.id } });
  res.status(201).json(await arcResponse(res.locals.userId, today));
});

arcRouter.patch("/tracks/:id", async (req, res) => {
  const today = parseToday(req.body?.today);
  const changes = trackSchema.partial().parse(req.body);
  const track = await ownedTrack(res.locals.userId, req.params.id);
  await prisma.track.update({ where: { id: track.id }, data: changes });
  res.json(await arcResponse(res.locals.userId, today));
});

arcRouter.delete("/tracks/:id", async (req, res) => {
  const today = parseToday(req.query.today);
  const track = await ownedTrack(res.locals.userId, req.params.id);
  await prisma.track.delete({ where: { id: track.id } });
  res.json(await arcResponse(res.locals.userId, today));
});

arcRouter.post("/goals", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { trackId, ...goal } = goalSchema.extend({ trackId: z.string() }).parse(req.body);
  const track = await ownedTrack(res.locals.userId, trackId);
  if (track._count.goals >= MAX_GOALS_PER_TRACK) {
    throw new HttpError(400, `A track can have up to ${MAX_GOALS_PER_TRACK} goals`);
  }
  await prisma.goal.create({ data: { ...goal, trackId: track.id, startsOn: today } });
  res.status(201).json(await arcResponse(res.locals.userId, today));
});

arcRouter.delete("/goals/:id", async (req, res) => {
  const today = parseToday(req.query.today);
  const goal = await ownedGoal(res.locals.userId, req.params.id);
  await prisma.goal.delete({ where: { id: goal.id } });
  res.json(await arcResponse(res.locals.userId, today));
});

// Check-ins are only ever for today: no backfilling missed days.
arcRouter.put("/goals/:id/checkin", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { done } = checkInSchema.parse(req.body);
  const goal = await ownedGoal(res.locals.userId, req.params.id);
  const { arc } = goal.track;
  if (today < arc.startDate || today > arc.endDate) {
    throw new HttpError(400, today < arc.startDate ? "Your arc hasn't started yet" : "This arc is over");
  }
  if (done) {
    await prisma.checkIn.upsert({
      where: { goalId_date: { goalId: goal.id, date: today } },
      create: { goalId: goal.id, date: today },
      update: {},
    });
  } else {
    await prisma.checkIn.deleteMany({ where: { goalId: goal.id, date: today } });
  }
  res.json(await arcResponse(res.locals.userId, today));
});
