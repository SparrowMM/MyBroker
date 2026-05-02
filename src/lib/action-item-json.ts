import type { ActionItem } from "@prisma/client";

export function actionItemToJson(r: ActionItem) {
  return {
    id: r.id,
    source_record_id: r.sourceRecordId,
    source_date: r.sourceDate.toISOString().slice(0, 10),
    content: r.content,
    priority: r.priority,
    status: r.status,
    due_date: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
    notes: r.notes,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}
