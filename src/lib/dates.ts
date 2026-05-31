/** 与 Python `date.fromisocalendar(year, week, 1)` 对齐的 ISO 周起始（UTC 日期） */
export function startOfIsoWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayNum + 1 + (week - 1) * 7);
  return monday;
}

export function endOfIsoWeek(year: number, week: number): Date {
  const start = startOfIsoWeek(year, week);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return end;
}

/** calendar month 1-12 */
export function startOfCalendarMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

export function endOfCalendarMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

/** 以 UTC 日期所在「周」的周一（00:00 UTC）作为桶，用于趋势聚合 */
export function utcWeekMondayKey(d: Date): string {
  const t = new Date(d);
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() - (day - 1));
  t.setUTCHours(0, 0, 0, 0);
  return t.toISOString().slice(0, 10);
}
