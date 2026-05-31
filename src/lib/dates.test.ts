import { describe, expect, it } from "vitest";
import {
  endOfCalendarMonth,
  endOfIsoWeek,
  startOfCalendarMonth,
  startOfIsoWeek,
  utcWeekMondayKey,
} from "./dates";

describe("dates", () => {
  it("startOfIsoWeek / endOfIsoWeek 相差 6 天（UTC 日期）", () => {
    const start = startOfIsoWeek(2024, 22);
    const end = endOfIsoWeek(2024, 22);
    expect(end.getTime() - start.getTime()).toBe(6 * 86400000);
    expect(start.getUTCDay()).toBe(1);
    expect(end.getUTCDay()).toBe(0);
  });

  it("startOfCalendarMonth / endOfCalendarMonth（month 1–12）", () => {
    expect(startOfCalendarMonth(2024, 3).toISOString()).toBe("2024-03-01T00:00:00.000Z");
    expect(endOfCalendarMonth(2024, 3).toISOString()).toBe("2024-03-31T00:00:00.000Z");
  });

  it("utcWeekMondayKey 返回该 UTC 周周一的 YYYY-MM-DD", () => {
    expect(utcWeekMondayKey(new Date(Date.UTC(2024, 5, 12)))).toBe("2024-06-10");
    expect(utcWeekMondayKey(new Date(Date.UTC(2024, 5, 10)))).toBe("2024-06-10");
  });
});
