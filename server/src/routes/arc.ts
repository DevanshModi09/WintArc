import { Router } from "express";
import { z } from "zod";
import { currentArc } from "../arcs";
import { ARC_DAYS, addDays, parseToday, seasonStart, weekday } from "../dates";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { buildArcView, isLocked } from "../stats";

const MAX_TRACKS = 8;
const MAX_GOALS_PER_TRACK = 10;
const MAX_SUBTASKS_PER_GOAL = 8;
const MAX_CHECKPOINTS_PER_TRACK = 30;

const subtaskTitle = z.string().trim().min(1, "A mini task can't be empty").max(60);

const goalSchema = z.object({
  title: z.string().trim().min(1, "Goal can't be empty").max(80),
  emoji: z.string().trim().max(8).optional(),
  subtasks: z.array(subtaskTitle).max(MAX_SUBTASKS_PER_GOAL).default([]),
});

// The shape Prisma wants for a new goal along with its subtasks.
const newGoal = ({ subtasks, ...goal }: z.infer<typeof goalSchema>, startsOn: string) => ({
  ...goal,
  startsOn,
  subtasks: { create: subtasks.map((title) => ({ title })) },
});

// Anything left out falls back to the column default, so the same schema
// works for partial updates without resetting fields that weren't sent.
const trackSchema = z.object({
  name: z.string().trim().min(1, "Give the track a name").max(40),
  isPublic: z.boolean().optional(),
  days: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Pick at least one day")
    .transform((days) => [...new Set(days)].sort())
    .optional(),
  minutes: z.number().int().min(15).max(720).optional(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid start time")
    .nullable()
    .optional(),
  reminder: z.number().int().min(0).max(1440).nullable().optional(),
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

// An empty optional field is stored as null rather than "".
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const proofSchema = z.object({
  note: optionalText(200),
  link: optionalText(300).refine((v) => v === null || /^https?:\/\/\S+\.\S+$/.test(v), "Link must be a web address"),
});

const LOCKED = "This is locked in for the arc. You can add more, but not take it back.";

// Reflections ride along with the owner's arc and nowhere else, so nobody
// else's view can ever include them.
async function arcResponse(userId: string, today: string) {
  const arc = await currentArc(userId);
  if (!arc) return { arc: null };
  const reflections = await prisma.reflection.findMany({
    where: { arcId: arc.id },
    orderBy: { date: "asc" },
    select: { date: true, text: true },
  });
  return { arc: { ...buildArcView(arc, today), reflections } };
}

async function ownedTrack(userId: string, trackId: string) {
  const track = await prisma.track.findFirst({
    where: { id: trackId, arc: { userId } },
    include: { arc: true, goals: { select: { startsOn: true } }, _count: { select: { goals: true, checkpoints: true } } },
  });
  if (!track) throw new HttpError(404, "Track not found");
  return track;
}

async function ownedGoal(userId: string, goalId: string) {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, track: { arc: { userId } } },
    include: { track: { include: { arc: true } }, subtasks: true },
  });
  if (!goal) throw new HttpError(404, "Goal not found");
  return goal;
}

type OwnedGoal = Awaited<ReturnType<typeof ownedGoal>>;

// Check-ins are only ever for today, and only on a day the track runs.
function assertCanCheckIn({ track }: OwnedGoal, today: string) {
  const { arc } = track;
  if (today < arc.startDate || today > arc.endDate) {
    throw new HttpError(400, today < arc.startDate ? "Your arc hasn't started yet" : "This arc is over");
  }
  if (!track.days.includes(weekday(today))) {
    throw new HttpError(400, "This track isn't scheduled for today");
  }
}

async function setCheckIn(goalId: string, today: string, done: boolean) {
  if (done) {
    await prisma.checkIn.upsert({
      where: { goalId_date: { goalId, date: today } },
      create: { goalId, date: today },
      update: {},
    });
  } else {
    await prisma.checkIn.deleteMany({ where: { goalId, date: today } });
  }
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
        create: tracks.map(({ goals, ...track }) => ({
          ...track,
          goals: { create: goals.map((g) => newGoal(g, startsOn)) },
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
  // A reminder counts back from the start time, so it can't outlive it.
  const startTime = changes.startTime === undefined ? track.startTime : changes.startTime;
  if (startTime === null) changes.reminder = null;
  // Once the arc is running a track can gain days but not lose them.
  const dropsDay = changes.days && track.days.some((d) => !changes.days!.includes(d));
  if (dropsDay && today >= track.arc.startDate) {
    throw new HttpError(400, "Your arc is running, so you can add days to a track but not drop them.");
  }
  await prisma.track.update({ where: { id: track.id }, data: changes });
  res.json(await arcResponse(res.locals.userId, today));
});

arcRouter.delete("/tracks/:id", async (req, res) => {
  const today = parseToday(req.query.today);
  const track = await ownedTrack(res.locals.userId, req.params.id);
  if (track.goals.some((g) => isLocked(g, today))) throw new HttpError(400, LOCKED);
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
  await prisma.goal.create({ data: { ...newGoal(goal, today), trackId: track.id } });
  res.status(201).json(await arcResponse(res.locals.userId, today));
});

arcRouter.patch("/goals/:id", async (req, res) => {
  const today = parseToday(req.body?.today);
  const changes = goalSchema.pick({ title: true }).parse(req.body);
  const goal = await ownedGoal(res.locals.userId, req.params.id);
  if (isLocked(goal, today)) throw new HttpError(400, LOCKED);
  await prisma.goal.update({ where: { id: goal.id }, data: changes });
  res.json(await arcResponse(res.locals.userId, today));
});

arcRouter.delete("/goals/:id", async (req, res) => {
  const today = parseToday(req.query.today);
  const goal = await ownedGoal(res.locals.userId, req.params.id);
  if (isLocked(goal, today)) throw new HttpError(400, LOCKED);
  await prisma.goal.delete({ where: { id: goal.id } });
  res.json(await arcResponse(res.locals.userId, today));
});

// No backfilling missed days. Ticking a goal ticks its subtasks along with it.
arcRouter.put("/goals/:id/checkin", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { done } = checkInSchema.parse(req.body);
  const goal = await ownedGoal(res.locals.userId, req.params.id);
  assertCanCheckIn(goal, today);
  await setCheckIn(goal.id, today, done);
  await prisma.subtask.updateMany({ where: { goalId: goal.id }, data: { doneOn: done ? today : null } });
  res.json(await arcResponse(res.locals.userId, today));
});

// Proof goes on today's check-in, so the goal has to be ticked first.
arcRouter.put("/goals/:id/proof", async (req, res) => {
  const today = parseToday(req.body?.today);
  const proof = proofSchema.parse(req.body);
  const goal = await ownedGoal(res.locals.userId, req.params.id);
  const { count } = await prisma.checkIn.updateMany({ where: { goalId: goal.id, date: today }, data: proof });
  if (count === 0) throw new HttpError(400, "Tick the goal first, then add your proof");
  res.json(await arcResponse(res.locals.userId, today));
});

// One line about today. Saving an empty one removes it.
arcRouter.put("/arc/reflection", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { text } = z.object({ text: z.string().trim().max(280) }).parse(req.body);
  const arc = await currentArc(res.locals.userId);
  if (!arc) throw new HttpError(404, "Start an arc first");
  if (today < arc.startDate || today > arc.endDate) {
    throw new HttpError(400, today < arc.startDate ? "Your arc hasn't started yet" : "This arc is over");
  }
  const where = { arcId_date: { arcId: arc.id, date: today } };
  if (text) await prisma.reflection.upsert({ where, create: { arcId: arc.id, date: today, text }, update: { text } });
  else await prisma.reflection.deleteMany({ where: { arcId: arc.id, date: today } });
  res.json(await arcResponse(res.locals.userId, today));
});

async function ownedSubtask(userId: string, subtaskId: string) {
  const subtask = await prisma.subtask.findFirst({
    where: { id: subtaskId, goal: { track: { arc: { userId } } } },
  });
  if (!subtask) throw new HttpError(404, "Mini task not found");
  return { subtask, goal: await ownedGoal(userId, subtask.goalId) };
}

arcRouter.post("/subtasks", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { goalId, title } = z.object({ goalId: z.string(), title: subtaskTitle }).parse(req.body);
  const goal = await ownedGoal(res.locals.userId, goalId);
  if (goal.subtasks.length >= MAX_SUBTASKS_PER_GOAL) {
    throw new HttpError(400, `A goal can have up to ${MAX_SUBTASKS_PER_GOAL} mini tasks`);
  }
  // A goal already ticked today stays ticked, so the new subtask starts done.
  const checkedIn = await prisma.checkIn.findUnique({ where: { goalId_date: { goalId: goal.id, date: today } } });
  await prisma.subtask.create({ data: { goalId: goal.id, title, doneOn: checkedIn ? today : null } });
  res.status(201).json(await arcResponse(res.locals.userId, today));
});

// The goal is done for the day exactly when every subtask is.
arcRouter.put("/subtasks/:id/check", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { done } = checkInSchema.parse(req.body);
  const { subtask, goal } = await ownedSubtask(res.locals.userId, req.params.id);
  assertCanCheckIn(goal, today);
  await prisma.subtask.update({ where: { id: subtask.id }, data: { doneOn: done ? today : null } });
  const others = goal.subtasks.filter((s) => s.id !== subtask.id);
  await setCheckIn(goal.id, today, done && others.every((s) => s.doneOn === today));
  res.json(await arcResponse(res.locals.userId, today));
});

arcRouter.delete("/subtasks/:id", async (req, res) => {
  const today = parseToday(req.query.today);
  const { subtask, goal } = await ownedSubtask(res.locals.userId, req.params.id);
  if (isLocked(goal, today)) throw new HttpError(400, LOCKED);
  await prisma.subtask.delete({ where: { id: subtask.id } });
  // Removing the last unticked one can finish the goal.
  const left = goal.subtasks.filter((s) => s.id !== subtask.id);
  const { arc, days } = goal.track;
  const open = today >= arc.startDate && today <= arc.endDate && days.includes(weekday(today));
  if (open && left.length > 0 && left.every((s) => s.doneOn === today)) await setCheckIn(goal.id, today, true);
  res.json(await arcResponse(res.locals.userId, today));
});

const checkpointTitle = z.string().trim().min(1, "A checkpoint can't be empty").max(80);

async function ownedCheckpoint(userId: string, checkpointId: string) {
  const checkpoint = await prisma.checkpoint.findFirst({
    where: { id: checkpointId, track: { arc: { userId } } },
  });
  if (!checkpoint) throw new HttpError(404, "Checkpoint not found");
  return checkpoint;
}

arcRouter.post("/checkpoints", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { trackId, title } = z.object({ trackId: z.string(), title: checkpointTitle }).parse(req.body);
  const track = await ownedTrack(res.locals.userId, trackId);
  if (track._count.checkpoints >= MAX_CHECKPOINTS_PER_TRACK) {
    throw new HttpError(400, `A track can have up to ${MAX_CHECKPOINTS_PER_TRACK} checkpoints`);
  }
  // New ones go to the bottom of the list.
  const last = await prisma.checkpoint.aggregate({ where: { trackId: track.id }, _max: { position: true } });
  await prisma.checkpoint.create({ data: { trackId: track.id, title, position: (last._max.position ?? -1) + 1 } });
  res.status(201).json(await arcResponse(res.locals.userId, today));
});

// Checkpoints aren't tied to a day: tick one whenever it's reached, and it
// stays ticked until it's unticked.
arcRouter.patch("/checkpoints/:id", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { title, done } = z.object({ title: checkpointTitle.optional(), done: z.boolean().optional() }).parse(req.body);
  const checkpoint = await ownedCheckpoint(res.locals.userId, req.params.id);
  // Ticking one that's already ticked keeps the original date.
  const doneAt = done === undefined ? undefined : done ? (checkpoint.doneAt ?? new Date()) : null;
  await prisma.checkpoint.update({ where: { id: checkpoint.id }, data: { title, doneAt } });
  res.json(await arcResponse(res.locals.userId, today));
});

arcRouter.delete("/checkpoints/:id", async (req, res) => {
  const today = parseToday(req.query.today);
  const checkpoint = await ownedCheckpoint(res.locals.userId, req.params.id);
  await prisma.checkpoint.delete({ where: { id: checkpoint.id } });
  res.json(await arcResponse(res.locals.userId, today));
});

// Saves the order after a drag: every checkpoint id of the track, top to bottom.
arcRouter.put("/tracks/:id/checkpoints/order", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { ids } = z.object({ ids: z.array(z.string()).max(MAX_CHECKPOINTS_PER_TRACK) }).parse(req.body);
  const track = await ownedTrack(res.locals.userId, req.params.id);
  const existing = await prisma.checkpoint.findMany({ where: { trackId: track.id }, select: { id: true } });
  const same = ids.length === existing.length && new Set(ids).size === ids.length && existing.every((c) => ids.includes(c.id));
  // The list changed in another tab since this one loaded it.
  if (!same) throw new HttpError(409, "Your checkpoints changed. Reload and try again.");
  await prisma.$transaction(ids.map((id, position) => prisma.checkpoint.update({ where: { id }, data: { position } })));
  res.json(await arcResponse(res.locals.userId, today));
});
