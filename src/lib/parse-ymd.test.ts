import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseYmd,
  utcTodayEnd,
  utcTodayMidnight,
  ymdToUtcEndOfDay,
  ymdToUtcMidnight,
} from "./parse-ymd";

describe("ymdToUtcMidnight", () => {
  it("与 parseYmd 合法输入一致", () => {
    expect(ymdToUtcMidnight("2024-03-01").toISOString()).toBe("2024-03-01T00:00:00.000Z");
  });
});

describe("utcTodayMidnight", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("按 UTC 日历日取当日零点", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-07-20T15:00:00.000Z"));
    expect(utcTodayMidnight().toISOString()).toBe("2024-07-20T00:00:00.000Z");
  });
});

describe("ymdToUtcEndOfDay / utcTodayEnd", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ymdToUtcEndOfDay", () => {
    expect(ymdToUtcEndOfDay("2024-01-10").toISOString()).toBe("2024-01-10T23:59:59.999Z");
  });

  it("utcTodayEnd", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-11-02T08:00:00.000Z"));
    expect(utcTodayEnd().toISOString()).toBe("2024-11-02T23:59:59.999Z");
  });
});

describe("parseYmd", () => {
  it("null / 空串返回 null", () => {
    expect(parseYmd(null)).toBeNull();
    expect(parseYmd("")).toBeNull();
  });

  it("格式不符返回 null", () => {
    expect(parseYmd("2024-1-05")).toBeNull();
    expect(parseYmd("24-01-05")).toBeNull();
    expect(parseYmd("2024/01/05")).toBeNull();
    expect(parseYmd("2024-01-05 extra")).toBeNull();
  });

  it("合法日期返回 UTC 当日零点", () => {
    const d = parseYmd("2024-06-15");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2024-06-15T00:00:00.000Z");
  });
});
