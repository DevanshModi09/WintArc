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

// The client tells us its local date. Any real timezone is within one
// calendar day of UTC, so anything further off is rejected.
export function parseToday(value: unknown): string {
  const utcToday = new Date().toISOString().slice(0, 10);
  if (!isDateStr(value) || Math.abs(diffDays(utcToday, value)) > 1) {
    throw new HttpError(400, "Invalid date");
  }
  return value;
}
