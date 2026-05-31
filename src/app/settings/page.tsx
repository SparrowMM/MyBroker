"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, postJson } from "@/lib/api";
import { HealthBanner } from "@/app/records/_components/health-banner";

type Preview = {
  channel: string;
  title: string;
  markdown: string;
};

export default function SettingsPage() {
  const [syncMsg, setSyncMsg] = useState("");
  const [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pushError, setPushError] = useState("");

  const syncTodos = async () => {
    setSyncMsg("");
    setSyncError("");
    setSyncing(true);
    try {
      const data = await postJson<{
        scanned_records?: number;
        inserted?: number;
        skipped_duplicate?: number;
      }>("/api/v2/action-items/sync?days=14", {});
      setSyncMsg(
        `已从近 14 天记录同步：扫描 ${data.scanned_records ?? 0} 篇，新增 ${data.inserted ?? 0} 条待办。`,
      );
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  const loadPushPreview = useCallback(async () => {
    setPushError("");
    try {
      const data = await getJson<Preview>("/api/v2/notifications/preview/daily?channel=wecom");
      setPreview(data);
    } catch (e) {
      setPushError(String(e));
      setPreview(null);
    }
  }, []);

  useEffect(() => {
    if (pushOpen) {
      loadPushPreview().catch(() => undefined);
    }
  }, [pushOpen, loadPushPreview]);

  return (
    <>
      <header className="pageHeader">
        <h2>设置</h2>
        <p>个人使用以网站为主；以下为模型状态、待办同步与可选的企业 IM 推送。</p>
      </header>

      <HealthBanner />

      <section className="card">
        <h3 className="sectionTitle">待办同步</h3>
        <p className="hint">从最近 14 天的记录里抽取行动项写入待办列表（内容完全相同会跳过）。</p>
        <div className="actions">
          <button type="button" className="btnPrimary" onClick={() => void syncTodos()} disabled={syncing}>
            {syncing ? "同步中…" : "同步待办"}
          </button>
        </div>
        {syncMsg && <div className="hint successHint">{syncMsg}</div>}
        {syncError && <div className="error">{syncError}</div>}
      </section>

      <section className="card">
        <button
          type="button"
          className="screenshotHelperHead"
          onClick={() => setPushOpen((v) => !v)}
          aria-expanded={pushOpen}
        >
          <span>
            <strong>企业 IM 推送（可选）</strong>
            <span className="hint" style={{ marginLeft: 8 }}>
              配置 Webhook 后，可把简报发到企业微信/飞书/钉钉；不配置则仅用网站即可。
            </span>
          </span>
          <span className="caret">{pushOpen ? "▾" : "▸"}</span>
        </button>
        {pushOpen && (
          <div className="screenshotHelperBody">
            <p className="hint">
              完整配置见 README（<code className="inlineCode">WEBHOOK_*</code>、
              <code className="inlineCode">CRON_SECRET</code>）。日常只需打开「今天」「历史」页面。
            </p>
            <div className="actions">
              <button type="button" className="btnSecondary" onClick={() => void loadPushPreview()}>
                刷新预览
              </button>
              <a className="btnSecondary" href="/notifications">
                打开推送管理页
              </a>
            </div>
            {pushError && <div className="error">{pushError}</div>}
            {preview && <pre className="reviewMarkdown">{preview.markdown}</pre>}
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="sectionTitle">更多工具</h3>
        <ul className="bulletList">
          <li>
            <a href="/api/v2/system/health" target="_blank" rel="noreferrer" className="inlineLink">
              API 健康检查
            </a>
          </li>
          <li>
            <a href="/api/v2/llm/logs?limit=20" target="_blank" rel="noreferrer" className="inlineLink">
              LLM 调用日志
            </a>
          </li>
        </ul>
      </section>
    </>
  );
}
