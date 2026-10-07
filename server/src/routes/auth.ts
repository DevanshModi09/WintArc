import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth";
import { prisma } from "../db";
import { HttpError } from "../errors";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "Username must be 3-20 letters, numbers or underscores"),
});

const sessionUser = { id: true, name: true, username: true, email: true } as const;

export const authRouter = Router();
authRouter.use(requireAuth);

// `user` is null for someone who has signed in but not yet picked a username.
authRouter.get("/me", async (_req, res) => {
  const user = await prisma.user.findUnique({ where: { id: res.locals.authId }, select: sessionUser });
  res.json({ user, suggestedName: res.locals.suggestedName });
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
  res.status(201).json({ user });
});
