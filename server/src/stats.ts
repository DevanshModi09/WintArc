import { addDays, diffDays, weekday } from "./dates";

const XP_PER_CHECKIN = 10;
const XP_PER_PERFECT_DAY = 20;
const XP_PER_LEVEL = 200;

const LEVEL_TITLES = [
  "Snowflake",
  "Frostbitten",
  "Cold Blooded",
  "Ice Walker",
  "Storm Chaser",
  "Blizzard",
  "Avalanche",
  "Glacier",
  "Permafrost",
  "Absolute Zero",
];

// Streak milestones. Each one pays out a one-time XP bonus.
const BADGES = [
  { days: 3, name: "First Spark", xp: 30 },
  { days: 7, name: "Week Locked", xp: 70 },
  { days: 14, name: "Fortnight", xp: 140 },
  { days: 21, name: "Habit Formed", xp: 210 },
  { days: 30, name: "Iron Month", xp: 300 },
  { days: 60, name: "Unbreakable", xp: 600 },
  { days: 90, name: "Arc Complete", xp: 900 },
];

type GoalInput = {
  id: string;
  title: string;
  emoji: string | null;
  startsOn: string;
  checkIns: { date: string; note?: string | null; photo?: string | null; photoPublic?: boolean }[];
  subtasks: { id: string; title: string; doneOn: string | null }[];
};

type TrackInput = {
  id: string;
  name: string;
  isPublic: boolean;
  days: number[];
  minutes: number;
  startTime: string | null;
  reminder: number | null;
  checkpoints: { id: string; title: string; doneAt: Date | null; doneOn?: string | null }[];
  goals: GoalInput[];
};

type ArcInput = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  tracks: TrackInput[];
};

// `days` is the track's schedule and `completedOn` the day its last checkpoint
// was finished, both copied down so a goal knows when it's due.
type Goal = GoalInput & { done: Set<string>; days: number[]; completedOn: string | null };

// A goal only counts on the weekdays its track is scheduled for.
function isDue(goal: Goal, date: string) {
  if (goal.startsOn > date || !goal.days.includes(weekday(date))) return false;
  // A finished track asks nothing more, though a check-in made on the day it
  // was finished still counts.
  if (goal.completedOn && date >= goal.completedOn) return goal.done.has(date);
  return true;
}

// The day a track's last checkpoint was finished, or null while any is open.
// A track without checkpoints is never finished: it just runs every day.
function completedOn(checkpoints: TrackInput["checkpoints"]) {
  if (checkpoints.length === 0 || checkpoints.some((c) => c.doneAt === null)) return null;
  return checkpoints.map((c) => c.doneOn ?? c.doneAt!.toISOString().slice(0, 10)).sort().at(-1)!;
}

// A track can be dropped on the day it's added, and any time before the arc
// starts. After that it's locked in: the bar only ever goes up.
export function isLocked(goal: { startsOn: string }, today: string) {
  return goal.startsOn < today;
}

export type DayStatus = "perfect" | "partial" | "missed" | "empty";

// `pendingLast` means the final entry is today and still in progress, so an
// unfinished today doesn't count as a broken streak.
function streaks(done: boolean[], pendingLast: boolean) {
  let best = 0;
  let run = 0;
  for (const d of done) {
    run = d ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const settled = pendingLast && !done.at(-1) ? done.slice(0, -1) : done;
  let current = 0;
  for (let i = settled.length - 1; i >= 0 && settled[i]; i--) current++;
  return { current, best };
}

// A day is "perfect" when every goal due that day was checked in. Days with
// nothing due (rest days) are "empty" and neither extend nor break a streak.
function summarize(goals: Goal[], dates: string[], pendingLast: boolean) {
  const days = dates.map((date) => {
    const active = goals.filter((g) => isDue(g, date));
    const done = active.filter((g) => g.done.has(date)).length;
    let status: DayStatus = "missed";
    if (active.length === 0) status = "empty";
    else if (done === active.length) status = "perfect";
    else if (done > 0) status = "partial";
    return { date, status, done, total: active.length };
  });
  const due = days.filter((d) => d.status !== "empty");
  const streak = streaks(
    due.map((d) => d.status === "perfect"),
    pendingLast && due.at(-1)?.date === dates.at(-1),
  );
  return { days, streak };
}

// Totals (streak, XP, level, day grid) always cover every track. `publicOnly`
// only controls which tracks and goals are listed, for other people's profiles.
export function buildArcView(arc: ArcInput, today: string, opts: { publicOnly?: boolean } = {}) {
  const last = today < arc.endDate ? today : arc.endDate;
  const dates: string[] = [];
  for (let d = arc.startDate; d <= last; d = addDays(d, 1)) dates.push(d);
  const todayInArc = today >= arc.startDate && today <= arc.endDate;

  const tracks = arc.tracks.map((t) => ({
    ...t,
    goals: t.goals.map((g): Goal => ({
      ...g,
      days: t.days,
      completedOn: completedOn(t.checkpoints),
      done: new Set(g.checkIns.map((c) => c.date)),
    })),
  }));
  const allGoals = tracks.flatMap((t) => t.goals);
  const dueToday = allGoals.filter((g) => isDue(g, today));
  const { days, streak } = summarize(allGoals, dates, todayInArc);

  // You're a survivor until the first day you leave something undone. Today
  // doesn't count against you while it's still going.
  const fell = days.findIndex((d) => (d.status === "missed" || d.status === "partial") && !(todayInArc && d.date === today));
  const survivor = { alive: allGoals.length > 0 && fell === -1, fellOnDay: fell === -1 ? null : fell + 1 };

  const totalCheckIns = days.reduce((sum, d) => sum + d.done, 0);
  const perfectDays = days.filter((d) => d.status === "perfect").length;
  const badges = BADGES.map((b) => ({ ...b, earned: streak.best >= b.days }));
  const xp =
    totalCheckIns * XP_PER_CHECKIN +
    perfectDays * XP_PER_PERFECT_DAY +
    badges.reduce((sum, b) => sum + (b.earned ? b.xp : 0), 0);
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;

  return {
    id: arc.id,
    name: arc.name,
    startDate: arc.startDate,
    endDate: arc.endDate,
    totalDays: diffDays(arc.startDate, arc.endDate) + 1,
    dayNumber: dates.length,
    // Days until the arc begins; 0 once it has started.
    startsIn: Math.max(0, diffDays(today, arc.startDate)),
    isOver: today > arc.endDate,
    streak,
    survivor,
    perfectDays,
    totalCheckIns,
    today: {
      done: dueToday.filter((g) => g.done.has(today)).length,
      total: dueToday.length,
    },
    xp,
    level: {
      number: level,
      title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1],
      xpIntoLevel: xp % XP_PER_LEVEL,
      xpPerLevel: XP_PER_LEVEL,
    },
    badges,
    days: days.map(({ date, status, done }) => ({ date, status, done })),
    tracks: tracks
      .filter((t) => t.isPublic || !opts.publicOnly)
      .map((t) => {
        // The checkpoint being worked on: the first in line not yet finished.
        const next = t.checkpoints.findIndex((c) => c.doneAt === null);
        const complete = t.checkpoints.length > 0 && next === -1;
        const doneToday = t.goals.some((g) => g.done.has(today));
        const checkIn = t.goals.flatMap((g) => g.checkIns).find((c) => c.date === today);
        return {
          id: t.id,
          name: t.name,
          isPublic: t.isPublic,
          days: t.days,
          minutes: t.minutes,
          startTime: t.startTime,
          reminder: t.reminder,
          // False on its off days, and once every checkpoint is finished.
          dueToday: t.days.includes(weekday(today)) && (!complete || doneToday),
          // A track that has been running for a day can't be deleted.
          locked: t.goals.some((g) => isLocked(g, today)),
          checkpoints: t.checkpoints.map((c) => ({ id: c.id, title: c.title, done: c.doneAt !== null })),
          active: next === -1 ? null : { id: t.checkpoints[next].id, title: t.checkpoints[next].title, number: next + 1 },
          complete,
          doneToday,
          // Today's proof: the photo's path in storage, the line with it, and
          // whether friends get to see the photo. A photo kept private is left
          // out for everyone but its owner.
          proof:
            checkIn?.photo && (checkIn.photoPublic !== false || !opts.publicOnly)
              ? { photo: checkIn.photo, note: checkIn.note ?? null, shared: checkIn.photoPublic !== false }
              : null,
          // How many days a check-in was made.
          total: new Set(t.goals.flatMap((g) => g.checkIns.map((c) => c.date)).filter((d) => dates.includes(d))).size,
          streak: summarize(t.goals, dates, todayInArc).streak,
        };
      }),
  };
}
