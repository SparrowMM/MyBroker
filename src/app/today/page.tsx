"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getJson, patchJson, postJson } from "@/lib/api";
import { useTodayYmd } from "@/lib/use-today-ymd";
import { RecordCard } from "@/app/records/_components/record-card";
import { RecordForm } from "@/app/records/_components/record-form";
import { ScreenshotHelper } from "@/app/records/_components/screenshot-helper";
import type { DailyRecordDto, RecordPayload } from "@/app/records/_components/types";
import type { BrokerDailyReview, BrokerPriorities } from "@/lib/broker-types";
import { ReviewPanel } from "@/app/_components/review-panel";

type ActionRow = {
  id: number;
  content: string;
  priority: string;
  status: string;
  source_date: string;
};

export default function TodayPage() {
  const today = useTodayYmd();
  const [records, setRecords] = useState<DailyRecordDto[]>([]);
  const [todos, setTodos] = useState<ActionRow[]>([]);
  const [priorities, setPriorities] = useState<BrokerPriorities | null>(null);
  const [review, setReview] = useState<BrokerDailyReview | null>(null);
  const [prioritiesCached, setPrioritiesCached] = useState(false);
  const [reviewCached, setReviewCached] = useState(false);

  const [loading, setLoading] = useState(false);
  const [prioLoading, setPrioLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [createError, setCreateError] = useState("");
  const [externalRaw, setExternalRaw] = useState<{
    value: string;
    mode: "append" | "replace";
    nonce: number;
  } | null>(null);
  const reviewReqRef = useRef(0);
  const prioReqRef = useRef(0);

  const loadRecords = useCallback(async () => {
    const qs = new URLSearchParams({ record_date: today, limit: "100" });
    const rows = await getJson<DailyRecordDto[]>(`/api/v2/records?${qs.toString()}`);
    setRecords(rows.sort((a, b) => b.id - a.id));
  }, [today]);

  const loadTodos = useCallback(async () => {
    const qs = new URLSearchParams({ status: "todo", days: "60", limit: "50" });
    const rows = await getJson<ActionRow[]>(`/api/v2/action-items?${qs.toString()}`);
    const prank = (p: string) => (p === "high" ? 0 : p === "medium" ? 1 : 2);
    rows.sort((a, b) => prank(a.priority) - prank(b.priority));
    setTodos(rows);
  }, []);

  const refreshCore = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadRecords(), loadTodos()]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [loadRecords, loadTodos]);

  const loadPriorities = useCallback(async (refresh = false, forDate = today) => {
    const reqId = ++prioReqRef.current;
    setPrioLoading(true);
    setError("");
    try {
      const path = refresh
        ? `/api/v2/broker/today-priorities?date=${forDate}&refresh=1`
        : `/api/v2/broker/today-priorities?date=${forDate}`;
      const res = await getJson<{ priorities: BrokerPriorities; cached: boolean }>(path);
      if (reqId !== prioReqRef.current) return;
      if (res.priorities.review_date !== forDate) return;
      setPriorities(res.priorities);
      setPrioritiesCached(res.cached);
    } catch (e) {
      if (reqId === prioReqRef.current) setError(String(e));
    } finally {
      if (reqId === prioReqRef.current) setPrioLoading(false);
    }
  }, [today]);

  const loadReview = useCallback(async (refresh = false, forDate = today): Promise<BrokerDailyReview | null> => {
    const reqId = ++reviewReqRef.current;
    setReviewLoading(true);
    setError("");
    try {
      const path = refresh
        ? `/api/v2/broker/daily-review?date=${forDate}&refresh=1`
        : `/api/v2/broker/daily-review?date=${forDate}`;
      const res = await getJson<{ review: BrokerDailyReview; cached: boolean }>(path);
      if (reqId !== reviewReqRef.current) return null;
      if (res.review.review_date !== forDate) return null;
      setReview(res.review);
      setReviewCached(res.cached);
      return res.review;
    } catch (e) {
      if (reqId === reviewReqRef.current) setError(String(e));
      return null;
    } finally {
      if (reqId === reviewReqRef.current) setReviewLoading(false);
    }
  }, [today]);

  const todayReview =
    review?.review_date === today && review.markdown.trim() ? review : null;

  const handleReviewClick = useCallback(async () => {
    await loadReview(true, today);
  }, [today, loadReview]);

  useEffect(() => {
    setRecords([]);
    setPriorities(null);
    setReview(null);
    setPrioritiesCached(false);
    setReviewCached(false);
    setExternalRaw(null);
    setFlash("");
    setCreateError("");
    void refreshCore();
    void loadPriorities(false, today);
  }, [today, refreshCore, loadPriorities]);

  const statusLine = useMemo(() => {
    const open = todos.length;
    return `今天 ${records.length} 条记录 · ${open} 项待办未完成`;
  }, [records.length, todos.length]);

  const handleCreate = async (payload: RecordPayload): Promise<boolean> => {
    setCreateError("");
    try {
      const data = await postJson<{ ok?: boolean; record?: DailyRecordDto; message?: string }>(
        "/api/v2/records",
        { ...payload, record_date: today },
      );
      if (data.ok && data.record) {
        setRecords((prev) => [data.record!, ...prev]);
        setFlash("已记下，摘要已生成。");
        setTimeout(() => setFlash(""), 3500);
        void loadTodos();
        return true;
      }
      setCreateError(data.message || "保存失败");
      return false;
    } catch (err) {
      setCreateError(String(err));
      return false;
    }
  };

  const toggleTodo = async (id: number) => {
    try {
      await patchJson(`/api/v2/action-items/${id}`, { status: "done" });
      setTodos((prev) => prev.filter((t) => t.id !== id));
      setFlash("待办已完成。");
      setTimeout(() => setFlash(""), 2500);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleMergeMarkdown = (markdown: string) => {
    setExternalRaw({ value: markdown, mode: "append", nonce: Date.now() });
    setFlash("截图内容已合入下方输入框，确认后点「记下」。");
    setTimeout(() => setFlash(""), 4000);
  };

  const kindLabel = (k: string) => (k === "life" ? "生活" : k === "mixed" ? "综合" : "工作");

  return (
    <>
      <header className="pageHeader">
        <h2>今天</h2>
        <p className="statusLine">{statusLine}</p>
      </header>

      {flash && <div className="card flashHint successHint">{flash}</div>}
      {error && <div className="error bannerError">{error}</div>}

      <section className="card brokerCard">
        <div className="cardHead">
          <h3 className="sectionTitle">经纪人 · 今日优先级</h3>
          <span className="badge subtleBadge">{prioritiesCached ? "缓存" : "新生成"}</span>
        </div>
        {priorities ? (
          <>
            <p className="brokerNote">{priorities.broker_note}</p>
            <ol className="priorityList">
              {priorities.top_three.map((item, i) => (
                <li key={`${item.title}-${i}`}>
                  <span className={`kindTag kind-${item.kind}`}>{kindLabel(item.kind)}</span>
                  <strong>{item.title}</strong>
                  <span className="hint blockHint">{item.reason}</span>
                </li>
              ))}
            </ol>
            <div className="decisionBox">
              <p className="mutedLabel">需要你拍板</p>
              <p>{priorities.decision.question}</p>
              <ul>
                {priorities.decision.options.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
              <p className="hint">建议：{priorities.decision.recommendation}</p>
            </div>
          </>
        ) : (
          <p className="hint">{prioLoading ? "经纪人分析中…" : "点击刷新获取今日建议"}</p>
        )}
        <div className="actions">
          <button
            type="button"
            className="btnSecondary"
            disabled={prioLoading}
            onClick={() => void loadPriorities(true)}
          >
            {prioLoading ? "刷新中…" : "刷新优先级"}
          </button>
        </div>
      </section>

      <section className="card">
        <h3 className="sectionTitle">快速记录</h3>
        <RecordForm
          defaultDate={today}
          lockDate
          onSubmit={handleCreate}
          submitLabel="记下"
          pendingLabel="记下中（AI 分析）…"
          externalRawText={externalRaw ?? undefined}
          resetAfterSubmit
        />
        {createError && <div className="error">{createError}</div>}
        <ScreenshotHelper date={today} onMarkdown={handleMergeMarkdown} />
      </section>

      <section className="card">
        <div className="cardHead">
          <h3 className="sectionTitle">今日记录</h3>
          <button type="button" className="btnSecondary" onClick={() => void refreshCore()} disabled={loading}>
            {loading ? "刷新中…" : "刷新"}
          </button>
        </div>
        {!records.length ? (
          <p className="hint">今天还没有记录，在上方写一句或贴一张截图即可。</p>
        ) : (
          <div className="recordList">
            {records.map((r) => (
              <RecordCard
                key={r.id}
                record={r}
                onChange={(rec) => setRecords((prev) => prev.map((x) => (x.id === rec.id ? rec : x)))}
                onDelete={(id) => setRecords((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="sectionTitle">待办</h3>
        {!todos.length ? (
          <p className="hint">暂无未完成待办。记录里的行动项可在「设置」中同步。</p>
        ) : (
          <ul className="todoList">
            {todos.slice(0, 15).map((t) => (
              <li key={t.id}>
                <label className="todoRow">
                  <input type="checkbox" onChange={() => void toggleTodo(t.id)} />
                  <span>
                    <span className={`prioDot prio-${t.priority}`} />
                    {t.content}
                    <span className="hint"> · {t.source_date}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card brokerCard">
        <div className="cardHead">
          <h3 className="sectionTitle">经纪人 · 日终复盘</h3>
          <span className="badge subtleBadge">
            {todayReview ? (reviewCached ? "缓存" : "新生成") : ""}
            {todayReview ? ` · ${todayReview.source === "fallback" ? "结构化" : "AI"}` : ""}
          </span>
        </div>
        {todayReview ? (
          <ReviewPanel markdown={todayReview.markdown} exportDate={today} />
        ) : (
          <p className="hint">
            {reviewLoading ? "加载复盘…" : "收工时点一下，换一版有画面感的夜谈复盘。"}
          </p>
        )}
        <div className="actions">
          <button
            type="button"
            className="btnPrimary"
            disabled={reviewLoading}
            onClick={() => void handleReviewClick()}
          >
            {reviewLoading ? "生成中…" : todayReview ? "重新生成复盘" : "生成今日复盘"}
          </button>
        </div>
      </section>
    </>
  );
}
