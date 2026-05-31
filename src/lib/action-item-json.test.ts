import type { ActionItem } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { actionItemToJson } from "./action-item-json";

describe("actionItemToJson", () => {
  const row: ActionItem = {
    id: 42,
    sourceRecordId: 7,
    sourceDate: new Date("2024-05-10T00:00:00.000Z"),
    content: "跟进合同",
    priority: "high",
    status: "todo",
    dueDate: new Date("2024-05-20T00:00:00.000Z"),
    notes: "备注",
    createdAt: new Date("2024-05-12T08:00:00.000Z"),
    updatedAt: new Date("2024-05-12T09:00:00.000Z"),
  };

  it("字段映射与 snake_case JSON 形状", () => {
    expect(actionItemToJson(row)).toEqual({
      id: 42,
      source_record_id: 7,
      source_date: "2024-05-10",
      content: "跟进合同",
      priority: "high",
      status: "todo",
      due_date: "2024-05-20",
      notes: "备注",
      created_at: "2024-05-12T08:00:00.000Z",
      updated_at: "2024-05-12T09:00:00.000Z",
    });
  });

  it("due_date 为空时为 null", () => {
    expect(actionItemToJson({ ...row, dueDate: null }).due_date).toBeNull();
  });
});
