import { prisma } from "./db";

// A user's current arc is simply their most recent one.
export async function currentArc(userId: string) {
  return prisma.arc.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      tracks: {
        orderBy: { createdAt: "asc" },
        include: {
          goals: {
            orderBy: { createdAt: "asc" },
            include: { checkIns: { select: { date: true } } },
          },
        },
      },
    },
  });
}
