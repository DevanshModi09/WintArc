import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { endSession, requireAuth, startSession } from "../auth";
import { prisma } from "../db";
import { HttpError } from "../errors";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "Username must be 3-20 letters, numbers or underscores"),
  email: z.email("Enter a valid email").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

const loginSchema = z.object({
  email: z.email("Enter a valid email").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

const sessionUser = { id: true, name: true, username: true, email: true } as const;

export const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
  const { name, username, email, password } = signupSchema.parse(req.body);
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new HttpError(409, "An account with that email already exists");
  }
  if (await prisma.user.findUnique({ where: { username } })) {
    throw new HttpError(409, "That username is taken");
  }
  const user = await prisma.user.create({
    data: { name, username, email, passwordHash: await bcrypt.hash(password, 10) },
    select: sessionUser,
  });
  startSession(res, user.id);
  res.status(201).json({ user });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, "Wrong email or password");
  }
  startSession(res, user.id);
  res.json({ user: { id: user.id, name: user.name, username: user.username, email: user.email } });
});

authRouter.post("/logout", (_req, res) => {
  endSession(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (_req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: res.locals.userId },
    select: sessionUser,
  });
  if (!user) throw new HttpError(401, "Not signed in");
  res.json({ user });
});
