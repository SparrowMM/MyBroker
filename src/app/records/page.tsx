"use client";

import { useEffect, useRef, useState } from "react";
import { getJson, postFormData, postJson } from "@/lib/api";

type HealthItem = {
  ok: boolean;
  model?: string;
  error?: string;
};

type SystemHealth = {
  llm_text?: HealthItem;
  llm_vision?: HealthItem;
};

export default function RecordsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthError, setHealthError] = useState("");
  const [isHealthLoading, setIsHealthLoading] = useState(true);
  const [rawText, setRawText] = useState("");
  const [chatText, setChatText] = useState("");
  const [screenshotNotes, setScreenshotNotes] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    async function loadHealth() {
      setIsHealthLoading(true);
      setHealthError("");
      try {
        const data = await getJson<SystemHealth>("/api/v2/system/health");
        if (active) {
          setHealth(data);
        }
      } catch (err) {
        if (active) {
          setHealthError(String(err));
        }
      } finally {
        if (active) {
          setIsHealthLoading(false);
        }
      }
    }
    loadHealth().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const saveTextRecord = async () => {
    setError("");
    setSaveMsg("");
    setIsSaving(true);
    try {
      const data = await postJson<{ ok?: boolean; record?: { id: number } }>("/api/v2/records", {
        record_date: date,
        raw_text: rawText,
        chat_text: chatText,
        screenshot_notes: screenshotNotes,
        screenshot_paths: [],
      });
      if (data.ok && data.record?.id != null) {
        setSaveMsg(`已保存并生成分析，记录 ID: ${data.record.id}。可在「日报列表」中查看。`);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!selectedFile) {
      setError("请先选择本地截图后再提交。");
      return;
    }
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const data = await postFormData<{ markdown?: string; detail?: string }>(
        `/api/v2/records/markdown-from-image?record_date=${encodeURIComponent(date)}`,
        fd,
      );
      setResult(data.markdown || "");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className="pageHeader">
        <h2>日报录入</h2>
        <p>
          可先填写文字内容由服务端入库并自动生成摘要；也可仅上传本地截图（支持拖拽），由视觉模型解析为 Markdown（默认不上传至云存储）。
        </p>
      </header>

      <section className="card healthCard">
        <div className="healthHead">
          <h3>模型健康状态</h3>
          <button
            type="button"
            className="btnSecondary"
            onClick={async () => {
              setIsHealthLoading(true);
              setHealthError("");
              try {
                const data = await getJson<SystemHealth>("/api/v2/system/health");
                setHealth(data);
              } catch (err) {
                setHealthError(String(err));
              } finally {
                setIsHealthLoading(false);
              }
            }}
            disabled={isHealthLoading}
          >
            {isHealthLoading ? "检测中..." : "重新检测"}
          </button>
        </div>
        <div className="healthRow">
          <div className={`healthItem ${health?.llm_text?.ok ? "ok" : "bad"}`}>
            <span className="healthLabel">文本模型</span>
            <span className="healthValue">{health?.llm_text?.ok ? "✅ OK" : "❌ Fail"}</span>
            {health?.llm_text?.model && <span className="healthModel">{health.llm_text.model}</span>}
          </div>
          <div className={`healthItem ${health?.llm_vision?.ok ? "ok" : "bad"}`}>
            <span className="healthLabel">视觉模型</span>
            <span className="healthValue">{health?.llm_vision?.ok ? "✅ OK" : "❌ Fail"}</span>
            {health?.llm_vision?.model && <span className="healthModel">{health.llm_vision.model}</span>}
          </div>
        </div>
        {healthError && <div className="error">{healthError}</div>}
        {(health?.llm_text?.error || health?.llm_vision?.error) && (
          <details className="healthDetails">
            <summary>查看错误摘要</summary>
            {health?.llm_text?.error && <p>文本模型：{health.llm_text.error}</p>}
            {health?.llm_vision?.error && <p>视觉模型：{health.llm_vision.error}</p>}
          </details>
        )}
      </section>

      <section className="card">
        <h3 className="sectionTitle">文字日报（入库 + AI 摘要）</h3>
        <div className="fieldRow">
          <div className="field">
            <label htmlFor="record-date">日期</label>
            <input id="record-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="raw-text">工作描述</label>
          <textarea
            id="raw-text"
            rows={4}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="今日推进、结果与阻塞等"
          />
        </div>
        <div className="field">
          <label htmlFor="chat-text">对话 / 纪要摘录</label>
          <textarea
            id="chat-text"
            rows={3}
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder="可选"
          />
        </div>
        <div className="field">
          <label htmlFor="screenshot-notes">截图说明（纯文字）</label>
          <textarea
            id="screenshot-notes"
            rows={2}
            value={screenshotNotes}
            onChange={(e) => setScreenshotNotes(e.target.value)}
            placeholder="若暂无截图，可在此补充上下文"
          />
        </div>
        <div className="actions">
          <button className="btnPrimary" type="button" onClick={() => void saveTextRecord()} disabled={isSaving}>
            {isSaving ? "保存中..." : "保存文字日报"}
          </button>
        </div>
        {saveMsg && <div className="hint successHint">{saveMsg}</div>}
      </section>

      <section className="card">
        <h3 className="sectionTitle">截图解析 Markdown</h3>
        <div className="field">
          <label htmlFor="screenshot-file">截图上传（本地）</label>
          <input
            ref={fileInputRef}
            id="screenshot-file"
            type="file"
            accept="image/*"
            className="hiddenInput"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setSelectedFile(file);
                setError("");
              }
            }}
          />
          <button
            type="button"
            className={`dropzone ${isDragOver ? "dragOver" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                setSelectedFile(file);
                setError("");
              }
            }}
          >
            <span>{isSubmitting ? "正在解析图片..." : "拖拽截图到这里，或点击选择文件"}</span>
          </button>
          <div className="hint">{selectedFile ? `已选择：${selectedFile.name}` : "支持图片文件，图片不会上传到 Supabase。"} </div>
        </div>

        <div className="actions">
          <button className="btnPrimary" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? "AI 解析中..." : "解析图片并生成 Markdown"}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card result">
        <h3>Markdown 文档</h3>
        <pre>{result || "提交后将显示 AI 生成的 Markdown 纪要"}</pre>
      </section>
    </>
  );
}
