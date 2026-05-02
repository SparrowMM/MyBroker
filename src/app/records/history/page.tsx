"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getJson } from "@/lib/api";
import { rangeLastNDaysLocal } from "@/lib/local-date";

type HistoryRecord = {
  id: number;
  date: string;
  summary: string;
  tags: string[];
};

/** 与 dailyRecordToJson 字段对齐 */
type ApiRecord = {
  id: number;
  record_date: string;
  analysis_summary: string;
  tags: string[];
};

const DAY_OPTIONS = [7, 14, 30, 60, 90];

export default function RecordsHistoryPage() {
  const [days, setDays] = useState(30);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const hasRecords = useMemo(() => records.length > 0, [records]);

  const exportCsvHref = useMemo(() => {
    const { start, end } = rangeLastNDaysLocal(days);
    return `/api/v2/records/export?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&format=csv`;
  }, [days]);

  const loadHistory = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      const { start, end } = rangeLastNDaysLocal(days);
      const qs = new URLSearchParams({
        start_date: start,
        end_date: end,
        limit: "2000",
      });
      const rows = await getJson<ApiRecord[]>(`/api/v2/records?${qs.toString()}`);
      setRecords(
        rows.map((r) => ({
          id: r.id,
          date: r.record_date,
          summary: r.analysis_summary,
          tags: r.tags ?? [],
        })),
      );
      setTotalRecords(rows.length);
    } catch (err) {
      setError(String(err));
      setRecords([]);
      setTotalRecords(0);
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadHistory().catch(() => undefined);
  }, [loadHistory]);

  return (
    <>
      <header className="pageHeader">
        <h2>历史日报列表</h2>
        <p>按日历天数筛选：列出该区间内全部日报（同一天多条会全部显示），并与导出 CSV 范围一致。</p>
      </header>

      <section className="card">
        <div className="fieldRow">
          <div className="field">
            <label htmlFor="history-days">查询范围</label>
            <select
              id="history-days"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              disabled={isLoading}
            >
              {DAY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  最近 {item} 天（日历）
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="btnPrimary" onClick={() => void loadHistory()} disabled={isLoading}>
            {isLoading ? "加载中..." : "刷新列表"}
          </button>
          <a className="btnSecondary exportLink" href={exportCsvHref} target="_blank" rel="noreferrer">
            导出 CSV（最近 {days} 天）
          </a>
        </div>
        <div className="hint">当前区间内记录数：{totalRecords}（列表接口单页最多 2000 条，超出请缩小区间或走导出）</div>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card result">
        <h3>历史日报</h3>
        {!hasRecords ? (
          <pre>{isLoading ? "正在加载历史日报..." : "该区间内暂无日报数据"}</pre>
        ) : (
          <div className="list">
            {records.map((item) => (
              <article key={item.id} className="listItem">
                <div className="listItemHead">
                  <strong>{item.date}</strong>
                  <span className="badge">#{item.id}</span>
                </div>
                <p>{item.summary || "暂无摘要"}</p>
                <div className="tagRow">
                  {(item.tags || []).length > 0 ? (
                    item.tags.map((tag) => (
                      <span key={`${item.id}-${tag}`} className="tag">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="hint">无标签</span>
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
