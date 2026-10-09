import { addDays, weekday } from "../src/dates";
import { prisma } from "../src/db";

// A made-up person with a busy arc, to see what a full profile looks like.
// Nobody can sign in as them. Run again to rebuild; delete the user to remove.
const ID = "demo-profile-user";
const DAYS_IN = 40;
const today = new Date().toISOString().slice(0, 10);
const start = addDays(today, -(DAYS_IN - 1));
const year = Number(today.slice(0, 4));

// Repeatable "randomness", so a rebuild gives the same profile.
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];

const DSA = ["Arrays Representations", "Array ADT", "Strings", "Matrices", "Sparse Matrix and Polynomial Representation", "Linked List", "Sparse Matrix and Polynomial using Linked List", "Stack", "Queues", "Trees", "Binary Search Trees", "AVL Trees", "Search Trees", "Heap", "Sorting Techniques", "Hashing Technique", "Graphs", "Asymptotic Notations"];
const tracks = [
  { name: "DSA", isPublic: true, days: [0, 1, 2, 3, 4, 5, 6], minutes: 120, startTime: "18:00", checkpoints: DSA, done: 6, skip: 0.06,
    notes: ["solved 3 problems on two pointers", "finished the lecture, wrote notes by hand", "binary search variations, finally clicked", "revised yesterday's problems from memory", "2 mediums, 1 hard (needed the hint)", "implemented it from scratch in C++", "watched the section and coded along", "got stuck on recursion tree, drew it out"] },
  { name: "Web Dev", isPublic: true, days: [1, 2, 3, 4, 5], minutes: 90, startTime: "20:30", checkpoints: ["HTML and CSS refresh", "JavaScript deep dive", "React fundamentals", "Routing and state", "Build the dashboard", "Auth flow", "Deploy it"], done: 3, skip: 0.1,
    notes: ["built the navbar and made it responsive", "closures and the event loop, took notes", "refactored the form into smaller components", "fixed the bug where state reset on route change", "wired up the API, loading and error states", "styled the dashboard cards", "wrote the first tests for the reducer"] },
  { name: "Gym", isPublic: true, days: [1, 2, 4, 5, 6], minutes: 60, startTime: "06:30", checkpoints: [], done: 0, skip: 0.12,
    notes: ["push day, bench 60kg x 5", "legs. everything hurts", "pull day, added a set of rows", "5k run instead, knee felt off", "shoulders and core", "deadlift PR, 100kg"] },
  { name: "System Design", isPublic: true, days: [0, 6], minutes: 120, startTime: "11:00", checkpoints: ["Scaling basics", "Caching", "Databases and sharding", "Message queues", "Design a URL shortener", "Design a chat app"], done: 2, skip: 0.1,
    notes: ["read the chapter and drew the architecture", "compared write-through and write-back caching", "notes on consistent hashing", "sketched a design and compared it with the book's"] },
  { name: "Reading", isPublic: false, days: [0, 1, 2, 3, 4, 5, 6], minutes: 30, startTime: "22:30", checkpoints: ["Atomic Habits", "Deep Work", "The Pragmatic Programmer"], done: 1, skip: 0.15,
    notes: ["20 pages before bed", "one chapter, highlighted a lot", "read on the metro", "finished the section on habits stacking"] },
];

try {
  await prisma.user.deleteMany({ where: { id: ID } });
  await prisma.user.create({
    data: { id: ID, email: "demo-profile@example.test", username: "demo_profile", name: "Demo Profile", bio: "A made-up account to show what a busy arc looks like. Not a real person.", location: "Nowhere", stack: ["c++", "react", "typescript", "postgres"] },
  });
  const arc = await prisma.arc.create({ data: { userId: ID, name: "Winter Arc", startDate: start, endDate: `${year + 1}-01-01` } });

  let commits = 0;
  for (const t of tracks) {
    const track = await prisma.track.create({
      data: { arcId: arc.id, name: t.name, isPublic: t.isPublic, days: t.days, minutes: t.minutes, startTime: t.startTime, goals: { create: [{ title: "Session", startsOn: start }] } },
      include: { goals: true },
    });
    // Finished checkpoints are spread evenly over the days so far.
    const checkpoints = [];
    for (const [i, title] of t.checkpoints.entries()) {
      const doneOn = i < t.done ? addDays(start, Math.round(((i + 1) * (DAYS_IN - 3)) / (t.done + 0.5))) : null;
      checkpoints.push(await prisma.checkpoint.create({ data: { trackId: track.id, title, position: i, doneOn, doneAt: doneOn ? new Date(`${doneOn}T16:00:00Z`) : null } }));
    }
    const rows = [];
    for (let d = start; d <= today; d = addDays(d, 1)) {
      if (!t.days.includes(weekday(d))) continue;
      // One rough patch around day 17, when almost everything slipped.
      const rough = d >= addDays(start, 16) && d <= addDays(start, 17);
      if (rand() < (rough ? 0.8 : t.skip)) continue;
      const on = checkpoints.find((c) => !c.doneOn || c.doneOn >= d);
      rows.push({ goalId: track.goals[0].id, date: d, note: pick(t.notes), checkpointId: on?.id ?? null, createdAt: new Date(`${d}T${t.startTime}:00Z`) });
    }
    await prisma.checkIn.createMany({ data: rows });
    commits += rows.length;
  }
  await prisma.reflection.createMany({
    data: [3, 9, 17, 25, 38].map((n) => ({ arcId: arc.id, date: addDays(start, n), text: ["Slow start but showed up.", "Best week so far.", "Missed almost everything. Not proud.", "Back on it.", "Tired, did it anyway."][[3, 9, 17, 25, 38].indexOf(n)] })),
  });
  // Friends with the owner, so the demo's commits show in the feed too.
  const owner = await prisma.user.findUnique({ where: { username: "devansh" }, select: { id: true } });
  if (owner) await prisma.friendship.create({ data: { requesterId: ID, addresseeId: owner.id, accepted: true } });
  console.log(`demo_profile: arc from ${start}, ${tracks.length} tracks, ${commits} commits, friends with devansh: ${Boolean(owner)}`);
} finally {
  await prisma.$disconnect();
}
