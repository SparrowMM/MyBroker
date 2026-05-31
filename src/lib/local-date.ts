/** 本地日历日 YYYY-MM-DD（与 date input 一致） */
export function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysAgoLocalYmd(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 含首尾共 `spanDays` 个自然日：从 (今天 - (spanDays-1)) 到 今天 */
export function rangeLastNDaysLocal(spanDays: number): { start: string; end: string } {
  const n = Math.max(1, spanDays);
  return {
    start: daysAgoLocalYmd(n - 1),
    end: todayLocalYmd(),
  };
}

/** 本地时区下是否为周六或周日（用于 Cron 是否跳过周末） */
export function isWeekendLocal(): boolean {
  const d = new Date().getDay();
  return d === 0 || d === 6;
}
