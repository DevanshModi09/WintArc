import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { publicUserSelect, toPublicUser } from "../users";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "Username must be 3-20 letters, numbers or underscores"),
});

const sessionUser = { ...publicUserSelect, email: true } as const;

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
