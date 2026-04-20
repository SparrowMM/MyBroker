"use client";

import { useEffect, useRef, useState } from "react";
import { getJson, postFormData } from "../../lib/api";

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
        fd
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
        <p>仅需选择日期并上传本地截图（支持拖拽），即可提交生成分析。</p>
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
        <div className="fieldRow">
          <div className="field">
            <label htmlFor="record-date">日期</label>
            <input id="record-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

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
