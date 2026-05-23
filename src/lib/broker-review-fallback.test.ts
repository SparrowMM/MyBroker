import { describe, expect, it } from "vitest";
import { buildFallbackReviewMarkdown } from "./broker-review-fallback";
import { parseDailyRecordMarkdown } from "./daily-record-structure";

const USER_LIKE = `
## 今日进展
- ✅ 上午工作：10:20开始
  - 跟业务对焦
- ✅ AE 农场 30min
  - 松鼠换肤 30min
- ✅ 吃水煮牛肉
  - 约会见面
- 孩子哭闹，教育孩子花了2小时
- AE农场 16:10开始
  - 动效交付不符合预期重新对焦 10min
  - 松鼠换肤TC评审 17:00-17:30
`;

describe("broker-review-fallback", () => {
  it("不把饮食当孩子项目，且生活隙有内容", () => {
    const parsed = parseDailyRecordMarkdown(USER_LIKE);
    const md = buildFallbackReviewMarkdown("2026-05-23", parsed, USER_LIKE, {
      records: [{ length: 1 }],
      recordBlocks: [USER_LIKE],
      todoLines: [],
      openTodos: [],
      parsedRecords: [parsed],
    });
    expect(md).not.toContain("往前走了");
    expect(md).not.toMatch(/\*\*吃水煮牛肉\*\* —/);
    expect(md).toMatch(/生活隙|水煮牛肉|哭闹/);
    expect(md).toContain("AE");
  });
});
