/** 已知为 `YYYY-MM-DD` 的字符串时得到 UTC 当日零点（不做格式校验，仅供内部已校验路径）。 */
export function ymdToUtcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** 解析查询参数中的日历日 `YYYY-MM-DD`，返回 UTC 当日 00:00 的 Date；非法则 null */
export function parseYmd(s: string | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = ymdToUtcMidnight(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 当前时刻对应的 UTC 日历日 00:00（用于「今日」边界）。 */
export function utcTodayMidnight(): Date {
  const ymd = new Date().toISOString().slice(0, 10);
  return ymdToUtcMidnight(ymd);
}

/** UTC 当日最后一刻（23:59:59.999），用于区间上界 */
export function ymdToUtcEndOfDay(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999Z`);
}

/** 当前 UTC 日历日的结束时刻 */
export function utcTodayEnd(): Date {
  const ymd = new Date().toISOString().slice(0, 10);
  return ymdToUtcEndOfDay(ymd);
}
