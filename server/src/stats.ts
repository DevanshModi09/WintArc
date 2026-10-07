import { addDays, diffDays } from "./dates";

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
  checkIns: { date: string }[];
};

type ArcInput = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  tracks: { id: string; name: string; isPublic: boolean; goals: GoalInput[] }[];
};

type Goal = GoalInput & { done: Set<string> };

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

// A day is "perfect" when every goal that existed that day was checked in.
function summarize(goals: Goal[], dates: string[], pendingLast: boolean) {
  const days = dates.map((date) => {
    const active = goals.filter((g) => g.startsOn <= date);
    const done = active.filter((g) => g.done.has(date)).length;
    let status: DayStatus = "missed";
    if (active.length === 0) status = "empty";
    else if (done === active.length) status = "perfect";
    else if (done > 0) status = "partial";
    return { date, status, done, total: active.length };
  });
  const streak = streaks(
    days.map((d) => d.status === "perfect"),
    pendingLast,
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
    goals: t.goals.map((g): Goal => ({ ...g, done: new Set(g.checkIns.map((c) => c.date)) })),
  }));
  const allGoals = tracks.flatMap((t) => t.goals);
  const { days, streak } = summarize(allGoals, dates, todayInArc);

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
    isOver: today > arc.endDate,
    streak,
    perfectDays,
    totalCheckIns,
    today: {
      done: allGoals.filter((g) => g.done.has(today)).length,
      total: allGoals.length,
    },
    xp,
    level: {
      number: level,
      title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1],
      xpIntoLevel: xp % XP_PER_LEVEL,
      xpPerLevel: XP_PER_LEVEL,
    },
    badges,
    days: days.map(({ date, status }) => ({ date, status })),
    tracks: tracks
      .filter((t) => t.isPublic || !opts.publicOnly)
      .map((t) => ({
        id: t.id,
        name: t.name,
        isPublic: t.isPublic,
        streak: summarize(t.goals, dates, todayInArc).streak,
        goals: t.goals.map((g) => {
          const goalDates = dates.filter((d) => d >= g.startsOn);
          return {
            id: g.id,
            title: g.title,
            emoji: g.emoji,
            doneToday: g.done.has(today),
            total: goalDates.filter((d) => g.done.has(d)).length,
            streak: streaks(
              goalDates.map((d) => g.done.has(d)),
              todayInArc,
            ),
          };
        }),
      })),
  };
}
