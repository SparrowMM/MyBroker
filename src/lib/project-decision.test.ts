import { describe, expect, it } from "vitest";
import { evaluateHeuristic } from "./project-decision";

describe("evaluateHeuristic", () => {
  it("空描述分数低且不新建", () => {
    const r = evaluateHeuristic("", []);
    expect(r.shouldCreate).toBe(false);
    expect(r.score).toBe(0);
    expect(r.suggestedName).toBe("新项目");
  });

  it("含目标/周期/拆解等信号时倾向新建", () => {
    const r = evaluateHeuristic(
      "本季度上线 MVP，拆解里程碑与模块，本周交付第一版",
      [],
    );
    expect(r.shouldCreate).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0.55);
    expect(r.reason).toContain("项目化");
  });

  it("与已有项目名重叠时降低分数", () => {
    const withoutOverlap = evaluateHeuristic("全新 CRM 系统上线与里程碑排期", []);
    const withOverlap = evaluateHeuristic("全新 CRM 系统上线与里程碑排期", ["CRM"]);
    expect(withOverlap.score).toBeLessThan(withoutOverlap.score);
  });

  it("suggestedName 截断并加后缀", () => {
    const long =
      "一二三四五六七八九十一二三四五六七八九十尾巴";
    const r = evaluateHeuristic(long, []);
    expect(r.suggestedName.endsWith("项目")).toBe(true);
    expect(r.suggestedName.length).toBeLessThanOrEqual(2 + 14);
  });
});
