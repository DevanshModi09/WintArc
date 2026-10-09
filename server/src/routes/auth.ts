import { Router } from "express";
import { z } from "zod";
import { deleteAuthUser, requireAuth } from "../auth";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { profileSelect, publicUserSelect, toPublicUser } from "../users";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "Username must be 3-20 letters, numbers or underscores"),
});

// An empty optional field is stored as null rather than "".
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const editProfileSchema = z.object({
  name: profileSchema.shape.name,
  bio: optionalText(160),
  location: optionalText(60),
  link: optionalText(200).refine((v) => v === null || /^https?:\/\/\S+\.\S+$/.test(v), "Link must be a web address"),
  stack: z
    .array(z.string().trim().min(1).max(24))
    .max(12, "Keep it to 12 tags")
    // Drop repeats, ignoring case.
    .transform((tags) => tags.filter((t, i) => tags.findIndex((o) => o.toLowerCase() === t.toLowerCase()) === i)),
});

const sessionUser = { ...publicUserSelect, email: true, sharePublic: true } as const;

const MAX_AVATAR_BYTES = 200_000;
const JPEG_PREFIX = "data:image/jpeg;base64,";

async function setAvatar(id: string, avatar: Uint8Array<ArrayBuffer> | null) {
  const { count } = await prisma.user.updateMany({
    where: { id },
    data: { avatar, avatarUpdatedAt: avatar ? new Date() : null },
  });
  if (count === 0) throw new HttpError(403, "Finish setting up your profile first");
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: sessionUser });
  return { user: toPublicUser(user) };
}

export const authRouter = Router();
authRouter.use(requireAuth);

// `user` is null for someone who has signed in but not yet picked a username.
authRouter.get("/me", async (_req, res) => {
  const user = await prisma.user.findUnique({ where: { id: res.locals.authId }, select: sessionUser });
  res.json({ user: user && toPublicUser(user), suggestedName: res.locals.suggestedName });
});

authRouter.post("/profile", async (req, res) => {
  const { name, username } = profileSchema.parse(req.body);
  const id: string = res.locals.authId;
  if (!res.locals.email) throw new HttpError(400, "Your account has no email address");
  if (await prisma.user.findUnique({ where: { id } })) {
    throw new HttpError(409, "Your profile is already set up");
  }
  if (await prisma.user.findUnique({ where: { username } })) {
    throw new HttpError(409, "That username is taken");
  }
  const user = await prisma.user.create({
    data: { id, name, username, email: res.locals.email },
    select: sessionUser,
  });
  res.status(201).json({ user: toPublicUser(user) });
});

authRouter.patch("/profile", async (req, res) => {
  const data = editProfileSchema.parse(req.body);
  const { count } = await prisma.user.updateMany({ where: { id: res.locals.authId }, data });
  if (count === 0) throw new HttpError(403, "Finish setting up your profile first");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: res.locals.authId }, select: profileSelect });
  res.json({ user: toPublicUser(user) });
});

// Turns the public commitment page on or off.
authRouter.put("/sharing", async (req, res) => {
  const { sharePublic } = z.object({ sharePublic: z.boolean() }).parse(req.body);
  const { count } = await prisma.user.updateMany({ where: { id: res.locals.authId }, data: { sharePublic } });
  if (count === 0) throw new HttpError(403, "Finish setting up your profile first");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: res.locals.authId }, select: sessionUser });
  res.json({ user: toPublicUser(user) });
});

// The browser crops and shrinks the photo first and sends it as a JPEG data URL.
authRouter.put("/avatar", async (req, res) => {
  const { image } = z.object({ image: z.string().startsWith(JPEG_PREFIX, "Upload a JPEG image") }).parse(req.body);
  const bytes = Buffer.from(image.slice(JPEG_PREFIX.length), "base64");
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isJpeg) throw new HttpError(400, "That file isn't a valid image");
  if (bytes.length > MAX_AVATAR_BYTES) throw new HttpError(400, "That image is too large");
  res.json(await setAvatar(res.locals.authId, new Uint8Array(bytes)));
});

authRouter.delete("/avatar", async (_req, res) => {
  res.json(await setAvatar(res.locals.authId, null));
});

// Everything we hold about the signed-in user, as one downloadable file.
authRouter.get("/export", async (_req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: res.locals.authId },
    omit: { avatar: true },
    include: {
      arcs: {
        orderBy: { createdAt: "asc" },
        include: {
          reflections: { select: { date: true, text: true }, orderBy: { date: "asc" } },
          tracks: {
            orderBy: { createdAt: "asc" },
            include: {
              checkpoints: { select: { title: true, doneAt: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
              goals: {
                orderBy: { createdAt: "asc" },
                include: {
                  checkIns: { select: { date: true, note: true, link: true }, orderBy: { date: "asc" } },
                  subtasks: { select: { title: true }, orderBy: { createdAt: "asc" } },
                },
              },
            },
          },
        },
      },
      sentRequests: { select: { accepted: true, createdAt: true, addressee: { select: { username: true } } } },
      receivedRequests: { select: { accepted: true, createdAt: true, requester: { select: { username: true } } } },
    },
  });
  if (!user) throw new HttpError(403, "Finish setting up your profile first");
  res.json({ exportedAt: new Date().toISOString(), user });
});

// Deleting the user row takes their arcs, check-ins and friendships with it.
// Typing the username is the confirmation, so a stray request can't do this.
authRouter.delete("/account", async (req, res) => {
  const { username } = z.object({ username: z.string().trim().toLowerCase() }).parse(req.body);
  const { count } = await prisma.user.deleteMany({ where: { id: res.locals.authId, username } });
  if (count === 0) throw new HttpError(400, "That isn't your username");
  await deleteAuthUser(res.locals.authId);
  res.json({ ok: true });
});
