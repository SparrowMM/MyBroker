"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, postJson } from "@/lib/api";

type Preview = {
  channel: string;
  title: string;
  markdown: string;
  plain_text: string;
};

type LogRow = {
  id: number;
  channel: string;
  title: string;
  success: boolean;
  attempts: number;
  created_at: string;
  response_message: string;
};

const CHANNELS = [
  { id: "wecom", label: "企业微信" },
  { id: "feishu", label: "飞书" },
  { id: "dingtalk", label: "钉钉" },
] as const;

export default function NotificationsPage() {
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["id"]>("wecom");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const loadPreview = useCallback(async () => {
    setError("");
    setLoadingPreview(true);
    try {
      const data = await getJson<Preview>(`/api/v2/notifications/preview/daily?channel=${channel}`);
      setPreview(data);
    } catch (e) {
      setError(String(e));
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [channel]);

  const loadLogs = useCallback(async () => {
    try {
      const data = await getJson<LogRow[]>("/api/v2/notifications/logs?limit=20");
      setLogs(data);
    } catch {
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    loadPreview().catch(() => undefined);
  }, [loadPreview]);

  useEffect(() => {
    loadLogs().catch(() => undefined);
  }, [loadLogs]);

  const send = async () => {
    setMsg("");
    setError("");
    setSending(true);
    try {
      const data = await postJson<{ ok?: boolean; message?: string; attempts?: number }>(
        `/api/v2/notifications/send/daily?channel=${channel}`,
        {},
      );
      setMsg(`发送成功（尝试 ${data.attempts ?? 1} 次）。`);
      await loadLogs();
    } catch (e) {
      setError(String(e));
      await loadLogs();
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <header className="pageHeader">
        <h2>每日推送</h2>
        <p>预览即将发往机器人的 Markdown，确认无误后可手动推送（需在环境变量中配置对应 Webhook）。</p>
      </header>

      <section className="card">
        <div className="fieldRow">
          <div className="field">
            <label htmlFor="notify-channel">渠道</label>
            <select
              id="notify-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number]["id"])}
            >
              {CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btnSecondary" onClick={() => loadPreview()} disabled={loadingPreview}>
            {loadingPreview ? "刷新预览…" : "刷新预览"}
          </button>
          <button type="button" className="btnPrimary" onClick={() => void send()} disabled={sending}>
            {sending ? "发送中…" : "推送到机器人"}
          </button>
        </div>
        {msg && <div className="hint successHint">{msg}</div>}
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card result">
        <h3>预览 · {preview?.title ?? "—"}</h3>
        <pre>{preview?.markdown || (loadingPreview ? "加载中…" : "暂无")}</pre>
      </section>

      <section className="card cronHelpCard">
        <h3 className="sectionTitle">定时推送（Cron）</h3>
        <p className="hint">
          服务端路由为 <code className="inlineCode">/api/cron/push-daily</code>，需{" "}
          <code className="inlineCode">Authorization: Bearer &lt;CRON_SECRET&gt;</code>
          ；并开启 <code className="inlineCode">AUTO_PUSH_DAILY_ENABLED</code>、配置{" "}
          <code className="inlineCode">WEBHOOK_*</code>。详见仓库 README。仓库内提供{" "}
          <code className="inlineCode">scripts/cron_push_daily.sh</code> 与{" "}
          <code className="inlineCode">.github/workflows/daily-notify.yml</code> 示例。
        </p>
        <pre className="cronSnippet">
{`# 本地/服务器手动触发（需已 export APP_BASE_URL 与 CRON_SECRET）
./scripts/cron_push_daily.sh

# 等价 curl
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \\
  "$APP_BASE_URL/api/cron/push-daily"`}
        </pre>
      </section>

      <section className="card result">
        <h3>最近推送记录</h3>
        {!logs.length ? (
          <pre>暂无记录</pre>
        ) : (
          <div className="list">
            {logs.map((row) => (
              <article key={row.id} className="listItem">
                <div className="listItemHead">
                  <strong>{row.created_at}</strong>
                  <span className="badge">
                    {row.channel} · {row.success ? "成功" : "失败"}
                  </span>
                </div>
                <p className="logTitle">{row.title}</p>
                <div className="hint">
                  尝试 {row.attempts} 次 · {row.response_message?.slice(0, 120)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
