"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, patchJson, postJson } from "@/lib/api";

type ActionRow = {
  id: number;
  source_record_id: number;
  source_date: string;
  content: string;
  priority: string;
  status: string;
  due_date: string | null;
  notes: string;
};

type Stats = {
  total: number;
  todo_open: number;
  overdue_todo_count: number;
  completion_rate: number;
};

export default function ActionItemsPage() {
  const [days, setDays] = useState(30);
  const [filterStatus, setFilterStatus] = useState("");
  const [items, setItems] = useState<ActionRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const qs = new URLSearchParams({ days: String(days), limit: "200" });
      if (filterStatus) qs.set("status", filterStatus);
      const data = await getJson<ActionRow[]>(`/api/v2/action-items?${qs.toString()}`);
      setItems(data);
      const s = await getJson<Stats>("/api/v2/action-items/stats");
      setStats(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [days, filterStatus]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const sync = async () => {
    setMsg("");
    setError("");
    setSyncing(true);
    try {
      const data = await postJson<{
        ok?: boolean;
        inserted?: number;
        skipped_duplicate?: number;
        scanned_records?: number;
      }>(`/api/v2/action-items/sync?days=${days}`, {});
      setMsg(
        `同步完成：扫描日报 ${data.scanned_records ?? 0} 篇，新增 ${data.inserted ?? 0} 条，跳过重复 ${data.skipped_duplicate ?? 0} 条。`,
      );
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  const patchItem = async (id: number, patch: Record<string, unknown>) => {
    setError("");
    try {
      await patchJson(`/api/v2/action-items/${id}`, patch);
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <>
      <header className="pageHeader">
        <h2>待办清单</h2>
        <p>从日报自动抽取待办（规则：待办/跟进等行），支持筛选与标记完成。</p>
      </header>

      <section className="card">
        <div className="fieldRow">
          <div className="field">
            <label htmlFor="ai-days">回溯天数（列表与同步）</label>
            <select id="ai-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  最近 {d} 天
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ai-status">状态筛选</label>
            <select
              id="ai-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">全部</option>
              <option value="todo">todo</option>
              <option value="done">done</option>
              <option value="completed">completed</option>
            </select>
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btnPrimary" onClick={() => load()} disabled={loading}>
            {loading ? "加载中..." : "刷新"}
          </button>
          <button type="button" className="btnSecondary" onClick={() => void sync()} disabled={syncing}>
            {syncing ? "同步中..." : "从日报抽取待办"}
          </button>
        </div>
        {stats && (
          <div className="hint">
            合计 {stats.total} 条 · 未完成 {stats.todo_open} · 逾期 {stats.overdue_todo_count} · 完成率{" "}
            {stats.completion_rate}
          </div>
        )}
        {msg && <div className="hint successHint">{msg}</div>}
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card result">
        <h3>列表</h3>
        {!items.length ? (
          <pre>{loading ? "加载中..." : "暂无数据，可先写日报并点击「从日报抽取待办」。"}</pre>
        ) : (
          <div className="list">
            {items.map((item) => (
              <article key={item.id} className="listItem">
                <div className="listItemHead">
                  <strong>{item.source_date}</strong>
                  <span className="badge">
                    #{item.id} · {item.priority}
                  </span>
                </div>
                <p>{item.content}</p>
                <div className="tagRow">
                  <span className="tag">状态：{item.status}</span>
                  {item.due_date && <span className="tag">截止：{item.due_date}</span>}
                </div>
                <div className="actions tightActions">
                  {item.status === "todo" ? (
                    <button
                      type="button"
                      className="btnSecondary"
                      onClick={() => void patchItem(item.id, { status: "done" })}
                    >
                      标为完成
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btnSecondary"
                      onClick={() => void patchItem(item.id, { status: "todo" })}
                    >
                      标为待办
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
