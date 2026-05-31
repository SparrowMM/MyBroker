import { describe, expect, it } from "vitest";
import { buildReviewImageFilename } from "./export-review-image";

describe("buildReviewImageFilename", () => {
  it("使用日期生成文件名", () => {
    expect(buildReviewImageFilename("2026-05-21")).toBe("mybroker-复盘-2026-05-21.png");
  });
});
