import { Router } from "express";
import { currentArc } from "../arcs";
import { parseToday } from "../dates";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { buildArcView } from "../stats";
import { publicUserSelect, toPublicUser } from "../users";

// The one part of the API that needs no sign-in: the commitment page someone
// has chosen to share. It only ever shows their public tracks.
export const publicRouter = Router();

publicRouter.get("/:username", async (req, res) => {
  const today = parseToday(req.query.today);
  const user = await prisma.user.findFirst({
    where: { username: req.params.username.toLowerCase(), sharePublic: true },
    select: { ...publicUserSelect, bio: true },
  });
  // The same answer whether they don't exist or haven't shared, so this
  // can't be used to check who has an account.
  if (!user) throw new HttpError(404, "This page doesn't exist, or isn't public");
  const arc = await currentArc(user.id);
  res.json({ user: toPublicUser(user), arc: arc ? buildArcView(arc, today, { publicOnly: true }) : null });
});
