"use client";

import { useEffect, useState } from "react";
import { getJson } from "../../lib/api";

type HealthItem = {
  ok: boolean;
  model?: string;
  error?: string;
};

type SystemHealth = {
  llm_text?: HealthItem;
  llm_vision?: HealthItem;
};

export default function HealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthError, setHealthError] = useState("");
  const [isHealthLoading, setIsHealthLoading] = useState(true);

  const loadHealth = async () => {
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
  };

  useEffect(() => {
    loadHealth().catch(() => undefined);
  }, []);

  return (
    <>
      <header className="pageHeader">
        <h2>模型健康检查</h2>
        <p>独立检测文本与视觉模型连通性，便于在录入前排查模型配置和权限问题。</p>
      </header>

      <section className="card healthCard">
        <div className="healthHead">
          <h3>当前模型状态</h3>
          <button
            type="button"
            className="btnSecondary"
            onClick={() => {
              loadHealth().catch(() => undefined);
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
    </>
  );
}
