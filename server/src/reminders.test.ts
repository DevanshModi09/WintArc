import assert from "node:assert/strict";
import { test } from "node:test";
import { localNow, remindersDue } from "./reminders";

// 2 November 2026 is a Monday.
const track = (name: string, startTime: string | null, reminder: number | null, committed: string[] = [], days = [1, 2, 3, 4, 5]) => ({
  name,
  days,
  startTime,
  reminder,
  checkpoints: [{ doneAt: null }],
  goals: [{ checkIns: committed.map((date) => ({ date })) }],
});

test("localNow gives the date and minute of the day in a timezone", () => {
  const at = new Date("2026-11-01T20:15:00Z");
  assert.deepEqual(localNow("Asia/Kolkata", at), { date: "2026-11-02", minutes: 105 });
  assert.deepEqual(localNow("America/New_York", at), { date: "2026-11-01", minutes: 15 * 60 + 15 });
});

test("a track reminds at its start time less its reminder, and only then", () => {
  const tracks = [track("DSA", "18:00", 10)];
  assert.deepEqual(remindersDue(tracks, "2026-11-02", 17 * 60 + 50).map((m) => m.title), ["DSA starts in 10 minutes"]);
  assert.deepEqual(remindersDue(tracks, "2026-11-02", 17 * 60 + 51), []);
  assert.equal(remindersDue([track("DSA", "18:00", 0)], "2026-11-02", 18 * 60)[0].title, "DSA starts now");
});

test("no reminder for a track that's off today, already committed, finished or has none set", () => {
  const at = 17 * 60 + 50;
  assert.deepEqual(remindersDue([track("DSA", "18:00", 10)], "2026-11-01", at), []);
  assert.deepEqual(remindersDue([track("DSA", "18:00", 10, ["2026-11-02"])], "2026-11-02", at), []);
  assert.deepEqual(remindersDue([{ ...track("DSA", "18:00", 10), checkpoints: [{ doneAt: new Date() }] }], "2026-11-02", at), []);
  assert.deepEqual(remindersDue([track("DSA", "18:00", null)], "2026-11-02", at), []);
});

test("the evening nudge names what's still to commit", () => {
  const tracks = [track("DSA", "18:00", 10), track("Web", null, null), track("Gym", null, null, ["2026-11-02"])];
  const [nudge] = remindersDue(tracks, "2026-11-02", 21 * 60);
  assert.equal(nudge.title, "2 tracks still to commit today");
  assert.match(nudge.body, /^DSA, Web\./);
  assert.deepEqual(remindersDue([track("Gym", null, null, ["2026-11-02"])], "2026-11-02", 21 * 60), []);
});
