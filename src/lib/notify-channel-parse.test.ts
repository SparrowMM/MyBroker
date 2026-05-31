import { describe, expect, it } from "vitest";
import { parseNotifyChannel } from "./notify-channel-parse";

describe("parseNotifyChannel", () => {
  it("null / 空串 / 未知返回 null", () => {
    expect(parseNotifyChannel(null)).toBeNull();
    expect(parseNotifyChannel("")).toBeNull();
    expect(parseNotifyChannel("slack")).toBeNull();
  });

  it("别名映射", () => {
    expect(parseNotifyChannel("WeCom")).toBe("wecom");
    expect(parseNotifyChannel(" wework ")).toBe("wecom");
    expect(parseNotifyChannel("LARK")).toBe("feishu");
    expect(parseNotifyChannel("feishu")).toBe("feishu");
    expect(parseNotifyChannel("ding")).toBe("dingtalk");
    expect(parseNotifyChannel("DINGTALK")).toBe("dingtalk");
  });
});
