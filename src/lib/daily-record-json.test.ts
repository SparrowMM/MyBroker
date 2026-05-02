import type { DailyRecord } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { dailyRecordToJson } from "./daily-record-json";

describe("dailyRecordToJson", () => {
  const row: DailyRecord = {
    id: 100,
    recordDate: new Date("2024-08-01T00:00:00.000Z"),
    rawText: "正文",
    chatText: "会话",
    screenshotPathsJson: '["https://x/a.png","b.png"]',
    screenshotNotes: "截图说明",
    analysisSummary: "摘要",
    tagsJson: '["标签A","标签B"]',
    createdAt: new Date("2024-08-02T10:00:00.000Z"),
    updatedAt: new Date("2024-08-02T11:00:00.000Z"),
  };

  it("字段映射与 JSON 列表解码", () => {
    expect(dailyRecordToJson(row)).toEqual({
      id: 100,
      record_date: "2024-08-01",
      raw_text: "正文",
      chat_text: "会话",
      screenshot_paths: ["https://x/a.png", "b.png"],
      screenshot_notes: "截图说明",
      analysis_summary: "摘要",
      tags: ["标签A", "标签B"],
      created_at: "2024-08-02T10:00:00.000Z",
      updated_at: "2024-08-02T11:00:00.000Z",
    });
  });

  it("非法 JSON 列表退化为空数组", () => {
    expect(
      dailyRecordToJson({
        ...row,
        screenshotPathsJson: "not-json",
        tagsJson: "",
      }).screenshot_paths,
    ).toEqual([]);
    expect(
      dailyRecordToJson({
        ...row,
        screenshotPathsJson: "[]",
        tagsJson: "",
      }).tags,
    ).toEqual([]);
  });
});
