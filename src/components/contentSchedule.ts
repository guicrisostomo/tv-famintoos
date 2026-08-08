export interface ContentSchedule {
  mode: "always" | "scheduled";
  startsAt: string;
  endsAt: string;
  startTime: string;
  endTime: string;
  weekdays: number[];
}

export const alwaysSchedule: ContentSchedule = { mode: "always", startsAt: "", endsAt: "", startTime: "", endTime: "", weekdays: [] };

export function scheduleDatabaseValues(schedule: ContentSchedule) {
  if (schedule.mode === "always") return { starts_at: null, ends_at: null, start_time: null, end_time: null, weekdays: [] as number[] };
  return { starts_at: schedule.startsAt ? `${schedule.startsAt}T00:00:00` : null, ends_at: schedule.endsAt ? `${schedule.endsAt}T23:59:59` : null, start_time: schedule.startTime || null, end_time: schedule.endTime || null, weekdays: schedule.weekdays };
}
