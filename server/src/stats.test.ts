import assert from "node:assert/strict";
import { test } from "node:test";
import { buildArcView } from "./stats";

// 1 November 2026 is a Sunday.
const START = "2026-11-01";
const END = "2027-01-29";
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const goal = (id: string, done: string[], startsOn = START) => ({
  id,
  title: id,
  emoji: null,
  startsOn,
  checkIns: done.map((date) => ({ date })),
  subtasks: [] as { id: string; title: string; doneOn: string | null }[],
});

const track = (id: string, goals: ReturnType<typeof goal>[], days = EVERY_DAY, isPublic = true) => ({
  id,
  name: id,
  isPublic,
  days,
  minutes: 60,
  startTime: null,
  reminder: null,
  checkpoints: [] as { id: string; title: string; doneAt: Date | null }[],
  goals,
});

const arc = (...tracks: ReturnType<typeof track>[]) => ({ id: "arc", name: "Arc", startDate: START, endDate: END, tracks });

test("an unfinished today doesn't break the streak", () => {
  const view = buildArcView(arc(track("t", [goal("g", ["2026-11-01", "2026-11-02"])])), "2026-11-03");
  assert.deepEqual(view.streak, { current: 2, best: 2 });
  assert.deepEqual(view.today, { done: 0, total: 1 });
});

test("a missed day resets the current streak but keeps the best", () => {
  const view = buildArcView(arc(track("t", [goal("g", ["2026-11-01", "2026-11-02", "2026-11-04"])])), "2026-11-04");
  assert.deepEqual(view.streak, { current: 1, best: 2 });
  assert.deepEqual(
    view.days.map((d) => d.status),
    ["perfect", "perfect", "missed", "perfect"],
  );
});

test("a day is only perfect when every goal is done", () => {
  const view = buildArcView(arc(track("t", [goal("a", ["2026-11-01"]), goal("b", [])])), "2026-11-02");
  assert.equal(view.days[0].status, "partial");
  assert.equal(view.perfectDays, 0);
  assert.equal(view.streak.best, 0);
});

test("rest days neither extend nor break a streak", () => {
  // Monday, Wednesday, Friday.
  const mwf = arc(track("t", [goal("g", ["2026-11-02", "2026-11-04"])], [1, 3, 5]));

  const thursday = buildArcView(mwf, "2026-11-05");
  assert.deepEqual(thursday.streak, { current: 2, best: 2 });
  assert.deepEqual(thursday.today, { done: 0, total: 0 });
  assert.equal(thursday.tracks[0].dueToday, false);
  assert.equal(thursday.days.at(-1)?.status, "empty");

  // Friday is due but still in progress.
  assert.equal(buildArcView(mwf, "2026-11-06").streak.current, 2);
  // By Saturday, Friday has been missed.
  assert.deepEqual(buildArcView(mwf, "2026-11-07").streak, { current: 0, best: 2 });
});

test("a goal doesn't count before the day it was added", () => {
  const view = buildArcView(arc(track("t", [goal("old", ["2026-11-01", "2026-11-02"]), goal("new", ["2026-11-02"], "2026-11-02")])), "2026-11-02");
  assert.deepEqual(
    view.days.map((d) => d.status),
    ["perfect", "perfect"],
  );
  assert.equal(view.tracks[0].goals[1].total, 1);
});

test("XP adds up check-ins, perfect days and streak badges", () => {
  const done = ["2026-11-01", "2026-11-02", "2026-11-03"];
  const view = buildArcView(arc(track("t", [goal("g", done)])), "2026-11-03");
  // 3 check-ins, 3 perfect days and the 3-day badge.
  assert.equal(view.xp, 3 * 10 + 3 * 20 + 30);
  assert.equal(view.badges.filter((b) => b.earned).length, 1);
  assert.equal(view.level.number, 1);
});

test("private tracks are hidden from others but still count", () => {
  const mixed = arc(track("public", [goal("a", ["2026-11-01"])]), track("private", [goal("b", [])], EVERY_DAY, false));
  const view = buildArcView(mixed, "2026-11-02", { publicOnly: true });
  assert.deepEqual(
    view.tracks.map((t) => t.name),
    ["public"],
  );
  assert.equal(view.days[0].status, "partial");
});

test("before the start and after the end", () => {
  const empty = arc(track("t", [goal("g", [])]));
  const early = buildArcView(empty, "2026-10-08");
  assert.equal(early.startsIn, 24);
  assert.equal(early.dayNumber, 0);
  assert.equal(early.isOver, false);

  const late = buildArcView(empty, "2027-02-10");
  assert.equal(late.isOver, true);
  assert.equal(late.dayNumber, 90);
  assert.equal(late.totalDays, 90);
});

test("subtasks only count as done on the day they were ticked", () => {
  const g = goal("g", []);
  g.subtasks = [
    { id: "a", title: "a", doneOn: "2026-11-02" },
    { id: "b", title: "b", doneOn: "2026-11-01" },
    { id: "c", title: "c", doneOn: null },
  ];
  const view = buildArcView(arc(track("t", [g])), "2026-11-02");
  assert.deepEqual(
    view.tracks[0].goals[0].subtasks.map((s) => s.done),
    [true, false, false],
  );
});

test("checkpoints report whether they've been ticked", () => {
  const t = track("t", [goal("g", [])]);
  t.checkpoints = [
    { id: "a", title: "a", doneAt: new Date() },
    { id: "b", title: "b", doneAt: null },
  ];
  const view = buildArcView(arc(t), "2026-11-02");
  assert.deepEqual(
    view.tracks[0].checkpoints.map((c) => c.done),
    [true, false],
  );
});
