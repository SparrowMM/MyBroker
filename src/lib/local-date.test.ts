import { afterEach, describe, expect, it, vi } from "vitest";
import {
  daysAgoLocalYmd,
  isWeekendLocal,
  rangeLastNDaysLocal,
  todayLocalYmd,
} from "./local-date";

describe("local-date", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("todayLocalYmd 为本地日历 YYYY-MM-DD", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 8, 14, 30, 0));
    expect(todayLocalYmd()).toBe("2024-06-08");
  });

  it("daysAgoLocalYmd 向前推算自然日", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 8, 9, 0, 0));
    expect(daysAgoLocalYmd(0)).toBe("2024-06-08");
    expect(daysAgoLocalYmd(7)).toBe("2024-06-01");
  });

  it("rangeLastNDaysLocal 含首尾共 N 天且 span 至少为 1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 2, 10, 12, 0, 0));
    expect(rangeLastNDaysLocal(3)).toEqual({
      start: "2024-03-08",
      end: "2024-03-10",
    });
    expect(rangeLastNDaysLocal(0)).toEqual({
      start: "2024-03-10",
      end: "2024-03-10",
    });
  });
});

describe("isWeekendLocal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("周六、周日为 true", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0));
    expect(isWeekendLocal()).toBe(true);
    vi.setSystemTime(new Date(2024, 5, 16, 12, 0, 0));
    expect(isWeekendLocal()).toBe(true);
  });

  it("工作日为 false", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 11, 12, 0, 0));
    expect(isWeekendLocal()).toBe(false);
  });
});
