import { Router } from "express";
import { z } from "zod";
import { currentArc } from "../arcs";
import { parseToday, season, weekday } from "../dates";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { buildArcView, isLocked } from "../stats";

const MAX_TRACKS = 8;
const MAX_CHECKPOINTS_PER_TRACK = 30;

const checkpointTitle = z.string().trim().min(1, "A checkpoint can't be empty").max(80);

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

// A track's checkpoints are fixed the moment it's created: they can be ticked
// and reordered afterwards, but never added to, reworded or removed. So the
// whole list comes in with the track.
const newTrackSchema = trackSchema.extend({
  checkpoints: z.array(checkpointTitle).max(MAX_CHECKPOINTS_PER_TRACK).default([]),
});

// The shape Prisma wants for a new track's checkpoints, in the order given.
const newCheckpoints = (titles: string[]) => ({ create: titles.map((title, position) => ({ title, position })) });

// Every track gets one goal row to hang its check-ins on. Nobody sees or names
// it: the day's task is whichever checkpoint the track is up to. It starts
// today, so a track isn't marked as missing the days before it existed.
const sessionGoal = (startsOn: string) => ({ title: "Session", startsOn });

const createArcSchema = z.object({
  name: z.string().trim().min(1, "Give your arc a name").max(60),
  tracks: z.array(newTrackSchema).min(1, "Add at least one track").max(MAX_TRACKS),
});

// An empty optional field is stored as null rather than "".
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const LOCKED = "This is locked in for the arc. You can add more, but not take it back.";

// Reflections ride along with the owner's arc and nowhere else, so nobody
// else's view can ever include them. The season says whether an arc can be
// started today, for someone who doesn't have one.
async function arcResponse(userId: string, today: string) {
  const arc = await currentArc(userId);
  if (!arc) return { arc: null, season: season(today) };
  const reflections = await prisma.reflection.findMany({
    where: { arcId: arc.id },
    orderBy: { date: "asc" },
    select: { date: true, text: true },
  });
  return { arc: { ...buildArcView(arc, today), reflections }, season: season(today) };
}

async function ownedTrack(userId: string, trackId: string) {
  const track = await prisma.track.findFirst({
    where: { id: trackId, arc: { userId } },
    include: {
      arc: true,
      goals: { orderBy: { createdAt: "asc" }, select: { id: true, startsOn: true } },
      checkpoints: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, doneAt: true } },
    },
  });
  if (!track) throw new HttpError(404, "Track not found");
  return track;
}

export const arcRouter = Router();

arcRouter.get("/arc", async (req, res) => {
  res.json(await arcResponse(res.locals.userId, parseToday(req.query.today)));
});

// An arc starts the day it's created and runs to 1 January. There is
// deliberately no way to delete one: once it's set up, it runs.
arcRouter.post("/arc", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { name, tracks } = createArcSchema.parse(req.body);
  const { canStart, endDate } = season(today);
  if (!canStart) throw new HttpError(400, "This year's arc is closed to new starts. Come back next year.");
  const running = await currentArc(res.locals.userId);
  if (running && running.endDate >= today) throw new HttpError(409, "You already have an arc running");
  await prisma.arc.create({
    data: {
      userId: res.locals.userId,
      name,
      startDate: today,
      endDate,
      tracks: {
        create: tracks.map(({ checkpoints, ...track }) => ({
          ...track,
          goals: { create: [sessionGoal(today)] },
          checkpoints: newCheckpoints(checkpoints),
        })),
      },
    },
  });
  res.status(201).json(await arcResponse(res.locals.userId, today));
});

arcRouter.post("/tracks", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { checkpoints, ...track } = newTrackSchema.parse(req.body);
  const arc = await currentArc(res.locals.userId);
  if (!arc) throw new HttpError(404, "Start an arc first");
  if (today > arc.endDate) throw new HttpError(400, "This arc is over");
  if (arc.tracks.length >= MAX_TRACKS) throw new HttpError(400, `You can have up to ${MAX_TRACKS} tracks`);
  await prisma.track.create({
    data: { ...track, arcId: arc.id, goals: { create: [sessionGoal(today)] }, checkpoints: newCheckpoints(checkpoints) },
  });
  res.status(201).json(await arcResponse(res.locals.userId, today));
});

arcRouter.patch("/tracks/:id", async (req, res) => {
  const today = parseToday(req.body?.today);
  const changes = trackSchema.partial().parse(req.body);
  const track = await ownedTrack(res.locals.userId, req.params.id);
  // A reminder counts back from the start time, so it can't outlive it.
  const startTime = changes.startTime === undefined ? track.startTime : changes.startTime;
  if (startTime === null) changes.reminder = null;
  // A track can gain days but not lose them.
  if (changes.days && track.days.some((d) => !changes.days!.includes(d))) {
    throw new HttpError(400, "Your arc is running, so you can add days to a track but not drop them.");
  }
  await prisma.track.update({ where: { id: track.id }, data: changes });
  res.json(await arcResponse(res.locals.userId, today));
});

// Only on the day it was added: after that a track is part of the arc.
arcRouter.delete("/tracks/:id", async (req, res) => {
  const today = parseToday(req.query.today);
  const track = await ownedTrack(res.locals.userId, req.params.id);
  if (track.goals.some((g) => isLocked(g, today))) throw new HttpError(400, LOCKED);
  await prisma.track.delete({ where: { id: track.id } });
  res.json(await arcResponse(res.locals.userId, today));
});

const checkInSchema = z.object({
  // Where the browser put the photo in the "proofs" bucket.
  photo: z.string("Upload a photo of your work to check in").max(200),
  note: optionalText(200),
  // False keeps the photo to its owner: friends see the check-in without it.
  photoPublic: z.boolean().default(true),
});

// The day's entry for a track: a photo of the work, filed against whichever
// checkpoint the track is up to. Only ever for today, only on a day the track
// runs, and there's no taking it back, though the photo can be replaced.
arcRouter.put("/tracks/:id/checkin", async (req, res) => {
  const today = parseToday(req.body?.today);
  const userId: string = res.locals.userId;
  const { photo, note, photoPublic } = checkInSchema.parse(req.body);
  const track = await ownedTrack(userId, req.params.id);

  const { arc } = track;
  if (today < arc.startDate || today > arc.endDate) {
    throw new HttpError(400, today < arc.startDate ? "Your arc hasn't started yet" : "This arc is over");
  }
  if (!track.days.includes(weekday(today))) throw new HttpError(400, "This track isn't scheduled for today");

  // The photo has to be one this person uploaded, and has to really be there.
  const own = photo.startsWith(`${userId}/`) && /^[\w-]+\.jpg$/.test(photo.slice(userId.length + 1));
  const stored = own
    ? await prisma.$queryRaw<unknown[]>`SELECT 1 FROM storage.objects WHERE bucket_id = 'proofs' AND name = ${photo} LIMIT 1`
    : [];
  if (stored.length === 0) throw new HttpError(400, "Upload a photo of your work to check in");

  // Tracks from before check-ins needed a photo may not have their goal row.
  const goal = track.goals[0] ?? (await prisma.goal.create({ data: { ...sessionGoal(today), trackId: track.id } }));
  const checkpointId = track.checkpoints.find((c) => c.doneAt === null)?.id ?? null;
  await prisma.checkIn.upsert({
    where: { goalId_date: { goalId: goal.id, date: today } },
    create: { goalId: goal.id, date: today, photo, note, photoPublic, checkpointId },
    // Replacing the photo keeps the checkpoint the day was first filed under.
    update: { photo, note, photoPublic },
  });
  res.json(await arcResponse(userId, today));
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

async function ownedCheckpoint(userId: string, checkpointId: string) {
  const checkpoint = await prisma.checkpoint.findFirst({
    where: { id: checkpointId, track: { arc: { userId } } },
  });
  if (!checkpoint) throw new HttpError(404, "Checkpoint not found");
  return checkpoint;
}

// Finishing a checkpoint moves the track on to the next one. It isn't tied to
// a check-in: finish one whenever it's reached. It can be reopened, and that
// is the only change a checkpoint allows.
arcRouter.patch("/checkpoints/:id", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { done } = z.strictObject({ done: z.boolean(), today: z.string() }).parse(req.body);
  const checkpoint = await ownedCheckpoint(res.locals.userId, req.params.id);
  // Finishing one that's already finished keeps the original date.
  const data = done
    ? { doneAt: checkpoint.doneAt ?? new Date(), doneOn: checkpoint.doneOn ?? today }
    : { doneAt: null, doneOn: null };
  await prisma.checkpoint.update({ where: { id: checkpoint.id }, data });
  res.json(await arcResponse(res.locals.userId, today));
});

// Saves the order after a drag: every checkpoint id of the track, top to bottom.
arcRouter.put("/tracks/:id/checkpoints/order", async (req, res) => {
  const today = parseToday(req.body?.today);
  const { ids } = z.object({ ids: z.array(z.string()).max(MAX_CHECKPOINTS_PER_TRACK) }).parse(req.body);
  const track = await ownedTrack(res.locals.userId, req.params.id);
  const same =
    ids.length === track.checkpoints.length &&
    new Set(ids).size === ids.length &&
    track.checkpoints.every((c) => ids.includes(c.id));
  // The list changed in another tab since this one loaded it.
  if (!same) throw new HttpError(409, "Your checkpoints changed. Reload and try again.");
  await prisma.$transaction(ids.map((id, position) => prisma.checkpoint.update({ where: { id }, data: { position } })));
  res.json(await arcResponse(res.locals.userId, today));
});
