import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./db";

const withProgress = {
  tracks: {
    orderBy: { createdAt: "asc" },
    include: {
      checkpoints: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, doneAt: true, doneOn: true } },
      goals: {
        orderBy: { createdAt: "asc" },
        include: {
          checkIns: { select: { date: true, note: true, photo: true, photoPublic: true } },
          subtasks: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, doneOn: true } },
        },
      },
    },
  },
} satisfies Prisma.ArcInclude;

// Every arc someone has run, newest first.
export async function allArcs(userId: string) {
  return prisma.arc.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: withProgress });
}

// A user's current arc is simply their most recent one.
export async function currentArc(userId: string) {
  return prisma.arc.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: withProgress });
}

// The arc each person is running in the season that ends on `endDate`, keyed
// by user id.
export async function seasonArcs(endDate: string) {
  const arcs = await prisma.arc.findMany({ where: { endDate }, orderBy: { createdAt: "desc" }, include: withProgress });
  const latest = new Map<string, (typeof arcs)[number]>();
  for (const arc of arcs) if (!latest.has(arc.userId)) latest.set(arc.userId, arc);
  return latest;
}

// The current arc of each of these users, keyed by user id.
export async function currentArcs(userIds: string[]) {
  // Newest first, so the first arc seen for a user is their current one.
  const all = await prisma.arc.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true },
  });
  const latest = new Map<string, string>();
  for (const arc of all) if (!latest.has(arc.userId)) latest.set(arc.userId, arc.id);

  const arcs = await prisma.arc.findMany({ where: { id: { in: [...latest.values()] } }, include: withProgress });
  return new Map(arcs.map((arc) => [arc.userId, arc]));
}
