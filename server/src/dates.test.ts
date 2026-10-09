import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, diffDays, isDateStr, parseToday, seasonStart, weekday } from "./dates";

test("addDays crosses months and years", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-03-01", -1), "2028-02-29");
});

test("diffDays", () => {
  assert.equal(diffDays("2026-11-01", "2027-01-29"), 89);
  assert.equal(diffDays("2026-11-02", "2026-11-01"), -1);
});

test("weekday counts from Sunday", () => {
  assert.equal(weekday("2026-11-01"), 0);
  assert.equal(weekday("2026-11-06"), 5);
});

test("isDateStr rejects things that aren't dates", () => {
  assert.equal(isDateStr("2026-11-01"), true);
  assert.equal(isDateStr("2026-13-01"), false);
  assert.equal(isDateStr("01/11/2026"), false);
  assert.equal(isDateStr(20261101), false);
});

test("seasonStart picks the running arc, or else the next one", () => {
  assert.equal(seasonStart("2026-10-08"), "2026-11-01");
  assert.equal(seasonStart("2026-11-01"), "2026-11-01");
  assert.equal(seasonStart("2027-01-29"), "2026-11-01");
  assert.equal(seasonStart("2027-01-30"), "2027-11-01");
});

test("parseToday only accepts dates within a day of now", () => {
  const now = new Date().toISOString().slice(0, 10);
  assert.equal(parseToday(now), now);
  assert.equal(parseToday(addDays(now, 1)), addDays(now, 1));
  assert.throws(() => parseToday(addDays(now, 2)));
  assert.throws(() => parseToday(undefined));
});
