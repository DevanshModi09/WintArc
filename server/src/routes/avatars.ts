import { Router } from "express";
import { prisma } from "../db";
import { HttpError } from "../errors";

// Avatars are public so a plain <img> tag can load them.
export const avatarRouter = Router();

avatarRouter.get("/:id", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { avatar: true } });
  if (!user?.avatar) throw new HttpError(404, "No avatar");
  res
    .set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    })
    .send(Buffer.from(user.avatar));
});
