import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, diffDays, isDateStr, parseToday, season, weekday } from "./dates";

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

test("an arc can be started from 1 October to 10 November and ends on 1 January", () => {
  assert.deepEqual(season("2026-10-09"), { opens: "2026-10-01", lastStart: "2026-11-10", endDate: "2027-01-01", canStart: true });
  assert.equal(season("2026-10-01").canStart, true);
  assert.equal(season("2026-11-10").canStart, true);
  assert.equal(season("2026-09-30").canStart, false);
  assert.equal(season("2026-11-11").canStart, false);
});

test("1 January still belongs to the season that's finishing", () => {
  assert.equal(season("2027-01-01").endDate, "2027-01-01");
  assert.equal(season("2027-01-01").canStart, false);
  assert.deepEqual(season("2027-01-02"), { opens: "2027-10-01", lastStart: "2027-11-10", endDate: "2028-01-01", canStart: false });
});

test("parseToday only accepts dates within a day of now", () => {
  const now = new Date().toISOString().slice(0, 10);
  assert.equal(parseToday(now), now);
  assert.equal(parseToday(addDays(now, 1)), addDays(now, 1));
  assert.throws(() => parseToday(addDays(now, 2)));
  assert.throws(() => parseToday(undefined));
});
