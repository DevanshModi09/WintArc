import { weekday } from "./dates";

// Working out who should be reminded of what, and when. Nothing here talks to
// the database or the network; push.ts does the sending.

// The hour of the "you still have tracks left" nudge, in the person's own time.
const EVENING_MINUTES = 21 * 60;

export type Message = { title: string; body: string; url: string };

// Today's date and the minutes since midnight, where this person is.
export function localNow(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

type ReminderTrack = {
  name: string;
  days: number[];
  startTime: string | null;
  reminder: number | null;
  checkpoints: { doneAt: Date | null }[];
  goals: { checkIns: { date: string }[] }[];
};

// What, if anything, to tell someone at this minute of their day.
export function remindersDue(tracks: ReminderTrack[], date: string, minutes: number): Message[] {
  const pending = tracks.filter((t) => {
    const finished = t.checkpoints.length > 0 && t.checkpoints.every((c) => c.doneAt !== null);
    const committed = t.goals.some((g) => g.checkIns.some((c) => c.date === date));
    return t.days.includes(weekday(date)) && !finished && !committed;
  });

  const messages: Message[] = [];
  for (const track of pending) {
    if (!track.startTime || track.reminder === null) continue;
    const [hours, mins] = track.startTime.split(":").map(Number);
    if (hours * 60 + mins - track.reminder !== minutes) continue;
    messages.push({
      title: track.reminder === 0 ? `${track.name} starts now` : `${track.name} starts in ${track.reminder} minutes`,
      body: "Do the work, then commit it with a photo.",
      url: "/",
    });
  }
  if (minutes === EVENING_MINUTES && pending.length > 0) {
    messages.push({
      title: pending.length === 1 ? `${pending[0].name} isn't committed yet` : `${pending.length} tracks still to commit today`,
      body: `${pending.map((t) => t.name).join(", ")}. Three hours left before the day counts as missed.`,
      url: "/",
    });
  }
  return messages;
}
