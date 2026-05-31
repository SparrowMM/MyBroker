import { describe, expect, it } from "vitest";
import { decodeJsonList } from "./record-analyzer";

describe("decodeJsonList", () => {
  it("合法 JSON 数组转为 string[]", () => {
    expect(decodeJsonList('["a",1,true]')).toEqual(["a", "1", "true"]);
  });

  it("非数组 JSON 返回空数组", () => {
    expect(decodeJsonList("{}")).toEqual([]);
    expect(decodeJsonList('"x"')).toEqual([]);
    expect(decodeJsonList("null")).toEqual([]);
  });

  it("解析失败返回空数组", () => {
    expect(decodeJsonList("")).toEqual([]);
    expect(decodeJsonList("not json")).toEqual([]);
    expect(decodeJsonList("[1,2")).toEqual([]);
  });
});
