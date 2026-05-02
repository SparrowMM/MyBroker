import { describe, expect, it } from "vitest";
import { buildCsv, escapeCsvCell } from "./csv";

describe("escapeCsvCell", () => {
  it("普通文本原样返回", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
  });

  it("含逗号或换行或双引号时用引号包裹并转义引号", () => {
    expect(escapeCsvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(escapeCsvCell("a\nb")).toBe('"a\nb"');
  });

  it("统一 \\r\\n / \\r 为 \\n", () => {
    expect(escapeCsvCell("x\r\ny")).toBe('"x\ny"');
    expect(escapeCsvCell("x\ry")).toBe('"x\ny"');
  });
});

describe("buildCsv", () => {
  it("拼接表头与行", () => {
    expect(
      buildCsv(
        ["a", "b"],
        [
          ["1", "2"],
          ["3", "4"],
        ],
      ),
    ).toBe("a,b\n1,2\n3,4");
  });
});
