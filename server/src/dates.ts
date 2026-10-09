import { HttpError } from "./errors";

// All dates are "YYYY-MM-DD" strings, which compare correctly with < and >.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function isDateStr(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(toUtc(value).getTime());
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

// 0 = Sunday, matching Date#getDay.
export function weekday(date: string): number {
  return toUtc(date).getUTCDay();
}

// Every winter arc ends on 1 January. One can be started from 1 October up to
// and including 10 November, and it begins the day it's created, so an arc is
// somewhere between 53 and 93 days long. This is the season `today` falls in:
// the one running or coming up this year, or on 1 January itself the one
// that's just finishing.
export function season(today: string) {
  const year = Number(today.slice(0, 4)) - (today.slice(5) === "01-01" ? 1 : 0);
  const opens = `${year}-10-01`;
  const lastStart = `${year}-11-10`;
  return { opens, lastStart, endDate: `${year + 1}-01-01`, canStart: today >= opens && today <= lastStart };
}

// The client tells us its local date. Any real timezone is within one
// calendar day of UTC, so anything further off is rejected.
export function parseToday(value: unknown): string {
  const utcToday = new Date().toISOString().slice(0, 10);
  if (!isDateStr(value) || Math.abs(diffDays(utcToday, value)) > 1) {
    throw new HttpError(400, "Invalid date");
  }
  return value;
}
