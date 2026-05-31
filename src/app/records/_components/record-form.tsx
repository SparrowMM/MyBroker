"use client";

import { useEffect, useRef, useState } from "react";
import type { DailyRecordDto, RecordPayload } from "./types";

type Props = {
  /** 不传则视为「新建模式」 */
  initial?: DailyRecordDto;
  /** 默认日期（仅新建模式生效） */
  defaultDate?: string;
  /** 锁定日期输入（用于工作台中聚焦于当日新增） */
  lockDate?: boolean;
  /** 是否默认展开「更多上下文」字段 */
  defaultExpanded?: boolean;
  /** 提交回调，返回 true 表示成功（用于清空表单/收起） */
  onSubmit: (payload: RecordPayload) => Promise<boolean>;
  /** 取消按钮回调；不传则不显示取消按钮 */
  onCancel?: () => void;
  submitLabel?: string;
  pendingLabel?: string;
  /** 外部注入的工作描述（来自截图解析合并） */
  externalRawText?: { value: string; mode: "append" | "replace"; nonce: number };
  /** 提交后是否自动清空（仅新建模式有用） */
  resetAfterSubmit?: boolean;
  /** 紧凑布局（用于行内编辑） */
  compact?: boolean;
};

export function RecordForm({
  initial,
  defaultDate,
  lockDate,
  defaultExpanded,
  onSubmit,
  onCancel,
  submitLabel,
  pendingLabel,
  externalRawText,
  resetAfterSubmit,
  compact,
}: Props) {
  const isEdit = !!initial;
  const initialDate = initial?.record_date ?? defaultDate ?? new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(initialDate);
  const [rawText, setRawText] = useState(initial?.raw_text ?? "");
  const [chatText, setChatText] = useState(initial?.chat_text ?? "");
  const [screenshotNotes, setScreenshotNotes] = useState(initial?.screenshot_notes ?? "");
  const [expanded, setExpanded] = useState(
    !!defaultExpanded || !!(initial?.chat_text || initial?.screenshot_notes),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const lastNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!externalRawText) return;
    if (lastNonceRef.current === externalRawText.nonce) return;
    lastNonceRef.current = externalRawText.nonce;
    if (externalRawText.mode === "append") {
      setRawText((prev) => (prev ? `${prev}\n\n${externalRawText.value}` : externalRawText.value));
    } else {
      setRawText(externalRawText.value);
    }
  }, [externalRawText]);

  const reset = () => {
    setRawText("");
    setChatText("");
    setScreenshotNotes("");
    setExpanded(!!defaultExpanded);
  };

  const handleSubmit = async () => {
    setError("");
    if (!rawText.trim() && !chatText.trim() && !screenshotNotes.trim()) {
      setError("请至少填写工作描述、对话纪要或截图说明中的一项。");
      return;
    }
    setSubmitting(true);
    try {
      const ok = await onSubmit({
        record_date: date,
        raw_text: rawText,
        chat_text: chatText,
        screenshot_notes: screenshotNotes,
      });
      if (ok && resetAfterSubmit && !isEdit) {
        reset();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`recordForm${compact ? " recordFormCompact" : ""}`}>
      {!lockDate && (
        <div className="fieldRow">
          <div className="field">
            <label htmlFor={`date-${isEdit ? initial.id : "new"}`}>日期</label>
            <input
              id={`date-${isEdit ? initial.id : "new"}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor={`raw-${isEdit ? initial.id : "new"}`}>
          工作描述
          <span className="requiredHint">（必填）</span>
        </label>
        <textarea
          id={`raw-${isEdit ? initial.id : "new"}`}
          rows={compact ? 4 : 5}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="今日推进、关键结果、阻塞点、明日计划……"
          disabled={submitting}
        />
      </div>

      {!expanded ? (
        <button type="button" className="linkBtn" onClick={() => setExpanded(true)}>
          + 添加对话纪要 / 截图说明（可选）
        </button>
      ) : (
        <>
          <div className="field">
            <label htmlFor={`chat-${isEdit ? initial.id : "new"}`}>对话 / 纪要摘录</label>
            <textarea
              id={`chat-${isEdit ? initial.id : "new"}`}
              rows={3}
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="可选"
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor={`shot-${isEdit ? initial.id : "new"}`}>截图说明（纯文字）</label>
            <textarea
              id={`shot-${isEdit ? initial.id : "new"}`}
              rows={2}
              value={screenshotNotes}
              onChange={(e) => setScreenshotNotes(e.target.value)}
              placeholder="可选：补充截图上下文"
              disabled={submitting}
            />
          </div>
          {!isEdit && (
            <button type="button" className="linkBtn" onClick={() => setExpanded(false)}>
              − 收起可选项
            </button>
          )}
        </>
      )}

      <div className="actions">
        <button
          type="button"
          className="btnPrimary"
          onClick={() => void handleSubmit()}
          disabled={submitting}
        >
          {submitting ? pendingLabel ?? "保存中..." : submitLabel ?? (isEdit ? "保存修改" : "保存日报")}
        </button>
        {onCancel && (
          <button type="button" className="btnSecondary" onClick={onCancel} disabled={submitting}>
            取消
          </button>
        )}
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
