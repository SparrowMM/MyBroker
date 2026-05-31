"use client";

import { useRef, useState } from "react";
import { postFormData } from "@/lib/api";

type Props = {
  /** 当前选中日期，用作 record_date 参数 */
  date: string;
  /** 解析得到 markdown 后回调；父级决定是合并到正文还是新建 */
  onMarkdown: (markdown: string) => void;
};

export function ScreenshotHelper({ date, onMarkdown }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setFile(null);
    setResult("");
    setError("");
  };

  const submit = async () => {
    setError("");
    if (!file) {
      setError("请先选择本地截图。");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await postFormData<{ markdown?: string }>(
        `/api/v2/records/markdown-from-image?record_date=${encodeURIComponent(date)}`,
        fd,
      );
      setResult(data.markdown ?? "");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card screenshotHelper">
      <button
        type="button"
        className="screenshotHelperHead"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          <strong>截图助手</strong>
          <span className="hint" style={{ marginLeft: 8 }}>
            上传本地截图 → 由视觉模型转 Markdown，可一键合入今日工作描述
          </span>
        </span>
        <span className="caret">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="screenshotHelperBody">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hiddenInput"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setError("");
              }
            }}
          />
          <button
            type="button"
            className={`dropzone${drag ? " dragOver" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDrag(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) {
                setFile(f);
                setError("");
              }
            }}
          >
            {busy ? "正在解析..." : file ? `已选择：${file.name}` : "拖拽截图到这里，或点击选择"}
          </button>

          <div className="actions">
            <button type="button" className="btnPrimary" onClick={() => void submit()} disabled={busy}>
              {busy ? "AI 解析中..." : "解析为 Markdown"}
            </button>
            {(file || result) && (
              <button type="button" className="btnSecondary" onClick={reset} disabled={busy}>
                清空
              </button>
            )}
          </div>

          {error && <div className="error">{error}</div>}

          {result && (
            <div className="screenshotResult">
              <div className="screenshotResultHead">
                <span className="mutedLabel">解析结果（{result.length} 字）</span>
                <div className="actions tightActions">
                  <button
                    type="button"
                    className="btnPrimary"
                    onClick={() => {
                      onMarkdown(result);
                    }}
                  >
                    合入工作描述
                  </button>
                  <button
                    type="button"
                    className="btnSecondary"
                    onClick={() => void navigator.clipboard.writeText(result)}
                  >
                    复制
                  </button>
                </div>
              </div>
              <pre>{result}</pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
