"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";

type HealthItem = { ok: boolean; model?: string; error?: string };
type SystemHealth = { llm_text?: HealthItem; llm_vision?: HealthItem };

export function HealthBanner() {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getJson<SystemHealth>("/api/v2/system/health");
      setHealth(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const allOk = !!health && !!health.llm_text?.ok && !!health.llm_vision?.ok;
  const dotClass = loading ? "statusDot loading" : allOk ? "statusDot ok" : "statusDot bad";

  return (
    <section className={`card healthBanner${open ? " open" : ""}`}>
      <button
        type="button"
        className="healthBannerHead"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="healthBannerLabel">
          <span className={dotClass} aria-hidden />
          模型状态：
          <strong>{loading ? "检测中" : allOk ? "全部正常" : "有异常"}</strong>
        </span>
        <span className="caret">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="healthBannerBody">
          <div className="healthRow">
            <div className={`healthItem ${health?.llm_text?.ok ? "ok" : "bad"}`}>
              <span className="healthLabel">文本模型</span>
              <span className="healthValue">{health?.llm_text?.ok ? "✅ OK" : "❌ Fail"}</span>
              {health?.llm_text?.model && <span className="healthModel">{health.llm_text.model}</span>}
            </div>
            <div className={`healthItem ${health?.llm_vision?.ok ? "ok" : "bad"}`}>
              <span className="healthLabel">视觉模型</span>
              <span className="healthValue">{health?.llm_vision?.ok ? "✅ OK" : "❌ Fail"}</span>
              {health?.llm_vision?.model && (
                <span className="healthModel">{health.llm_vision.model}</span>
              )}
            </div>
          </div>
          <div className="actions tightActions">
            <button
              type="button"
              className="btnSecondary"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? "检测中..." : "重新检测"}
            </button>
          </div>
          {error && <div className="error">{error}</div>}
          {(health?.llm_text?.error || health?.llm_vision?.error) && (
            <details className="healthDetails">
              <summary>查看错误摘要</summary>
              {health?.llm_text?.error && <p>文本模型：{health.llm_text.error}</p>}
              {health?.llm_vision?.error && <p>视觉模型：{health.llm_vision.error}</p>}
            </details>
          )}
        </div>
      )}
    </section>
  );
}
