"use client";

import { useState } from "react";
import { deleteJson, patchJson, postJson } from "@/lib/api";
import { RecordForm } from "./record-form";
import type { DailyRecordDto, RecordPayload } from "./types";

type Props = {
  record: DailyRecordDto;
  onChange: (record: DailyRecordDto) => void;
  onDelete: (id: number) => void;
  /** 是否默认展开「原始内容」 */
  defaultExpand?: boolean;
};

export function RecordCard({ record, onChange, onDelete, defaultExpand }: Props) {
  const [editing, setEditing] = useState(false);
  const [showRaw, setShowRaw] = useState(!!defaultExpand);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");

  const handlePatch = async (payload: RecordPayload): Promise<boolean> => {
    setError("");
    try {
      const data = await patchJson<{ ok?: boolean; record?: DailyRecordDto; message?: string }>(
        `/api/v2/records/${record.id}`,
        payload,
      );
      if (data.ok && data.record) {
        onChange(data.record);
        setEditing(false);
        return true;
      }
      setError(data.message || "保存失败");
      return false;
    } catch (err) {
      setError(String(err));
      return false;
    }
  };

  const handleReanalyze = async () => {
    setBusy("reanalyze");
    setError("");
    try {
      const data = await postJson<{ ok?: boolean; record?: DailyRecordDto; message?: string }>(
        `/api/v2/records/${record.id}/reanalyze`,
        {},
      );
      if (data.ok && data.record) {
        onChange(data.record);
      } else {
        setError(data.message || "重新分析失败");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy("");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确认删除 ${record.record_date} 的日报（#${record.id}）？此操作不可恢复。`)) {
      return;
    }
    setBusy("delete");
    setError("");
    try {
      await deleteJson(`/api/v2/records/${record.id}`);
      onDelete(record.id);
    } catch (err) {
      setError(String(err));
      setBusy("");
    }
  };

  return (
    <article className="recordCard">
      <header className="recordCardHead">
        <div className="recordCardTitle">
          <strong>{record.record_date}</strong>
          <span className="badge">#{record.id}</span>
        </div>
        <div className="recordCardActions">
          {!editing && (
            <>
              <button
                type="button"
                className="iconBtn"
                onClick={() => setEditing(true)}
                disabled={!!busy}
              >
                编辑
              </button>
              <button
                type="button"
                className="iconBtn"
                onClick={() => void handleReanalyze()}
                disabled={!!busy}
              >
                {busy === "reanalyze" ? "分析中..." : "重新分析"}
              </button>
              <button
                type="button"
                className="iconBtn iconBtnDanger"
                onClick={() => void handleDelete()}
                disabled={!!busy}
              >
                {busy === "delete" ? "删除中..." : "删除"}
              </button>
            </>
          )}
        </div>
      </header>

      {editing ? (
        <RecordForm
          initial={record}
          onSubmit={handlePatch}
          onCancel={() => setEditing(false)}
          submitLabel="保存修改"
          compact
        />
      ) : (
        <>
          <p className="recordSummary">{record.analysis_summary || "（暂无 AI 摘要）"}</p>
          <div className="tagRow">
            {record.tags.length > 0 ? (
              record.tags.map((tag) => (
                <span key={`${record.id}-${tag}`} className="tag">
                  {tag}
                </span>
              ))
            ) : (
              <span className="hint">无标签</span>
            )}
          </div>

          <button
            type="button"
            className="linkBtn recordRawToggle"
            onClick={() => setShowRaw((v) => !v)}
          >
            {showRaw ? "− 收起原始内容" : "+ 查看原始内容"}
          </button>
          {showRaw && (
            <div className="recordRaw">
              <RawSection label="工作描述" value={record.raw_text} />
              <RawSection label="对话纪要" value={record.chat_text} />
              <RawSection label="截图说明" value={record.screenshot_notes} />
              <div className="recordMeta">
                创建于 {formatTs(record.created_at)} · 更新于 {formatTs(record.updated_at)}
              </div>
            </div>
          )}
        </>
      )}

      {error && <div className="error">{error}</div>}
    </article>
  );
}

function RawSection({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="recordRawSection">
      <div className="recordRawLabel">{label}</div>
      <pre className="recordRawText">{value}</pre>
    </div>
  );
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
